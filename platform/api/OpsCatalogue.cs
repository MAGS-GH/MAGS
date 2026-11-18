using Npgsql;
using static SalonPlatform.OpsData;

namespace SalonPlatform;

public static partial class OpsEndpoints
{
    public sealed record ServiceInput(string Name,string? Description,int PriceOre,int DurationMinutes,int CleanupMinutes,string? PhotoUrl,bool Active = true);

    private static Task<IResult> SaveService(HttpContext ctx,NpgsqlDataSource source,Guid id,Guid? existing,ServiceInput input) => Manage(ctx,source,id,async (db,tx) =>
    {
        if (input.PriceOre is < 0 or > 100_000_000 || input.DurationMinutes is < 1 or > 1440 ||
            input.CleanupMinutes is < 0 or > 1440 || input.DurationMinutes + input.CleanupMinutes > 1440)
            throw new SalonError(400,"Angiv en gyldig pris og behandlingstid.");
        var service = existing ?? Guid.NewGuid();
        var sql = existing.HasValue ? """
            UPDATE services SET name=@n,description=@d,price_ore=@p,duration_minutes=@t,cleanup_minutes=@c,photo_url=@img,active=@a
            WHERE id=@i AND salon_id=@s
            """ : """
            INSERT INTO services(id,salon_id,name,description,price_ore,duration_minutes,cleanup_minutes,photo_url,active)
            VALUES(@i,@s,@n,@d,@p,@t,@c,@img,@a)
            """;
        var changed = await Execute(db,tx,sql,("i",service),("s",id),("n",Text(input.Name,120,true)),("d",Text(input.Description,1200)),
            ("p",input.PriceOre),("t",input.DurationMinutes),("c",input.CleanupMinutes),("img",Image(input.PhotoUrl,id)),("a",input.Active));
        if (changed == 0) throw new SalonError(404,"Behandlingen findes ikke i salonen.");
        await Audit(db,tx,id,OpsAuth.Subject(ctx).ToString(),existing.HasValue ? "service.updated" : "service.created",service);
        return Results.Ok(new {id=service});
    });

    public sealed record ShiftInput(int Weekday,int StartMin,int EndMin);
    public sealed record ExceptionInput(DateOnly Date,int? StartMin,int? EndMin);
    public sealed record StaffInput(string Name,string? PhotoUrl,Guid[]? ServiceIds,ShiftInput[]? Shifts,ExceptionInput[]? Exceptions,bool Active=true);

    private static void ValidatePeriods(IEnumerable<(int? Start,int? End)> periods)
    {
        var lastEnd = -1;
        var closed = false;
        foreach (var period in periods.OrderBy(p => p.Start))
        {
            if (period is (null,null) && !closed && lastEnd == -1) { closed=true; continue; }
            if (closed || period.Start is null || period.End is null || period.Start < lastEnd || period.Start < 0 || period.Start >= period.End || period.End > 1440)
                throw new SalonError(400,"Vagtperioder skal ligge inden for dagen og må ikke overlappe.");
            lastEnd = period.End.Value;
        }
    }

