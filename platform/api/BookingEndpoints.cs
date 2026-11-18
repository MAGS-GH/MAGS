using Npgsql;

namespace SalonPlatform;

internal static class BookingEndpoints
{
    public static void MapSalonBookings(this WebApplication app)
    {
        var publicSalon = app.MapGroup("/api/public/salons/{slug}");
        publicSalon.MapGet("", async (string slug, NpgsqlDataSource ds) =>
        {
            await using var db = await ds.OpenConnectionAsync();
            var salon = await Published(db, slug);
            return await BookingSlots.Catalogue(db, salon);
        }).RequireRateLimiting("salon-read");
        publicSalon.MapGet("/availability", async (string slug, Guid serviceId, DateOnly? from, int? days, NpgsqlDataSource ds) =>
        {
            await using var db = await ds.OpenConnectionAsync();
            var salon = await Published(db, slug);
            var service = await SalonAppointments.Service(db, null, salon.Id, serviceId);
            return await AvailabilityFor(db, salon, service, from, days);
        }).RequireRateLimiting("salon-read");
        publicSalon.MapPost("/appointments", async (string slug, NewAppointment body, NpgsqlDataSource ds, GuestLinks links) =>
        {
            Guid id;
            await using (var db = await ds.OpenConnectionAsync()) id = (await BookingSlots.Salon(db, null, null, slug)).Id;
            return await SalonAppointments.Create(ds, links, id, body, null);
        }).RequireRateLimiting("salon-write");

        var guest = app.MapGroup("/api/guest/{token}");
        guest.MapGet("", async (string token, NpgsqlDataSource ds) => (await Guest(ds, token)).Receipt()).RequireRateLimiting("salon-read");
        guest.MapGet("/calendar.ics", async (string token, NpgsqlDataSource ds) =>
            SalonAppointments.CalendarFile(await Guest(ds, token))).RequireRateLimiting("salon-read");
        guest.MapGet("/availability", async (string token, DateOnly? from, int? days, NpgsqlDataSource ds) =>
        {
            await using var db = await ds.OpenConnectionAsync();
            var appointment = await SalonAppointments.ByToken(db, null, token);
            if (!appointment.CanChange) throw new SalonError(409, "Ring til salonen for at ændre aftalen.");
            var salon = await BookingSlots.Salon(db, null, appointment.SalonId, null);
            return await AvailabilityFor(db, salon, appointment.Terms, from, days, ignore: appointment.Id);
        }).RequireRateLimiting("salon-read");
        guest.MapPost("/move", async (string token, MoveAppointment body, NpgsqlDataSource ds) =>
        {
            var a = await Guest(ds, token);
            return await SalonAppointments.Change(ds, a.SalonId, a.Id, body, token, null);
        }).RequireRateLimiting("salon-write");
        guest.MapPost("/cancel", async (string token, NpgsqlDataSource ds) =>
        {
            var a = await Guest(ds, token);
            return await SalonAppointments.Change(ds, a.SalonId, a.Id, null, token, null);
        }).RequireRateLimiting("salon-write");

        var desk = app.MapGroup("/api/salons/{salonId:guid}").RequireAuthorization();
        desk.MapGet("/preview", async (Guid salonId, HttpContext ctx, NpgsqlDataSource ds) =>
        {
            var access = await Access(ctx, ds, salonId);
            if (!access.Manages) throw SalonAppointments.Forbidden();
            await using var db = await ds.OpenConnectionAsync();
            return await BookingSlots.Catalogue(db, await BookingSlots.Salon(db, null, salonId, null));
        });
        desk.MapGet("/availability", async (Guid salonId, Guid serviceId, DateOnly? from, int? days, Guid? appointmentId,
            bool? preview, HttpContext ctx, NpgsqlDataSource ds) =>
        {
            var access = await Access(ctx, ds, salonId);
            await using var db = await ds.OpenConnectionAsync();
            var salon = await BookingSlots.Salon(db, null, salonId, null);
            ServiceTerms terms;
            if (appointmentId.HasValue)
            {
                var appointment = await SalonAppointments.ById(db, null, salonId, appointmentId.Value);
                if (access.StaffId != null && access.StaffId != appointment.StaffId) throw BookingSlots.Missing();
                if (appointment.ServiceId != serviceId) throw new SalonError(400, "Vælg aftalens behandling.");
                terms = appointment.Terms;
            }
            else terms = await SalonAppointments.Service(db, null, salonId, serviceId);
            return await AvailabilityFor(db, salon, terms, from, days, preview != true, appointmentId, access.StaffId);
        });
        desk.MapPost("/appointments", async (Guid salonId, NewAppointment body, HttpContext ctx, NpgsqlDataSource ds, GuestLinks links) =>
        {
            await Access(ctx, ds, salonId);
            return await SalonAppointments.Create(ds, links, salonId, body, ctx);
        });
        desk.MapPost("/appointments/{id:guid}/move", async (Guid salonId, Guid id, MoveAppointment body, HttpContext ctx, NpgsqlDataSource ds) =>
        {
            await Access(ctx, ds, salonId);
            return await SalonAppointments.Change(ds, salonId, id, body, null, ctx);
        });
        desk.MapPost("/appointments/{id:guid}/cancel", async (Guid salonId, Guid id, HttpContext ctx, NpgsqlDataSource ds) =>
        {
            await Access(ctx, ds, salonId);
            return await SalonAppointments.Change(ds, salonId, id, null, null, ctx);
        });
        desk.MapGet("/calendar", Calendar);
        desk.MapPost("/blocks", CreateBlock);
        desk.MapDelete("/blocks/{id:guid}", DeleteBlock);
        desk.MapGet("/customers", Customers);
        desk.MapGet("/customers/{id:guid}", Customer);
        desk.MapPost("/customers/{id:guid}/anonymize", Anonymize);
    }
    static async Task<SalonCard> Published(NpgsqlConnection db, string slug)
    {
        var card = await BookingSlots.Salon(db, null, null, slug);
        return card.Status == "published" ? card : throw BookingSlots.Missing();
    }
    static async Task<Appointment> Guest(NpgsqlDataSource ds, string token)
    {
        await using var db = await ds.OpenConnectionAsync();
        return await SalonAppointments.ByToken(db, null, token);
    }
    static async Task<SalonAccess> Access(HttpContext ctx, NpgsqlDataSource ds, Guid id) =>
        await OpsAuth.Access(ctx, ds, id) ?? throw SalonAppointments.Forbidden();
    static async Task<Availability> AvailabilityFor(NpgsqlConnection db, SalonCard salon, ServiceTerms terms, DateOnly? from, int? days,
        bool desk = false, Guid? ignore = null, Guid? staff = null) => new(
            await BookingSlots.Options(db, null, salon.Id, terms, from ?? BookingSlots.Today, days ?? salon.HorizonDays + 1, desk, ignore, staff),
            await BookingSlots.Staff(db, null, salon.Id, staff));
    static async Task<object> Calendar(Guid salonId, DateOnly date, HttpContext ctx, NpgsqlDataSource ds)
    {
        var access = await Access(ctx, ds, salonId);
        await using var db = await ds.OpenConnectionAsync();
        const string window = """
            a.salon_id=@s AND a.starts_at < ((@d::date+1)::timestamp AT TIME ZONE 'Europe/Copenhagen')
            AND a.busy_until > (@d::date::timestamp AT TIME ZONE 'Europe/Copenhagen')
            AND (@staff::uuid IS NULL OR a.staff_id=@staff) ORDER BY a.starts_at,a.id
            """;
        var appointments = await SalonAppointments.Find(db, null, window, ("s", salonId), ("d", date), ("staff", access.StaffId));
        var blocks = await Pg.Query(db, null, """
            SELECT id,staff_id,starts_at,ends_at,reason FROM blocks WHERE salon_id=@s
              AND starts_at < ((@d::date+1)::timestamp AT TIME ZONE 'Europe/Copenhagen')
              AND ends_at > (@d::date::timestamp AT TIME ZONE 'Europe/Copenhagen')
              AND (@staff::uuid IS NULL OR staff_id=@staff) ORDER BY starts_at,id
            """, r => new { id = r.GetGuid(0), staffId = r.GetGuid(1), start = r.GetDateTime(2), end = r.GetDateTime(3), reason = r.GetString(4) },
            ("s", salonId), ("d", date), ("staff", access.StaffId));
        var people = await Pg.Query(db, null, """
            SELECT id,name,photo_url FROM staff WHERE salon_id=@s AND (@staff::uuid IS NULL OR id=@staff)
              AND (active OR id=ANY(@included)) ORDER BY name,id
            """, r => new StaffCard(r.GetGuid(0), r.GetString(1), r.Str(2)), ("s", salonId), ("staff", access.StaffId),
            ("included", appointments.Select(a => a.StaffId).Concat(blocks.Select(b => b.staffId)).Distinct().ToArray()));
        return new { date, staff = people, appointments = appointments.Select(a => a.Desk()), blocks };
    }
    static async Task<object> CreateBlock(Guid salonId, NewBlock body, HttpContext ctx, NpgsqlDataSource ds)
    {
        var access = await Access(ctx, ds, salonId);
        if (access.StaffId != null && access.StaffId != body.StaffId) throw SalonAppointments.Forbidden();
        var reason = body.Reason?.Trim() ?? "";
        if (body.End <= body.Start || (body.End - body.Start).TotalDays > 366 || reason.Length is < 1 or > 150)
            throw new SalonError(400, "Angiv en årsag og en gyldig periode.");
        await using var db = await ds.OpenConnectionAsync();
        await using var tx = await db.BeginTransactionAsync();
        await Pg.Lock(db, tx, salonId);
        access = await OpsAuth.Access(ctx, db, tx, salonId) ?? throw SalonAppointments.Forbidden();
        if (access.StaffId != null && access.StaffId != body.StaffId) throw SalonAppointments.Forbidden();
        var overlap = await SalonAppointments.Find(db, tx,
            "a.salon_id=@s AND a.staff_id=@staff AND a.status='booked' AND a.starts_at<@end AND a.busy_until>@start ORDER BY a.starts_at",
            ("s", salonId), ("staff", body.StaffId), ("start", body.Start.UtcDateTime), ("end", body.End.UtcDateTime));
        if (overlap.Count > 0) return Results.Conflict(new { error = "Flyt de berørte aftaler, før du blokerer tiden.", appointments = overlap.Select(a => a.Desk()) });
        var id = Guid.NewGuid();
        await Pg.Exec(db, tx, "INSERT INTO blocks(id,salon_id,staff_id,starts_at,ends_at,reason) VALUES(@id,@s,@staff,@start,@end,@reason)",
            ("id", id), ("s", salonId), ("staff", body.StaffId), ("start", body.Start.UtcDateTime), ("end", body.End.UtcDateTime), ("reason", reason));
        await OpsData.Audit(db, tx, salonId, OpsAuth.Subject(ctx).ToString(), "block.create", id);
        await tx.CommitAsync();
        return new { id };
    }
    static async Task<IResult> DeleteBlock(Guid salonId, Guid id, HttpContext ctx, NpgsqlDataSource ds)
    {
        var access = await Access(ctx, ds, salonId);
        await using var db = await ds.OpenConnectionAsync();
        await using var tx = await db.BeginTransactionAsync();
        await Pg.Lock(db, tx, salonId);
        access = await OpsAuth.Access(ctx, db, tx, salonId) ?? throw SalonAppointments.Forbidden();
        await using var cmd = Pg.Cmd(db, tx, "DELETE FROM blocks WHERE salon_id=@s AND id=@id AND (@staff::uuid IS NULL OR staff_id=@staff)",
            ("s", salonId), ("id", id), ("staff", access.StaffId));
        if (await cmd.ExecuteNonQueryAsync() == 0) throw BookingSlots.Missing();
        await OpsData.Audit(db, tx, salonId, OpsAuth.Subject(ctx).ToString(), "block.delete", id);
        await tx.CommitAsync();
        return Results.Ok(new { id });
    }
    const string CustomerScope = """
        c.salon_id=@s AND NOT c.anonymized AND (@staff::uuid IS NULL OR EXISTS(
            SELECT 1 FROM appointments a WHERE a.salon_id=c.salon_id AND a.customer_id=c.id AND a.staff_id=@staff))
        """;
    static async Task<object> Customers(Guid salonId, string? q, HttpContext ctx, NpgsqlDataSource ds)
    {
        var access = await Access(ctx, ds, salonId);
        var search = (q ?? "").Trim();
        if (search.Length > 120) throw new SalonError(400, "Forkort din søgning.");
        await using var db = await ds.OpenConnectionAsync();
        var customers = await Pg.Query(db, null, "SELECT c.id,c.name,c.phone FROM customers c WHERE " + CustomerScope +
            " AND (strpos(lower(c.name),lower(@q))>0 OR strpos(c.phone,@q)>0 OR strpos(c.phone_key,@q)>0) ORDER BY c.name,c.id LIMIT 100",
            r => new { id = r.GetGuid(0), name = r.GetString(1), phone = r.GetString(2) }, ("s", salonId), ("staff", access.StaffId), ("q", search));
        return new { customers };
    }
    static async Task<object> Customer(Guid salonId, Guid id, HttpContext ctx, NpgsqlDataSource ds)
    {
        var access = await Access(ctx, ds, salonId);
        await using var db = await ds.OpenConnectionAsync();
        var data = (await Pg.Query(db, null, "SELECT c.name,c.phone FROM customers c WHERE c.id=@id AND " + CustomerScope,
            r => new { name = r.GetString(0), phone = r.GetString(1) }, ("id", id), ("s", salonId), ("staff", access.StaffId))).FirstOrDefault() ?? throw BookingSlots.Missing();
        var appointments = await SalonAppointments.Find(db, null,
            "a.salon_id=@s AND a.customer_id=@id AND (@staff::uuid IS NULL OR a.staff_id=@staff) ORDER BY a.starts_at DESC",
            ("s", salonId), ("id", id), ("staff", access.StaffId));
        return new { id, data.name, data.phone, appointments = appointments.Select(a => a.Desk()) };
    }
    static async Task<IResult> Anonymize(Guid salonId, Guid id, HttpContext ctx, NpgsqlDataSource ds)
    {
        var access = await Access(ctx, ds, salonId);
        if (!access.Manages) throw SalonAppointments.Forbidden();
        await using var db = await ds.OpenConnectionAsync();
        await using var tx = await db.BeginTransactionAsync();
        await Pg.Lock(db, tx, salonId);
        if ((await OpsAuth.Access(ctx, db, tx, salonId))?.Manages != true) throw SalonAppointments.Forbidden();
        await using var future = Pg.Cmd(db, tx, "SELECT 1 FROM appointments WHERE salon_id=@s AND customer_id=@id AND status='booked' AND ends_at>now() LIMIT 1",
            ("s", salonId), ("id", id));
        if (await future.ExecuteScalarAsync() != null) throw new SalonError(409, "Afslut eller aflys kundens kommende aftaler først.");
        await using var customer = Pg.Cmd(db, tx, "UPDATE customers SET name='Anonymiseret kunde',phone='',phone_key='',anonymized=true WHERE salon_id=@s AND id=@id",
            ("s", salonId), ("id", id));
        if (await customer.ExecuteNonQueryAsync() == 0) throw BookingSlots.Missing();
        await Pg.Exec(db, tx, "UPDATE appointments SET token_hash=NULL,request_hash='' WHERE salon_id=@s AND customer_id=@id", ("s", salonId), ("id", id));
        await OpsData.Audit(db, tx, salonId, OpsAuth.Subject(ctx).ToString(), "customer.anonymize", id);
        await tx.CommitAsync();
        return Results.Ok(new { id });
    }
}
