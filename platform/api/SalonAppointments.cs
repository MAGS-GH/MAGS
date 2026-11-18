using System.Text;
using System.Text.RegularExpressions;
using Npgsql;

namespace SalonPlatform;

internal sealed record NewAppointment(Guid ServiceId, DateTimeOffset Start, Guid? StaffId, string? Name, string? Phone, Guid RequestId,
    int? ExpectedPriceMinor = null, int? ExpectedDurationMinutes = null);
internal sealed record MoveAppointment(DateTimeOffset Start, Guid? StaffId);
internal sealed record NewBlock(Guid StaffId, DateTimeOffset Start, DateTimeOffset End, string? Reason);
internal sealed record Appointment(Guid Id, Guid SalonId, string SalonName, string SalonSlug, string Address, string Phone,
    Guid CustomerId, string CustomerName, string CustomerPhone, Guid StaffId, string StaffName, Guid ServiceId, string ServiceName,
    int DurationMinutes, int CleanupMinutes, int PriceMinor, DateTime Start, DateTime End, DateTime BusyUntil, string Status, DateTime ChangeDeadline)
{
    public bool CanChange => Status == "booked" && DateTime.UtcNow < ChangeDeadline;
    public ServiceTerms Terms => new(ServiceId, ServiceName, "", PriceMinor, DurationMinutes, CleanupMinutes, null);
    public object Receipt() => new
    {
        Id,
        SalonName,
        SalonSlug,
        Address,
        Phone,
        CustomerName,
        StaffId,
        StaffName,
        ServiceId,
        ServiceName,
        PriceMinor,
        DurationMinutes,
        Start,
        End,
        Status,
        ChangeDeadline,
        CanChange
    };
    public object Desk() => new
    {
        Id,
        CustomerId,
        CustomerName,
        CustomerPhone,
        StaffId,
        StaffName,
        ServiceId,
        ServiceName,
        Start,
        End,
        BusyUntil,
        PriceMinor,
        Status
    };
}

