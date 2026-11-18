using Npgsql;

namespace SalonPlatform;

internal sealed record ServiceTerms(Guid Id, string Name, string Description, int PriceMinor,
    int DurationMinutes, int CleanupMinutes, string? PhotoUrl);
internal sealed record StaffCard(Guid Id, string Name, string? PhotoUrl);
internal sealed record AvailableSlot(DateTime Start, DateTime End, Guid[] StaffIds);
internal sealed record SlotDay(DateOnly Date, List<AvailableSlot> Slots);
internal sealed record Availability(List<SlotDay> Days, List<StaffCard> Staff);
internal sealed record SalonCard(Guid Id, string Slug, string Name, string Address, string Phone,
    string? LogoUrl, string? CoverUrl, string Accent, int ChangeHours, string Status, int HorizonDays);

internal static class BookingSlots
{
    public static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Copenhagen");
    public static DateOnly LocalDate(DateTime utc) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utc, Zone));
    public static DateOnly Today => LocalDate(DateTime.UtcNow);
    public static async Task<SalonCard> Salon(NpgsqlConnection db, NpgsqlTransaction? tx, Guid? id, string? slug)
    {
        return (await Pg.Query(db, tx, """
            SELECT id,slug,name,address,phone,logo_url,cover_url,accent,change_hours,status,horizon_days
            FROM salons WHERE id=@id::uuid OR slug=@slug::text
            """, r => new SalonCard(r.GetGuid(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4),
                r.Str(5),r.Str(6),r.GetString(7),r.GetInt32(8),r.GetString(9),r.GetInt32(10)),("id",id),("slug",slug)))
            .FirstOrDefault() ?? throw Missing();
    }

    internal static SalonError Missing() => new(404,"Oplysningerne findes ikke.");
    public static async Task<List<ServiceTerms>> Services(NpgsqlConnection db, NpgsqlTransaction? tx, Guid salon) =>
        await Pg.Query(db,tx,"""
            SELECT id,name,description,price_ore,duration_minutes,cleanup_minutes,photo_url
            FROM services WHERE salon_id=@salon AND active ORDER BY name,id
            """, r => new ServiceTerms(r.GetGuid(0),r.GetString(1),r.Str(2) ?? "",r.GetInt32(3),r.GetInt32(4),
                r.GetInt32(5),r.Str(6)),("salon",salon));

    public static Task<List<StaffCard>> Staff(NpgsqlConnection db,NpgsqlTransaction? tx,Guid salon,Guid? only=null) =>
        Pg.Query(db,tx,"""
            SELECT id,name,photo_url FROM staff WHERE salon_id=@salon AND active AND (@only::uuid IS NULL OR id=@only)
            ORDER BY name,id
            """,r => new StaffCard(r.GetGuid(0),r.GetString(1),r.Str(2)),("salon",salon),("only",only));

    // The same query drives the store front, the calendar and the recheck inside the write transaction.
    // Generate instants in Copenhagen local time and require the complete occupied interval to fit.
    const string CandidateSql = """
        WITH days AS (
            SELECT @from::date+i AS day,s.slot_minutes,s.notice_hours
            FROM salons s CROSS JOIN generate_series(0,@days::int-1) i
            WHERE s.id=@salon
              AND @from::date+i BETWEEN (now() AT TIME ZONE 'Europe/Copenhagen')::date
                                  AND (now() AT TIME ZONE 'Europe/Copenhagen')::date + s.horizon_days
        ), work AS (
            SELECT d.*,st.id AS employee,st.name AS employee_name,w.start_min,w.end_min
            FROM days d JOIN staff st ON st.salon_id=@salon AND st.active
            JOIN staff_services ss ON ss.salon_id=st.salon_id AND ss.staff_id=st.id AND ss.service_id=@service
            JOIN LATERAL (
                SELECT e.start_min,e.end_min FROM shift_exceptions e
                    WHERE e.salon_id=@salon AND e.staff_id=st.id AND e.date=d.day
                UNION ALL
                SELECT sh.start_min,sh.end_min FROM shifts sh
                    WHERE sh.salon_id=@salon AND sh.staff_id=st.id AND sh.weekday=extract(isodow FROM d.day)
                    AND NOT EXISTS (SELECT 1 FROM shift_exceptions e WHERE e.salon_id=@salon AND e.staff_id=st.id AND e.date=d.day)
            ) w ON w.start_min IS NOT NULL
            WHERE (@employee::uuid IS NULL OR st.id=@employee)
        ), candidates AS (
            SELECT w.day,w.employee,w.employee_name,w.notice_hours,t AS starts_at,
                t+make_interval(mins=>@duration) AS ends_at,t+make_interval(mins=>@duration+@cleanup) AS busy_until,
                (w.day+make_interval(mins=>w.end_min)) AT TIME ZONE 'Europe/Copenhagen' AS shift_end,
                w.end_min
            FROM work w CROSS JOIN LATERAL generate_series(
                (w.day+make_interval(mins=>((w.start_min+w.slot_minutes-1)/w.slot_minutes)*w.slot_minutes)) AT TIME ZONE 'Europe/Copenhagen',
                (w.day+make_interval(mins=>w.end_min)) AT TIME ZONE 'Europe/Copenhagen',
                make_interval(mins=>w.slot_minutes)) t
        )
        SELECT day,starts_at,ends_at,array_agg(DISTINCT employee ORDER BY employee) AS employees FROM candidates c
        WHERE c.starts_at >= now()+make_interval(hours=>CASE WHEN @desk THEN 0 ELSE c.notice_hours END)
          AND c.busy_until <= c.shift_end
          AND NOT EXISTS (SELECT 1 FROM occupied_time o WHERE o.salon_id=@salon AND o.staff_id=c.employee
                AND (@ignore::uuid IS NULL OR o.id<>@ignore) AND o.span && tstzrange(c.starts_at,c.busy_until,'[)'))
        GROUP BY day,starts_at,ends_at ORDER BY starts_at
        """;
    public static async Task<List<SlotDay>> Options(NpgsqlConnection db,NpgsqlTransaction? tx,Guid salon,ServiceTerms service,
        DateOnly from,int days,bool desk=false,Guid? ignore=null,Guid? employee=null,bool firstOnly=false)
    {
        if (days is <1 or >367 || from.Year is <2000 or >2100) throw new SalonError(400,"Vælg en gyldig periode.");
        var rows = await Pg.Query(db,tx,firstOnly ? CandidateSql+" LIMIT 1":CandidateSql,r => (
            Day:r.GetFieldValue<DateOnly>(0), Slot:new AvailableSlot(r.GetDateTime(1),r.GetDateTime(2),r.GetFieldValue<Guid[]>(3))),
            ("from",from),("days",days),("salon",salon),("service",service.Id),("duration",service.DurationMinutes),
            ("cleanup",service.CleanupMinutes),("desk",desk),("employee",employee),("ignore",ignore));
        return rows.GroupBy(v=>v.Day).Select(day=>new SlotDay(day.Key,day.Select(x=>x.Slot).ToList())).ToList();
    }
    public static async Task<bool> HasFutureAsync(NpgsqlDataSource ds,Guid salon)
    {
        await using var db = await ds.OpenConnectionAsync();
        return await HasFutureAsync(db,null,salon);
    }
    public static async Task<bool> HasFutureAsync(NpgsqlConnection db,NpgsqlTransaction? tx,Guid salon)
    {
        var card = await Salon(db,tx,salon,null);
        foreach (var service in await Services(db,tx,salon))
            if ((await Options(db,tx,salon,service,Today,card.HorizonDays+1,firstOnly:true)).Count > 0) return true;
        return false;
    }
    public static async Task<object> Catalogue(NpgsqlConnection db,SalonCard card)
    {
        var services = new List<object>();
        foreach (var service in await Services(db,null,card.Id))
        {
            DateOnly? firstAvailableDate = (await Options(db,null,card.Id,service,Today,card.HorizonDays+1,firstOnly:true)).FirstOrDefault()?.Date;
            services.Add(new {service.Id,service.Name,service.Description,service.DurationMinutes,service.CleanupMinutes,
                service.PriceMinor,service.PhotoUrl,firstAvailableDate});
        }
        return new {card.Id,card.Slug,card.Name,card.Address,card.Phone,card.Accent,card.CoverUrl,card.LogoUrl,card.ChangeHours,
            card.HorizonDays,services,staff=await Staff(db,null,card.Id)};
    }
}
