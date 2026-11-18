using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Npgsql;
using static SalonPlatform.OpsData;

namespace SalonPlatform;

public static partial class OpsEndpoints
{
    public sealed record InviteInput(string Role,Guid? StaffId);
    public sealed record RedeemInput(string Token);

    private static Task<IResult> Invite(HttpContext ctx,NpgsqlDataSource source,Guid id,InviteInput input) => Manage(ctx,source,id,async (db,tx) =>
    {
        if (input.Role is not ("owner" or "reception" or "staff") || (input.Role == "staff") != input.StaffId.HasValue)
            throw new SalonError(400,"Vælg en gyldig rolle og den tilhørende medarbejder.");
        if (input.StaffId.HasValue)
        {
            await using var check = Command(db,tx,"""
                SELECT 1 FROM staff p WHERE p.id=@i AND p.salon_id=@s AND active AND NOT EXISTS(
                  SELECT 1 FROM members m WHERE m.salon_id=@s AND m.staff_id=p.id)
                """,("s",id),("i",input.StaffId.Value));
            if (await check.ExecuteScalarAsync() is null) throw new SalonError(409,"Vælg en aktiv medarbejder uden en tilknyttet bruger.");
        }
        var inviteId = Guid.NewGuid();
        var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var expires = DateTime.UtcNow.AddHours(72);
        await Execute(db,tx,"""
            INSERT INTO invitations(id,salon_id,role,staff_id,token_hash,expires_at,created_by) VALUES(@i,@s,@r,@f,@t,@e,@u)
            """,("i",inviteId),("s",id),("r",input.Role),("f",input.StaffId),("t",Hash(token)),("e",expires),("u",OpsAuth.Subject(ctx)));
        await Audit(db,tx,id,OpsAuth.Subject(ctx).ToString(),"invitation.created",inviteId);
        return Results.Ok(new {id=inviteId,token,expiresAt=expires});
    });

