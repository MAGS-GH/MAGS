using System.Text.RegularExpressions;
using System.Text.Json;
using Npgsql;
using static SalonPlatform.OpsData;

namespace SalonPlatform;

public static partial class OpsEndpoints
{
    private const string SalonFields = """
        id,name,slug,status,address,phone,accent,logo_url AS "logoUrl",cover_url AS "coverUrl",
        slot_minutes AS "slotMinutes",horizon_days AS "horizonDays",notice_hours AS "noticeHours",change_hours AS "changeHours"
        """;
    private const string ServiceFields = """
        id,name,description,price_ore AS "priceOre",duration_minutes AS "durationMinutes",
        cleanup_minutes AS "cleanupMinutes",photo_url AS "photoUrl",active
        """;
    private const string StaffFields = """
        p.id,p.name,p.photo_url AS "photoUrl",p.active,
        ARRAY(SELECT ss.service_id FROM staff_services ss WHERE ss.salon_id=p.salon_id AND ss.staff_id=p.id ORDER BY ss.service_id) AS "serviceIds",
        COALESCE((SELECT json_agg(json_build_object('weekday',v.weekday,'startMin',v.start_min,'endMin',v.end_min) ORDER BY weekday,start_min)
          FROM shifts v WHERE v.salon_id=p.salon_id AND v.staff_id=p.id),'[]'::json) AS shifts,
        COALESCE((SELECT json_agg(json_build_object('date',v.date,'startMin',v.start_min,'endMin',v.end_min) ORDER BY date,start_min)
          FROM shift_exceptions v WHERE v.salon_id=p.salon_id AND v.staff_id=p.id),'[]'::json) AS exceptions
        """;

    public static void MapSalonOps(this WebApplication app)
    {
        var api = app.MapGroup("/api").RequireAuthorization();
        api.MapGet("/me", Me);
        api.MapGet("/admin/salons", ListSalons);
        api.MapPost("/admin/salons", CreateSalon);
        api.MapPost("/invitations/redeem", Redeem);
        var salon = api.MapGroup("/salons/{id:guid}");
        salon.MapGet("/setup", Setup);
        salon.MapPut("/settings", Settings);
        salon.MapPut("/publication", Publish);
        salon.MapPost("/services", (HttpContext c,NpgsqlDataSource d,Guid id,ServiceInput b) => SaveService(c,d,id,null,b));
        salon.MapPut("/services/{serviceId:guid}", (HttpContext c,NpgsqlDataSource d,Guid id,Guid serviceId,ServiceInput b) => SaveService(c,d,id,serviceId,b));
        salon.MapPost("/staff", (HttpContext c,NpgsqlDataSource d,Guid id,StaffInput b) => SaveStaff(c,d,id,null,b));
        salon.MapPut("/staff/{staffId:guid}", (HttpContext c,NpgsqlDataSource d,Guid id,Guid staffId,StaffInput b) => SaveStaff(c,d,id,staffId,b));
        salon.MapPost("/invites", Invite);
        salon.MapDelete("/invites/{inviteId:guid}", DeleteInvite);
        salon.MapDelete("/members/{sub:guid}", RemoveMember);
        salon.MapGet("/audit", AuditLog);
        salon.MapGet("/export", Export);
        salon.MapPost("/media", Upload);
        app.MapGet("/api/media/{id:guid}/{mediaId:guid}", Media);
    }

    private static async Task<IResult> Me(HttpContext ctx,NpgsqlDataSource source)
    {
        var sub = OpsAuth.Subject(ctx);
        await using var db = await source.OpenConnectionAsync(ctx.RequestAborted);
        var salons = await Rows(db,null,"""
            SELECT s.id,s.name,s.slug,s.status,m.role,m.staff_id AS "staffId"
            FROM members m JOIN salons s ON s.id=m.salon_id WHERE m.sub=@sub ORDER BY s.name
            """,("sub",sub));
        return Results.Ok(new {sub,admin=OpsAuth.IsAdmin(ctx),salons});
    }

