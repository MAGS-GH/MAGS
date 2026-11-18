using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace SalonPlatform;

internal static class OpsData
{
    public static NpgsqlCommand Command(NpgsqlConnection db, NpgsqlTransaction? tx, string sql, params (string,object?)[] args)
    {
        var cmd = new NpgsqlCommand(sql,db,tx);
        foreach (var (key,value) in args)
        {
            if (value is null) cmd.Parameters.AddWithValue(key,NpgsqlDbType.Unknown,DBNull.Value);
            else cmd.Parameters.AddWithValue(key,value);
        }
        return cmd;
    }

    public static async Task<int> Execute(NpgsqlConnection db, NpgsqlTransaction tx, string sql, params (string,object?)[] args)
    {
        await using var cmd = Command(db,tx,sql,args);
        return await cmd.ExecuteNonQueryAsync();
    }

    public static async Task<JsonElement[]> Rows(NpgsqlConnection db, NpgsqlTransaction? tx, string select, params (string,object?)[] args)
    {
        await using var cmd = Command(db,tx,$"SELECT row_to_json(t)::text FROM ({select}) AS t",args);
        await using var reader = await cmd.ExecuteReaderAsync();
        var rows = new List<JsonElement>();
        while (await reader.ReadAsync()) rows.Add(JsonSerializer.Deserialize<JsonElement>(reader.GetString(0)));
        return rows.ToArray();
    }

    public static Task Audit(NpgsqlConnection db,NpgsqlTransaction tx,Guid salonId,string? actor,string action,Guid? entityId) =>
        Execute(db,tx,"INSERT INTO audit_events(salon_id,actor_sub,action,entity_id) VALUES(@s,@u,@a,@e)",
            ("s",salonId),("u",actor),("a",action),("e",entityId));

    public static async Task LockSalon(NpgsqlConnection db, NpgsqlTransaction tx, Guid id)
    {
        await using var cmd = Command(db,tx,"SELECT id FROM salons WHERE id=@s FOR UPDATE",("s",id));
        if (await cmd.ExecuteScalarAsync() is null) throw new SalonError(404,"Salonen findes ikke.");
    }

    public static async Task<IResult> Manage(HttpContext ctx,NpgsqlDataSource source,Guid id,Func<NpgsqlConnection,NpgsqlTransaction,Task<IResult>> action)
    {
        // Check before locking so another salon's users cannot queue work on its booking lock.
        if ((await OpsAuth.Access(ctx,source,id))?.Manages != true) throw new SalonError(403,"Du har ikke adgang til at administrere denne salon.");
        await using var db = await source.OpenConnectionAsync(ctx.RequestAborted);
        await using var tx = await db.BeginTransactionAsync(ctx.RequestAborted);
        await LockSalon(db,tx,id);
        if ((await OpsAuth.Access(ctx,db,tx,id))?.Manages != true) throw new SalonError(403,"Din adgang er ophørt.");
        var result = await action(db,tx);
        if (result is not IStatusCodeHttpResult { StatusCode: >= 400 }) await tx.CommitAsync(ctx.RequestAborted);
        return result;
    }

    public static string Text(string? value, int max, bool required = false)
    {
        var text = (value ?? "").Trim();
        if ((required && text.Length == 0) || text.Length > max || text.Any(c => char.IsControl(c) && c is not '\r' and not '\n' and not '\t'))
            throw new SalonError(400, "Kontrollér længden og indholdet af tekstfeltet.");
        return text;
    }

    public static string Image(string? value, Guid salon)
    {
        var url = Text(value, 2048);
        if (url.Length == 0) return url;
        var prefix = $"/api/media/{salon}/";
        if (url.StartsWith(prefix, StringComparison.Ordinal) && Guid.TryParseExact(url[prefix.Length..],"D",out _)) return url;
        if (Uri.TryCreate(url,UriKind.Absolute,out var uri) && uri.Scheme == Uri.UriSchemeHttps && string.IsNullOrEmpty(uri.UserInfo)) return uri.AbsoluteUri;
        throw new SalonError(400,"Vælg et uploadet billede eller en gyldig HTTPS-billedadresse.");
    }
}