    private static Task<IResult> SaveStaff(HttpContext ctx,NpgsqlDataSource source,Guid id,Guid? existing,StaffInput input) => Manage(ctx,source,id,async (db,tx) =>
    {
        var shifts = input.Shifts ?? [];
        var exceptions = input.Exceptions ?? [];
        var services = (input.ServiceIds ?? []).Distinct().ToArray();
        if (shifts.Length > 100 || exceptions.Length > 2000 || services.Length > 2000 || shifts.Any(s => s.Weekday is < 1 or > 7))
            throw new SalonError(400,"Kontrollér antal vagter og gyldige ugedage.");
        foreach (var day in shifts.GroupBy(s => s.Weekday)) ValidatePeriods(day.Select(s => ((int?)s.StartMin,(int?)s.EndMin)));
        foreach (var day in exceptions.GroupBy(s => s.Date)) ValidatePeriods(day.Select(s => (s.StartMin,s.EndMin)));
        var staff = existing ?? Guid.NewGuid();
        var sql = existing.HasValue ? "UPDATE staff SET name=@n,photo_url=@img,active=@a WHERE id=@i AND salon_id=@s" :
            "INSERT INTO staff(id,salon_id,name,photo_url,active) VALUES(@i,@s,@n,@img,@a)";
        var changed = await Execute(db,tx,sql,("i",staff),("s",id),("n",Text(input.Name,120,true)),("img",Image(input.PhotoUrl,id)),("a",input.Active));
        if (changed == 0) throw new SalonError(404,"Medarbejderen findes ikke i salonen.");
        await Execute(db,tx,"DELETE FROM staff_services WHERE salon_id=@s AND staff_id=@i; DELETE FROM shifts WHERE salon_id=@s AND staff_id=@i; DELETE FROM shift_exceptions WHERE salon_id=@s AND staff_id=@i",
            ("s",id),("i",staff));
        if (services.Length>0)
        {
            var count = await Execute(db,tx,"""
                INSERT INTO staff_services(salon_id,staff_id,service_id)
                SELECT @s,@i,svc.id FROM services svc WHERE svc.salon_id=@s AND svc.id=ANY(@ids)
                """,("s",id),("i",staff),("ids",services));
            if (count != services.Length) throw new SalonError(400,"En valgt behandling hører ikke til salonen.");
        }
        if (shifts.Length>0)
            await Execute(db,tx,"""
                INSERT INTO shifts(salon_id,staff_id,weekday,start_min,end_min)
                SELECT @s,@i,dt.w,dt.a,dt.b FROM unnest(@days,@starts,@ends) AS dt(w,a,b)
                """,("s",id),("i",staff),("days",shifts.Select(s=>s.Weekday).ToArray()),("starts",shifts.Select(s=>s.StartMin).ToArray()),("ends",shifts.Select(s=>s.EndMin).ToArray()));
        if (exceptions.Length>0)
            await Execute(db,tx,"""
                INSERT INTO shift_exceptions(salon_id,staff_id,date,start_min,end_min)
                SELECT @s,@i,dt.d,NULLIF(dt.a,-1),NULLIF(dt.b,-1) FROM unnest(@dates,@starts,@ends) AS dt(d,a,b)
                """,("s",id),("i",staff),("dates",exceptions.Select(e=>e.Date).ToArray()),("starts",exceptions.Select(e=>e.StartMin ?? -1).ToArray()),("ends",exceptions.Select(e=>e.EndMin ?? -1).ToArray()));
        if (existing.HasValue)
        {
            var affected = await Rows(db,tx,"""
                WITH future AS (
                  SELECT a.id,c.name AS customer,a.starts_at,
                    a.starts_at AT TIME ZONE 'Europe/Copenhagen' AS a,
                    a.busy_until AT TIME ZONE 'Europe/Copenhagen' AS b
                  FROM appointments a JOIN customers c ON c.id=a.customer_id AND c.salon_id=a.salon_id
                  WHERE a.salon_id=@s AND a.staff_id=@i AND a.status='booked' AND a.busy_until>now()
                )
                SELECT f.id,f.customer AS "customerName",f.starts_at AS "startsAt" FROM future f
                WHERE NOT @active OR NOT EXISTS (
                  SELECT 1 FROM (
                    SELECT x.start_min,x.end_min FROM shift_exceptions x WHERE x.salon_id=@s AND x.staff_id=@i AND x.date=f.a::date
                    UNION ALL
                    SELECT w.start_min,w.end_min FROM shifts w WHERE w.salon_id=@s AND w.staff_id=@i AND w.weekday=extract(isodow FROM f.a)
                      AND NOT EXISTS(SELECT 1 FROM shift_exceptions x WHERE x.salon_id=@s AND x.staff_id=@i AND x.date=f.a::date)
                  ) p WHERE f.a >= f.a::date + make_interval(mins=>p.start_min) AND f.b <= f.a::date + make_interval(mins=>p.end_min)
                ) ORDER BY f.starts_at
                """,("s",id),("i",staff),("active",input.Active));
            if (affected.Length>0) return Results.Json(new {error="Flyt eller aflys de berørte aftaler, før du ændrer vagten.",affected},statusCode:409);
        }
        await Audit(db,tx,id,OpsAuth.Subject(ctx).ToString(),existing.HasValue ? "staff.updated" : "staff.created",staff);
        return Results.Ok(new {id=staff});
    });
}
