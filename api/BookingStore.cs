using Npgsql;

namespace Mags.Booking;

public sealed record Reservation(Guid Key, string RequestHash, DateTimeOffset Start, string State, string? EventId, DateTimeOffset UpdatedAt, string? ErrorCode)
{
    public Slot Slot => new(Start, Start.AddMinutes(30));
}

public sealed class BookingStore(NpgsqlDataSource data)
{
    private const string Columns = "id, request_hash, starts_at, state, event_id, updated_at, error_code";
    private readonly SemaphoreSlim _migrationLock = new(1, 1);
    private volatile bool _initialized;

    public async Task InitializeAsync(CancellationToken ct)
    {
        if (_initialized) return;
        await _migrationLock.WaitAsync(ct);
        try
        {
            if (_initialized) return;
            await using var connection = await data.OpenConnectionAsync(ct);
            await using var transaction = await connection.BeginTransactionAsync(ct);
            await using var command = new NpgsqlCommand("""
                select pg_advisory_xact_lock(46436490);
                create table if not exists booking_reservations (
                    id uuid primary key,
                    request_hash text not null,
                    starts_at timestamptz not null,
                    state text not null check (state in ('held', 'sending', 'confirmed', 'closed', 'failed')),
                    event_id text,
                    updated_at timestamptz not null,
                    first_sent_at timestamptz,
                    retried boolean not null default false,
                    error_code text
                );
                create unique index if not exists booking_active_slot
                    on booking_reservations (starts_at)
                    where state in ('held', 'sending', 'confirmed');
                create table if not exists booking_attempts (
                    key text not null,
                    bucket timestamptz not null,
                    count integer not null,
                    primary key (key, bucket)
                );
                """, connection, transaction);
            await command.ExecuteNonQueryAsync(ct);
            await transaction.CommitAsync(ct);
            _initialized = true;
        }
        finally
        {
            _migrationLock.Release();
        }
    }

    public async Task<Reservation?> FindAsync(Guid key, CancellationToken ct)
    {
        await using var command = data.CreateCommand($"select {Columns} from booking_reservations where id = @id");
        command.Parameters.AddWithValue("id", key);
        return (await ReadAsync(command, ct)).SingleOrDefault();
    }

    public async Task<IReadOnlyList<Reservation>> ActiveAsync(Slot window, CancellationToken ct)
    {
        await using var command = data.CreateCommand($"""
            select {Columns} from booking_reservations
            where state in ('held', 'sending', 'confirmed') and starts_at >= @start and starts_at < @end
            """);
        command.Parameters.AddWithValue("start", window.Start);
        command.Parameters.AddWithValue("end", window.End);
        return await ReadAsync(command, ct);
    }

    public async Task<bool> HoldAsync(BookingRequest request, DateTimeOffset now, CancellationToken ct)
    {
        await using var command = data.CreateCommand("""
            insert into booking_reservations (id, request_hash, starts_at, state, updated_at)
            values (@id, @requestHash, @startsAt, 'held', @now) on conflict do nothing
            """);
        command.Parameters.AddWithValue("id", request.Key);
        command.Parameters.AddWithValue("requestHash", request.RequestHash);
        command.Parameters.AddWithValue("startsAt", request.Slot.Start);
        command.Parameters.AddWithValue("now", now);
        return await command.ExecuteNonQueryAsync(ct) == 1;
    }

    public async Task<bool> UpdateAsync(Guid key, string from, string to, DateTimeOffset now, CancellationToken ct, string? eventId = null, string? errorCode = null)
    {
        await using var command = data.CreateCommand("""
            update booking_reservations set state = @next, updated_at = @now,
                first_sent_at = case when @current = 'held' and @next = 'sending' then @now else first_sent_at end,
                event_id = coalesce(@eventId, event_id), error_code = @errorCode
            where id = @id and state = @current
            """);
        command.Parameters.AddWithValue("id", key);
        command.Parameters.AddWithValue("current", from);
        command.Parameters.AddWithValue("next", to);
        command.Parameters.AddWithValue("now", now);
        command.Parameters.AddWithValue("eventId", NpgsqlTypes.NpgsqlDbType.Text, (object?)eventId ?? DBNull.Value);
        command.Parameters.AddWithValue("errorCode", NpgsqlTypes.NpgsqlDbType.Text, (object?)errorCode ?? DBNull.Value);
        return await command.ExecuteNonQueryAsync(ct) == 1;
    }

    public async Task<bool> ClaimRetryAsync(Guid key, DateTimeOffset now, CancellationToken ct)
    {
        await using var command = data.CreateCommand("""
            update booking_reservations set retried = true, updated_at = @now
            where id = @id and state = 'sending' and event_id is null and not retried
                and first_sent_at >= @retryAfter and first_sent_at <= @retryBefore
            """);
        command.Parameters.AddWithValue("id", key);
        command.Parameters.AddWithValue("now", now);
        command.Parameters.AddWithValue("retryAfter", now.AddMinutes(-2));
        command.Parameters.AddWithValue("retryBefore", now.AddSeconds(-25));
        return await command.ExecuteNonQueryAsync(ct) == 1;
    }

    public async Task<bool> TakeLimitAsync(string key, DateTimeOffset bucket, int limit, CancellationToken ct)
    {
        await using var command = data.CreateCommand("""
            insert into booking_attempts (key, bucket, count) values (@key, @bucket, 1)
            on conflict (key, bucket) do update set count = booking_attempts.count + 1
            where booking_attempts.count < @limit
            """);
        command.Parameters.AddWithValue("key", key);
        command.Parameters.AddWithValue("bucket", bucket);
        command.Parameters.AddWithValue("limit", limit);
        return await command.ExecuteNonQueryAsync(ct) == 1;
    }

    public async Task<IReadOnlyList<Reservation>> DueAsync(DateTimeOffset now, CancellationToken ct)
    {
        await using var command = data.CreateCommand($"""
            select {Columns} from booking_reservations
            where state = 'sending' and starts_at > @past and updated_at < @before
            order by updated_at limit 10
            """);
        command.Parameters.AddWithValue("before", now.AddSeconds(-25));
        command.Parameters.AddWithValue("past", now.AddMinutes(-30));
        return await ReadAsync(command, ct);
    }

    public async Task CleanAsync(DateTimeOffset now, CancellationToken ct)
    {
        await using var command = data.CreateCommand("""
            update booking_reservations set state = 'failed', updated_at = @now, error_code = 'not_created'
            where state = 'held' and updated_at < @stale;
            delete from booking_reservations where starts_at < @retention;
            delete from booking_attempts where bucket < @limitRetention;
            """);
        command.Parameters.AddWithValue("now", now);
        command.Parameters.AddWithValue("stale", now.AddMinutes(-2));
        command.Parameters.AddWithValue("retention", now.AddDays(-7));
        command.Parameters.AddWithValue("limitRetention", now.AddDays(-2));
        await command.ExecuteNonQueryAsync(ct);
    }

    private static async Task<IReadOnlyList<Reservation>> ReadAsync(NpgsqlCommand command, CancellationToken ct)
    {
        await using var reader = await command.ExecuteReaderAsync(ct);
        var result = new List<Reservation>();
        while (await reader.ReadAsync(ct))
        {
            result.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetFieldValue<DateTimeOffset>(2), reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4), reader.GetFieldValue<DateTimeOffset>(5),
                reader.IsDBNull(6) ? null : reader.GetString(6)));
        }

        return result;
    }
}