internal static class SalonAppointments
{
    const string ReadSql = """
        SELECT a.id,a.salon_id,s.name,s.slug,s.address,s.phone,c.id,c.name,c.phone,a.staff_id,st.name,a.service_id,
            a.service_name,a.duration_minutes,a.cleanup_minutes,a.price_ore,a.starts_at,a.ends_at,a.busy_until,a.status,
            a.starts_at-make_interval(hours=>a.change_hours)
        FROM appointments a JOIN salons s ON s.id=a.salon_id JOIN customers c ON c.id=a.customer_id AND c.salon_id=a.salon_id
        JOIN staff st ON st.id=a.staff_id AND st.salon_id=a.salon_id
        """;
    public static Task<List<Appointment>> Find(NpgsqlConnection db, NpgsqlTransaction? tx, string predicate, params (string, object?)[] args) =>
        Pg.Query(db, tx, ReadSql + " WHERE " + predicate,
            r => new Appointment(r.GetGuid(0), r.GetGuid(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetString(5),
                r.GetGuid(6), r.GetString(7), r.GetString(8), r.GetGuid(9), r.GetString(10), r.GetGuid(11), r.GetString(12),
                r.GetInt32(13), r.GetInt32(14), r.GetInt32(15), r.GetDateTime(16), r.GetDateTime(17), r.GetDateTime(18),
                r.GetString(19), r.GetDateTime(20)), args);
    public static async Task<Appointment> ById(NpgsqlConnection db, NpgsqlTransaction? tx, Guid salon, Guid id) =>
        (await Find(db, tx, "a.salon_id=@salon AND a.id=@id", ("salon", salon), ("id", id))).FirstOrDefault() ?? throw BookingSlots.Missing();
    public static async Task<Appointment> ByToken(NpgsqlConnection db, NpgsqlTransaction? tx, string token)
    {
        if (!Regex.IsMatch(token, @"\A[a-f0-9]{64}\z")) throw BookingSlots.Missing();
        return (await Find(db, tx, "a.token_hash=@hash", ("hash", GuestLinks.Hash(token)))).FirstOrDefault() ?? throw BookingSlots.Missing();
    }
    public static async Task<Guid> Choose(NpgsqlConnection db, NpgsqlTransaction tx, Guid salon, ServiceTerms terms,
        DateTime start, Guid? preferred, bool desk, Guid? ignore = null)
    {
        var day = (await BookingSlots.Options(db, tx, salon, terms, BookingSlots.LocalDate(start), 1, desk, ignore, preferred)).FirstOrDefault();
        var slot = day?.Slots.FirstOrDefault(s => s.Start == start);
        if (slot is null) throw new SalonError(409, "Tiden er ikke længere ledig. Vælg en af de andre tider.");
        return slot.StaffIds[0];
    }
    public static async Task<ServiceTerms> Service(NpgsqlConnection db, NpgsqlTransaction? tx, Guid salon, Guid service) =>
        (await BookingSlots.Services(db, tx, salon)).FirstOrDefault(s => s.Id == service) ?? throw BookingSlots.Missing();
    static string PhoneKey(string phone)
    {
        if (!Regex.IsMatch(phone, @"\A\+?[\d ()\-]{7,26}\z")) throw new SalonError(400, "Angiv et gyldigt telefonnummer.");
        var digits = string.Concat(phone.Where(char.IsAsciiDigit));
        if (digits.StartsWith("00")) digits = digits[2..];
        if (digits.Length is < 7 or > 15) throw new SalonError(400, "Angiv et gyldigt telefonnummer.");
        return digits.Length == 8 ? "45" + digits : digits;
    }
    public static async Task<object> Create(NpgsqlDataSource ds, GuestLinks links, Guid salon, NewAppointment body,
        HttpContext? staffContext)
    {
        bool desk = staffContext != null;
        string? actor = desk ? OpsAuth.Subject(staffContext!).ToString() : null;
        var name = body.Name?.Trim() ?? "";
        var phone = body.Phone?.Trim() ?? "";
        if (name.Length is < 1 or > 120 || name.Any(char.IsControl) || body.RequestId == Guid.Empty)
            throw new SalonError(400, "Angiv navn og en gyldig bookinganmodning.");
        var phoneKey = PhoneKey(phone);
        var start = body.Start.UtcDateTime;
        await using var db = await ds.OpenConnectionAsync();
        await using var tx = await db.BeginTransactionAsync();
        await Pg.Lock(db, tx, salon);
        var access = desk ? await OpsAuth.Access(staffContext!, db, tx, salon) ?? throw Forbidden() : null;
        var onlyStaff = access?.StaffId;
        if (onlyStaff is not null && body.StaffId is not null && body.StaffId != onlyStaff) throw Forbidden();
        var preferred = onlyStaff ?? body.StaffId;
        var requestHash = links.RequestHash(System.Text.Json.JsonSerializer.Serialize(new
        {
            body.ServiceId,
            start,
            preferred,
            name,
            phoneKey,
            desk,
            actor,
            body.ExpectedPriceMinor,
            body.ExpectedDurationMinutes
        }));
        var existing = (await Pg.Query(db, tx, "SELECT id,request_hash,token_hash FROM appointments WHERE salon_id=@s AND request_id=@r",
            r => (Id: r.GetGuid(0), Hash: r.GetString(1), TokenHash: r.Str(2)), ("s", salon), ("r", body.RequestId))).SingleOrDefault();
        if (existing.Id != Guid.Empty)
        {
            if (existing.Hash != requestHash) throw new SalonError(409, "Bookinganmodningen er allerede brugt.");
            var prior = await ById(db, tx, salon, existing.Id);
            return new { appointment = desk ? prior.Desk() : prior.Receipt(), token = existing.TokenHash is null ? null : links.For(existing.Id, body.RequestId) };
        }
        var card = await BookingSlots.Salon(db, tx, salon, null);
        if (!desk && card.Status != "published") throw new SalonError(409, "Salonen tager ikke imod onlinebookinger lige nu.");
        if (!desk)
        {
            await using var repeated = Pg.Cmd(db, tx, """
                SELECT count(*) FROM appointments a JOIN customers c ON c.salon_id=a.salon_id AND c.id=a.customer_id
                WHERE a.salon_id=@s AND c.phone_key=@phone AND a.created_at>now()-interval '1 hour' AND a.token_hash IS NOT NULL
                """, ("s", salon), ("phone", phoneKey));
            if ((long)(await repeated.ExecuteScalarAsync())! >= 6) throw new SalonError(429, "Ring til salonen for flere bookinger.");
        }
        var selected = (await BookingSlots.Services(db, tx, salon)).FirstOrDefault(s => s.Id == body.ServiceId);
        if (!desk && (selected is null || selected.PriceMinor != body.ExpectedPriceMinor || selected.DurationMinutes != body.ExpectedDurationMinutes))
            throw new SalonError(409, "Behandlingens pris eller varighed har ændret sig. Gennemgå oplysningerne igen.", "catalogue_changed");
        var terms = selected ?? throw BookingSlots.Missing();
        var employee = await Choose(db, tx, salon, terms, start, preferred, desk);
        // Match both phone and name so family members sharing a phone keep separate histories.
        var customer = (await Pg.Query(db, tx, "SELECT id FROM customers WHERE salon_id=@s AND phone_key=@p AND lower(name)=lower(@n) AND NOT anonymized ORDER BY id LIMIT 1",
            r => r.GetGuid(0), ("s", salon), ("p", phoneKey), ("n", name))).FirstOrDefault();
        if (customer == Guid.Empty)
        {
            customer = Guid.NewGuid();
            await Pg.Exec(db, tx, "INSERT INTO customers(id,salon_id,name,phone,phone_key) VALUES(@id,@s,@n,@p,@key)",
                ("id", customer), ("s", salon), ("n", name), ("p", phone), ("key", phoneKey));
        }
        var id = Guid.NewGuid();
        var token = desk ? null : links.For(id, body.RequestId);
        await Pg.Exec(db, tx, """
            INSERT INTO appointments(id,salon_id,customer_id,staff_id,service_id,service_name,price_ore,duration_minutes,cleanup_minutes,
                starts_at,ends_at,busy_until,change_hours,request_id,request_hash,token_hash)
            VALUES(@id,@salon,@customer,@staff,@service,@serviceName,@price,@duration,@cleanup,@start,@end,@busy,@change,@request,@hash,@token)
            """, ("id", id), ("salon", salon), ("customer", customer), ("staff", employee), ("service", terms.Id), ("serviceName", terms.Name),
            ("price", terms.PriceMinor), ("duration", terms.DurationMinutes), ("cleanup", terms.CleanupMinutes), ("start", start),
            ("end", start.AddMinutes(terms.DurationMinutes)), ("busy", start.AddMinutes(terms.DurationMinutes + terms.CleanupMinutes)),
            ("change", card.ChangeHours), ("request", body.RequestId), ("hash", requestHash), ("token", token == null ? null : GuestLinks.Hash(token)));
        await OpsData.Audit(db, tx, salon, actor, desk ? "appointment.reception.create" : "appointment.guest.create", id);
        var saved = await ById(db, tx, salon, id);
        await tx.CommitAsync();
        return new { appointment = desk ? saved.Desk() : saved.Receipt(), token };
    }
    public static SalonError Forbidden() => new(403, "Du har ikke adgang til denne handling.");
    public static async Task<object> Change(NpgsqlDataSource ds, Guid salon, Guid id, MoveAppointment? move,
        string? guestToken, HttpContext? staffContext)
    {
        bool guest = guestToken != null;
        string? actor = guest ? null : OpsAuth.Subject(staffContext!).ToString();
        await using var db = await ds.OpenConnectionAsync();
        await using var tx = await db.BeginTransactionAsync();
        await Pg.Lock(db, tx, salon);
        var prior = guest ? await ByToken(db, tx, guestToken!) : await ById(db, tx, salon, id);
        var access = guest ? null : await OpsAuth.Access(staffContext!, db, tx, salon) ?? throw Forbidden();
        var onlyStaff = access?.StaffId;
        if (prior.SalonId != salon || prior.Id != id || onlyStaff != null && prior.StaffId != onlyStaff) throw BookingSlots.Missing();
        if (prior.Status == "cancelled")
        {
            if (move != null) throw new SalonError(409, "Aftalen er aflyst.");
            return guest ? prior.Receipt() : prior.Desk();
        }
        if (guest && !prior.CanChange) throw new SalonError(409, "Fristen for ændringer er passeret. Ring til salonen.");
        if (move == null) await Pg.Exec(db, tx, "UPDATE appointments SET status='cancelled' WHERE id=@id AND salon_id=@s", ("id", id), ("s", salon));
        else
        {
            if (onlyStaff != null && move.StaffId != null && move.StaffId != onlyStaff) throw Forbidden();
            var start = move.Start.UtcDateTime;
            var employee = await Choose(db, tx, salon, prior.Terms, start, onlyStaff ?? move.StaffId, !guest, id);
            await Pg.Exec(db, tx, "UPDATE appointments SET staff_id=@staff,starts_at=@t,ends_at=@end,busy_until=@busy WHERE id=@id AND salon_id=@s",
                ("staff", employee), ("t", start), ("end", start.AddMinutes(prior.DurationMinutes)),
                ("busy", start.AddMinutes(prior.DurationMinutes + prior.CleanupMinutes)), ("id", id), ("s", salon));
        }
        await OpsData.Audit(db, tx, salon, actor, "appointment." + (guest ? "guest." : "staff.") + (move == null ? "cancel" : "move"), id);
        var saved = await ById(db, tx, salon, id);
        await tx.CommitAsync();
        return guest ? saved.Receipt() : saved.Desk();
    }
    static string IcsText(string value) => value.Replace("\\", "\\\\").Replace("\r\n", "\\n").Replace("\n", "\\n")
        .Replace("\r", "\\n").Replace(";", "\\;").Replace(",", "\\,");
    public static IResult CalendarFile(Appointment a)
    {
        var lines = new[] {"BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//MAGS Booking//DA","CALSCALE:GREGORIAN",
            "BEGIN:VEVENT",$"UID:{a.Id:D}@book.mags.dk",$"DTSTAMP:{DateTime.UtcNow:yyyyMMdd'T'HHmmss'Z'}",
            $"DTSTART:{a.Start:yyyyMMdd'T'HHmmss'Z'}",$"DTEND:{a.End:yyyyMMdd'T'HHmmss'Z'}",
            "SUMMARY:"+IcsText(a.ServiceName+" hos "+a.SalonName),"LOCATION:"+IcsText(a.Address),
            "DESCRIPTION:"+IcsText(a.StaffName+" · "+a.Phone),"STATUS:"+(a.Status=="booked"?"CONFIRMED":"CANCELLED"),
            "END:VEVENT","END:VCALENDAR"};
        var text = new StringBuilder();
        foreach (var line in lines)
        {
            var count = 0;
            foreach (var ch in line.EnumerateRunes())
            {
                if (count + ch.Utf8SequenceLength > 75) { text.Append("\r\n "); count = 1; }
                text.Append(ch); count += ch.Utf8SequenceLength;
            }
            text.Append("\r\n");
        }
        return Results.File(Encoding.UTF8.GetBytes(text.ToString()), "text/calendar; charset=utf-8", "aftale.ics");
    }
}