    private static void RequireAdmin(HttpContext ctx)
    {
        if (!OpsAuth.IsAdmin(ctx)) throw new SalonError(403,"Kun MAGS-administratoren har adgang.");
    }

    private static async Task<IResult> ListSalons(HttpContext ctx,NpgsqlDataSource source)
    {
        RequireAdmin(ctx);
        await using var db = await source.OpenConnectionAsync(ctx.RequestAborted);
        return Results.Ok(await Rows(db,null,$"SELECT {SalonFields} FROM salons ORDER BY name,id"));
    }

    public sealed record NewSalon(string Name,string Slug,string? Address,string? Phone);
    private static async Task<IResult> CreateSalon(HttpContext ctx,NpgsqlDataSource source,NewSalon input)
    {
        RequireAdmin(ctx);
        var slug = Text(input.Slug,64,true).ToLowerInvariant();
        if (slug.Length < 2 || !Regex.IsMatch(slug,"^[a-z0-9]+(?:-[a-z0-9]+)*$"))
            throw new SalonError(400,"Salonens link skal bestå af små bogstaver, tal og enkelte bindestreger.");
        var id = Guid.NewGuid();
        await using var db = await source.OpenConnectionAsync(ctx.RequestAborted);
        await using var tx = await db.BeginTransactionAsync(ctx.RequestAborted);
        var created = await Execute(db,tx,"INSERT INTO salons(id,name,slug,address,phone) VALUES(@id,@name,@slug,@a,@p) ON CONFLICT(slug) DO NOTHING",
            ("id",id),("name",Text(input.Name,120,true)),("slug",slug),("a",Text(input.Address,200)),("p",Text(input.Phone,40)));
        if (created == 0) throw new SalonError(409,"Bookinglinket bruges allerede af en anden salon.");
        await Audit(db,tx,id,OpsAuth.Subject(ctx).ToString(),"salon.created",id);
        var salon = (await Rows(db,tx,$"SELECT {SalonFields} FROM salons WHERE id=@s",("s",id)))[0];
        await tx.CommitAsync(ctx.RequestAborted);
        return Results.Created($"/api/salons/{id}/setup",salon);
    }