    private static byte[] Hash(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));

    private static async Task<IResult> Redeem(HttpContext ctx,NpgsqlDataSource source,RedeemInput input)
    {
        if (input.Token?.Length != 43) throw new SalonError(400,"Invitationslinket er ugyldigt.");
        var hash = Hash(input.Token);
        var subject = OpsAuth.Subject(ctx);
        await using var db = await source.OpenConnectionAsync(ctx.RequestAborted);
        await using var tx = await db.BeginTransactionAsync(ctx.RequestAborted);
        // Lock the salon first, in the same order as revocations and role changes.
        await using var lookup = Command(db,tx,"SELECT salon_id FROM invitations WHERE token_hash=@t",("t",hash));
        if (await lookup.ExecuteScalarAsync() is not Guid salonId) throw new SalonError(410,"Invitationen er udløbet eller allerede brugt.");
        await LockSalon(db,tx,salonId);
        await using var find = Command(db,tx,"""
            SELECT id,role,staff_id FROM invitations WHERE token_hash=@t AND consumed_at IS NULL AND expires_at>now() FOR UPDATE
            """,("t",hash));
        Guid invitationId;
        string role;
        Guid? staffId;
        await using (var reader = await find.ExecuteReaderAsync())
        {
            if (!await reader.ReadAsync()) throw new SalonError(410,"Invitationen er udløbet eller allerede brugt.");
            invitationId = reader.GetGuid(0);
            role = reader.GetString(1);
            staffId = reader.IsDBNull(2) ? null : reader.GetGuid(2);
        }
        if (staffId.HasValue)
        {
            await using var active = Command(db,tx,"SELECT 1 FROM staff WHERE salon_id=@s AND id=@f AND active",("s",salonId),("f",staffId));
            if (await active.ExecuteScalarAsync() is null) throw new SalonError(410,"Medarbejderen er ikke længere aktiv.");
        }
        var displayName = (ctx.User.FindFirst("name")?.Value ?? "").Trim();
        if (displayName.Length > 160) displayName = displayName[..160];
        var joined = await Execute(db,tx,"INSERT INTO members(salon_id,sub,role,staff_id,display_name) VALUES(@s,@u,@r,@f,@label) ON CONFLICT DO NOTHING",
            ("s",salonId),("u",subject),("r",role),("f",staffId),("label",displayName));
        if (joined==0) throw new SalonError(409,"Brugeren eller medarbejderen har allerede en adgang i salonen.");
        await Execute(db,tx,"UPDATE invitations SET consumed_at=now() WHERE id=@i",("i",invitationId));
        await Audit(db,tx,salonId,subject.ToString(),"invitation.redeemed",invitationId);
        await tx.CommitAsync(ctx.RequestAborted);
        return Results.Ok(new {salonId});
    }

    private static Task<IResult> DeleteInvite(HttpContext ctx,NpgsqlDataSource source,Guid id,Guid inviteId) => Manage(ctx,source,id,async (db,tx) =>
    {
        var deleted = await Execute(db,tx,"DELETE FROM invitations WHERE id=@i AND salon_id=@s AND consumed_at IS NULL",("s",id),("i",inviteId));
        if (deleted == 0) throw new SalonError(404,"Invitationen er ikke tilgængelig.");
        await Audit(db,tx,id,OpsAuth.Subject(ctx).ToString(),"invitation.revoked",inviteId);
        return Results.NoContent();
    });

    private static Task<IResult> RemoveMember(HttpContext ctx,NpgsqlDataSource source,Guid id,Guid sub) => Manage(ctx,source,id,async (db,tx) =>
    {
        await using var read = Command(db,tx,"SELECT role FROM members WHERE salon_id=@s AND sub=@u",("s",id),("u",sub));
        if (await read.ExecuteScalarAsync() is not string role) throw new SalonError(404,"Brugeren findes ikke i salonen.");
        if (role == "owner")
        {
            await using var check = Command(db,tx,"SELECT 1 FROM members WHERE salon_id=@s AND role='owner' AND sub<>@u LIMIT 1",("s",id),("u",sub));
            if (await check.ExecuteScalarAsync() is null && !OpsAuth.IsAdmin(ctx))
                throw new SalonError(409,"Tilføj en anden ejer, før den sidste ejer fjernes.");
        }
        await Execute(db,tx,"""
            DELETE FROM invitations WHERE salon_id=@s AND consumed_at IS NULL AND (created_by=@u OR staff_id IN (
              SELECT staff_id FROM members WHERE salon_id=@s AND sub=@u));
            DELETE FROM members WHERE salon_id=@s AND sub=@u
            """,("s",id),("u",sub));
        await Audit(db,tx,id,OpsAuth.Subject(ctx).ToString(),"membership.revoked",sub);
        return Results.NoContent();
    });

    private static async Task<IResult> AuditLog(HttpContext ctx,NpgsqlDataSource source,Guid id)
    {
        if ((await OpsAuth.Access(ctx,source,id))?.Manages != true) throw new SalonError(403,"Kun salonejeren har adgang til loggen.");
        await using var db = await source.OpenConnectionAsync(ctx.RequestAborted);
        return Results.Ok(await Rows(db,null,"""
            SELECT action,actor_sub AS "actorSub",entity_id AS "entityId",created_at AS "createdAt"
            FROM audit_events WHERE salon_id=@s ORDER BY id DESC LIMIT 100
            """,("s",id)));
    }

    private static Task<IResult> Export(HttpContext ctx,NpgsqlDataSource source,Guid id) => Manage(ctx,source,id,async (db,tx) =>
    {
        var args = new (string,object?)[] {("s",id)};
        var salon = (await Rows(db,tx,$"SELECT {SalonFields} FROM salons WHERE id=@s",args))[0];
        var services = await Rows(db,tx,$"SELECT {ServiceFields} FROM services WHERE salon_id=@s ORDER BY id",args);
        var staff = await Rows(db,tx,$"SELECT {StaffFields} FROM staff p WHERE p.salon_id=@s ORDER BY p.id",args);
        var customers = await Rows(db,tx,"SELECT id,name,phone,anonymized FROM customers WHERE salon_id=@s ORDER BY id",args);
        var appointments = await Rows(db,tx,"""
            SELECT id,customer_id AS "customerId",staff_id AS "staffId",service_id AS "serviceId",service_name AS "serviceName",
              price_ore AS "priceOre",duration_minutes AS "durationMinutes",cleanup_minutes AS "cleanupMinutes",starts_at AS "startsAt",
              ends_at AS "endsAt",busy_until AS "busyUntil",status,created_at AS "createdAt" FROM appointments WHERE salon_id=@s ORDER BY starts_at,id
            """,args);
        var blocks = await Rows(db,tx,"""
            SELECT id,staff_id AS "staffId",starts_at AS "startsAt",ends_at AS "endsAt",reason FROM blocks WHERE salon_id=@s ORDER BY starts_at,id
            """,args);
        await Audit(db,tx,id,OpsAuth.Subject(ctx).ToString(),"salon.exported",id);
        ctx.Response.Headers.CacheControl = "no-store";
        ctx.Response.Headers.ContentDisposition = $"attachment; filename=salon-{id}.json";
        return Results.Ok(new {exportedAt=DateTime.UtcNow,salon,staff,services,customers,appointments,blocks});
    });
}
