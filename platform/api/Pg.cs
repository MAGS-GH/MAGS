using System.Reflection;
using Npgsql;

namespace SalonPlatform;

internal static class Pg
{
    public static NpgsqlCommand Cmd(NpgsqlConnection connection, NpgsqlTransaction? tx, string sql,
        params (string Name, object? Value)[] args)
    {
        return OpsData.Command(connection, tx, sql, args);
    }

    public static async Task<List<T>> Query<T>(NpgsqlConnection db, NpgsqlTransaction? tx, string sql,
        Func<NpgsqlDataReader, T> map, params (string, object?)[] args)
    {
        await using var cmd = Cmd(db, tx, sql, args);
        await using var reader = await cmd.ExecuteReaderAsync();
        List<T> rows = [];
        while (await reader.ReadAsync()) rows.Add(map(reader));
        return rows;
    }

    public static async Task Exec(NpgsqlConnection db, NpgsqlTransaction? tx, string sql, params (string, object?)[] args)
    {
        await using var cmd = Cmd(db, tx, sql, args);
        await cmd.ExecuteNonQueryAsync();
    }

    public static string? Str(this NpgsqlDataReader reader, int index) => reader.IsDBNull(index) ? null : reader.GetString(index);
    public static Task Lock(NpgsqlConnection db, NpgsqlTransaction tx, Guid salonId) =>
        OpsData.LockSalon(db, tx, salonId);

    public static async Task Migrate(NpgsqlDataSource ds)
    {
        await using var db = await ds.OpenConnectionAsync();
        await using var tx = await db.BeginTransactionAsync();
        await Exec(db, tx, "SELECT pg_advisory_xact_lock(279846215); CREATE TABLE IF NOT EXISTS salon_schema_history (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
        var assembly = Assembly.GetExecutingAssembly();
        foreach (var name in assembly.GetManifestResourceNames().Where(n => n.EndsWith(".sql")).Order(StringComparer.Ordinal))
        {
            await using var exists = Cmd(db, tx, "SELECT 1 FROM salon_schema_history WHERE filename=@name", ("name", name));
            if (await exists.ExecuteScalarAsync() != null) continue;
            using var reader = new StreamReader(assembly.GetManifestResourceStream(name)!);
            await Exec(db, tx, await reader.ReadToEndAsync());
            await Exec(db, tx, "INSERT INTO salon_schema_history(filename) VALUES (@name)", ("name", name));
        }
        await tx.CommitAsync();
    }
}