    private static async Task<string[]> Missing(NpgsqlConnection db, NpgsqlTransaction? tx, Guid id, JsonElement salon, JsonElement[] services, JsonElement[] personnel)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(salon.GetProperty("phone").GetString())) missing.Add("Tilføj salonens telefonnummer.");
        if (string.IsNullOrWhiteSpace(salon.GetProperty("address").GetString())) missing.Add("Tilføj salonens adresse.");
        if (!services.Any(s => s.GetProperty("active").GetBoolean())) missing.Add("Opret en aktiv behandling.");
        if (!personnel.Any(p => p.GetProperty("active").GetBoolean() && p.GetProperty("serviceIds").GetArrayLength() > 0))
            missing.Add("Tilknyt en frisør til en behandling.");
        if (missing.Count == 0 && !await BookingSlots.HasFutureAsync(db,tx,id))
            missing.Add("Planlæg mindst én ledig tid i bookingperioden.");
        return missing.ToArray();
    }

    private static async Task<IResult> Setup(HttpContext ctx,NpgsqlDataSource source,Guid id)
    {
        var access = await OpsAuth.Access(ctx,source,id) ?? throw new SalonError(403,"Du har ikke adgang til salonen.");
        await using var db = await source.OpenConnectionAsync(ctx.RequestAborted);
        var salon = (await Rows(db,null,$"SELECT {SalonFields} FROM salons WHERE id=@s",("s",id))).FirstOrDefault();
        if (salon.ValueKind == JsonValueKind.Undefined) throw new SalonError(404,"Salonen findes ikke.");
        var services = await Rows(db,null,$"SELECT {ServiceFields} FROM services WHERE salon_id=@s ORDER BY name,id",("s",id));
        var staff = access.Role == "staff"
            ? await Rows(db,null,$"SELECT {StaffFields} FROM staff p WHERE p.salon_id=@s AND p.id=@employee",("s",id),("employee",access.StaffId))
            : await Rows(db,null,$"SELECT {StaffFields} FROM staff p WHERE p.salon_id=@s ORDER BY p.name,p.id",("s",id));
        var members = access.Manages ? await Rows(db,null,"""SELECT sub,role,staff_id AS "staffId",display_name AS "name" FROM members WHERE salon_id=@s ORDER BY role,display_name,sub""",("s",id)) : [];
        var invitations = access.Manages ? await Rows(db,null,"""SELECT id,role,staff_id AS "staffId",expires_at AS "expiresAt" FROM invitations WHERE salon_id=@s AND consumed_at IS NULL AND expires_at>now() ORDER BY expires_at""",("s",id)) : [];
        var missing = access.Manages ? await Missing(db,null,id,salon,services,staff) : [];
        return Results.Ok(new {salon, services, staff, members, invitations, readiness=new {ready=access.Manages && missing.Length==0,missing}});
    }

    public sealed record SalonSettings(string Name,string? Address,string? Phone,string Accent,string? LogoUrl,string? CoverUrl,
        int SlotMinutes,int HorizonDays,int NoticeHours,int ChangeHours);
    private static Task<IResult> Settings(HttpContext ctx,NpgsqlDataSource source,Guid id,SalonSettings input) => Manage(ctx,source,id,async (db,tx) =>
    {
        if (input.SlotMinutes is not (5 or 10 or 15 or 20 or 30 or 60) || input.HorizonDays is < 1 or > 365 ||
            input.NoticeHours is < 0 or > 168 || input.ChangeHours is < 0 or > 168 || !Regex.IsMatch(input.Accent ?? "", "^#[0-9A-Fa-f]{6}$"))
            throw new SalonError(400,"Kontrollér bookingreglerne og salonens accentfarve.");
        var address = Text(input.Address,200);
        var phone = Text(input.Phone,40);
        var changed = await Execute(db,tx,"""
            UPDATE salons SET name=@n,address=@a,phone=@p,accent=@accent,logo_url=@logo,cover_url=@cover,
              slot_minutes=@slot,horizon_days=@horizon,notice_hours=@notice,change_hours=@change
            WHERE id=@s AND (status<>'published' OR (@a<>'' AND @p<>''))
            """,("s",id),("n",Text(input.Name,120,true)),("a",address),("p",phone),("accent",input.Accent),
            ("logo",Image(input.LogoUrl,id)),("cover",Image(input.CoverUrl,id)),("slot",input.SlotMinutes),
            ("horizon",input.HorizonDays),("notice",input.NoticeHours),("change",input.ChangeHours));
        if (changed == 0) throw new SalonError(400,"En åben salon skal have adresse og telefonnummer.");
        await Audit(db,tx,id,OpsAuth.Subject(ctx).ToString(),"settings.updated",id);
        return Results.Ok(new {id});
    });

    public sealed record Publication(string Status);
    private static Task<IResult> Publish(HttpContext ctx,NpgsqlDataSource source,Guid id,Publication input) => Manage(ctx,source,id,async (db,tx) =>
    {
        if (input.Status is not ("paused" or "published")) throw new SalonError(400,"Vælg åben eller pauset.");
        if (input.Status == "published")
        {
            var salon = (await Rows(db,tx,$"SELECT {SalonFields} FROM salons WHERE id=@s",("s",id)))[0];
            var services = await Rows(db,tx,$"SELECT {ServiceFields} FROM services WHERE salon_id=@s",("s",id));
            var staff = await Rows(db,tx,$"SELECT {StaffFields} FROM staff p WHERE p.salon_id=@s",("s",id));
            var missing = await Missing(db,tx,id,salon,services,staff);
            if (missing.Length > 0) return Results.Json(new {error=string.Join(" ",missing),missing},statusCode:409);
        }
        await Execute(db,tx,"UPDATE salons SET status=@status WHERE id=@s",("s",id),("status",input.Status));
        await Audit(db,tx,id,OpsAuth.Subject(ctx).ToString(),$"salon.{input.Status}",id);
        return Results.Ok(new {status=input.Status});
    });
}
