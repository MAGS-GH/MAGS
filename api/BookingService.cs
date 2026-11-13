using System.Net;
using System.Text.Json;

namespace Mags.Booking;

public sealed record BookingResult(int Status, string? Code = null, Slot? Slot = null);

public sealed class BookingService(BookingSettings settings, BookingStore store, IBookingCalendar calendar,
    IHttpClientFactory clients, TimeProvider clock, ILogger<BookingService> log)
{
    private const string SlotUnavailable = "slot_unavailable";
    private const string Unavailable = "unavailable";
    private const string NotCreated = "not_created";
    private static readonly BookingResult Pending = new(202, "pending");

    public async Task<Availability> GetAvailabilityAsync(CancellationToken ct)
    {
        await store.InitializeAsync(ct);
        var now = clock.GetUtcNow();
        var window = BookingHours.Window(now);
        var held = await store.ActiveAsync(window, ct);
        var events = await calendar.ReadAsync(window, ct);
        var blocked = new HashSet<DateTimeOffset>();
        foreach (var reservation in held)
        {
            if (reservation.State != "confirmed" || await StillBlockedAsync(reservation, events, now, ct))
            {
                blocked.Add(reservation.Start);
            }
        }

        return BookingHours.Available(now, events, blocked);
    }

    public async Task<BookingResult> ReserveAsync(BookingRequest request, IPAddress? ip, CancellationToken ct)
    {
        await store.InitializeAsync(ct);
        var now = clock.GetUtcNow();
        var ipKey = BookingRequest.Hash(settings.RequestHashKey, $"ip:{NormalizeIp(ip)}");
        var ipBucket = new DateTimeOffset(now.Year, now.Month, now.Day, now.Hour, now.Minute / 15 * 15, 0, TimeSpan.Zero);
        if (!await store.TakeLimitAsync(ipKey, ipBucket, 24, ct)) return new(429, "rate_limited");

        var existing = await store.FindAsync(request.Key, ct);
        if (existing is not null) return await ExistingAsync(existing, request, now, ct);
        if (!BookingHours.IsAllowed(request.Slot, now)) return new(400, "invalid_request");
        if (!await VerifyTurnstileAsync(request.Token, ip, ct)) return new(400, "verification_failed");

        var recipientBucket = new DateTimeOffset(now.UtcDateTime.Date);
        if (!await store.TakeLimitAsync(request.RecipientHash, recipientBucket, 5, ct)) return new(429, "rate_limited");

        // The committed hold survives restarts and keeps other requests away while Outlook is checked and written.
        if (!await store.HoldAsync(request, now, ct))
        {
            existing = await store.FindAsync(request.Key, ct);
            if (existing is not null) return await ExistingAsync(existing, request, now, ct);

            var previous = (await store.ActiveAsync(request.Slot, ct)).SingleOrDefault();
            if (previous?.State != "confirmed" || await StillBlockedAsync(previous, [], now, ct) ||
                !await store.HoldAsync(request, now, ct)) return new(409, SlotUnavailable);
        }

        IReadOnlyList<CalendarEntry> entries;
        try
        {
            entries = await calendar.ReadAsync(request.Slot, ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            log.LogWarning("Final calendar check failed ({ErrorType}).", ex.GetType().Name);
            return await FailHeldAsync(request.Key, NotCreated, 503, ct);
        }

        if (BookingHours.Overlaps(request.Slot, entries)) return await FailHeldAsync(request.Key, SlotUnavailable, 409, ct);
        if (!BookingHours.IsAllowed(request.Slot, clock.GetUtcNow())) return await FailHeldAsync(request.Key, "invalid_request", 400, ct);
        if (!await store.UpdateAsync(request.Key, "held", "sending", clock.GetUtcNow(), ct)) return new(503, NotCreated);

        return await DispatchAsync(request, retry: false);
    }

    private async Task<BookingResult> DispatchAsync(BookingRequest request, bool retry)
    {
        // After dispatch, finish recording the result even when the visitor navigates away.
        using var finish = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        try
        {
            var created = await calendar.CreateAsync(request, finish.Token);
            return await SaveCalendarResultAsync(request.Key, request.Slot, created, 201, finish.Token);
        }
        catch (CalendarRejectedException ex) when (!retry)
        {
            log.LogWarning("{CalendarError}", ex.Message);
            await store.UpdateAsync(request.Key, "sending", "failed", clock.GetUtcNow(), finish.Token, errorCode: NotCreated);
            return new(503, NotCreated);
        }
        catch (Exception ex)
        {
            // A lost response is not evidence that Outlook did not accept the request.
            log.LogWarning("Booking creation is awaiting reconciliation ({ErrorType}).", ex.GetType().Name);
            return Pending;
        }
    }

    public async Task ReconcileAsync(Reservation reservation, CancellationToken ct)
    {
        var entry = reservation.EventId is { } id ? await calendar.GetAsync(id, ct) : null;
        entry ??= await calendar.FindAsync(reservation.Key, ct);

        if (entry is not null)
        {
            await SaveCalendarResultAsync(reservation.Key, reservation.Slot, entry, 200, ct);
            return;
        }

        // A known event may be removed in Outlook. An unknown write keeps its hold and is never replayed blindly.
        if (reservation.EventId is not null && clock.GetUtcNow() - reservation.UpdatedAt >= TimeSpan.FromMinutes(2))
        {
            await store.UpdateAsync(reservation.Key, "sending", "closed", clock.GetUtcNow(), ct, errorCode: SlotUnavailable);
            return;
        }

        if (reservation.EventId is null)
        {
            await store.UpdateAsync(reservation.Key, "sending", "sending", clock.GetUtcNow(), ct);
        }
    }

    private async Task<BookingResult> ExistingAsync(Reservation existing, BookingRequest request, DateTimeOffset now, CancellationToken ct)
    {
        if (existing.RequestHash != request.RequestHash) return new(409, "idempotency_conflict");
        if (existing.State == "confirmed")
        {
            return await StillBlockedAsync(existing, [], now, ct) ? new(200, Slot: existing.Slot) : new(409, SlotUnavailable);
        }

        if (existing.State == "sending" && existing.EventId is null &&
            await store.ClaimRetryAsync(existing.Key, now, ct))
        {
            // Only the original visitor can supply the request again. Reuse its exact transaction ID.
            var found = await calendar.FindAsync(existing.Key, ct);
            if (found is not null) return await SaveCalendarResultAsync(existing.Key, existing.Slot, found, 200, ct);
            var entries = await calendar.ReadAsync(existing.Slot, ct);
            if (!BookingHours.Overlaps(existing.Slot, entries) && BookingHours.IsAllowed(existing.Slot, clock.GetUtcNow()))
            {
                return await DispatchAsync(request, retry: true);
            }
        }

        return existing.State switch
        {
            "held" or "sending" => Pending,
            "closed" => new(409, SlotUnavailable),
            _ when existing.ErrorCode == SlotUnavailable => new(409, SlotUnavailable),
            _ when existing.ErrorCode == "invalid_request" => new(400, "invalid_request"),
            _ when existing.ErrorCode == NotCreated => new(503, NotCreated),
            _ => new(503, Unavailable)
        };
    }

    private async Task<bool> StillBlockedAsync(Reservation reservation, IReadOnlyList<CalendarEntry> entries, DateTimeOffset now, CancellationToken ct)
    {
        if (entries.Any(entry => entry.Id == reservation.EventId && entry.Blocks && entry.Slot == reservation.Slot)) return true;
        if (reservation.EventId is not { } eventId) return true;
        var actual = await calendar.GetAsync(eventId, ct);
        if (actual is not null && actual.Blocks && actual.Slot == reservation.Slot) return true;
        if (actual is null && now - reservation.UpdatedAt < TimeSpan.FromMinutes(2)) return true;
        await store.UpdateAsync(reservation.Key, "confirmed", "closed", now, ct, errorCode: SlotUnavailable);
        return false;
    }

    private async Task<BookingResult> SaveCalendarResultAsync(Guid key, Slot slot, CalendarEntry entry, int status, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        if (!entry.Blocks || entry.Slot != slot)
        {
            await store.UpdateAsync(key, "sending", "closed", now, ct, entry.Id, SlotUnavailable);
            return new(409, SlotUnavailable);
        }

        if (!entry.HasTeamsLink)
        {
            await store.UpdateAsync(key, "sending", "sending", now, ct, entry.Id);
            return Pending;
        }

        if (await store.UpdateAsync(key, "sending", "confirmed", now, ct, entry.Id)) return new(status, Slot: slot);
        var settled = await store.FindAsync(key, ct);
        return settled?.State == "confirmed" ? new(200, Slot: slot) : Pending;
    }

    private async Task<BookingResult> FailHeldAsync(Guid key, string code, int status, CancellationToken ct)
    {
        await store.UpdateAsync(key, "held", "failed", clock.GetUtcNow(), ct, errorCode: code);
        return new(status, code);
    }

    private async Task<bool> VerifyTurnstileAsync(string token, IPAddress? ip, CancellationToken ct)
    {
        if (settings.Mode == "fake") return true;
        if (string.IsNullOrWhiteSpace(token)) return false;
        using var client = clients.CreateClient("turnstile");
        var values = new Dictionary<string, string> { ["secret"] = settings.TurnstileSecret, ["response"] = token };
        if (ip is not null) values["remoteip"] = ip.ToString();
        using var form = new FormUrlEncodedContent(values);
        using var response = await client.PostAsync("https://challenges.cloudflare.com/turnstile/v0/siteverify", form, ct);
        if (!response.IsSuccessStatusCode) throw new CalendarUnavailableException("Turnstile verification service unavailable.");
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        var result = json.RootElement;
        return result.GetProperty("success").GetBoolean() &&
            result.TryGetProperty("action", out var action) && action.GetString() == "booking" &&
            result.TryGetProperty("hostname", out var host) && settings.TurnstileHostnames.Contains(host.GetString(), StringComparer.OrdinalIgnoreCase);
    }

    private static string NormalizeIp(IPAddress? ip)
    {
        if (ip is null) return "unknown";
        if (ip.IsIPv4MappedToIPv6) return ip.MapToIPv4().ToString();
        if (ip.AddressFamily != System.Net.Sockets.AddressFamily.InterNetworkV6) return ip.ToString();
        var bytes = ip.GetAddressBytes();
        Array.Clear(bytes, 8, 8);
        return new IPAddress(bytes).ToString();
    }
}

public sealed class BookingReconciliationWorker(BookingStore store, BookingService booking, TimeProvider clock,
    ILogger<BookingReconciliationWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await store.InitializeAsync(stoppingToken);
                var now = clock.GetUtcNow();
                await store.CleanAsync(now, stoppingToken);
                foreach (var reservation in await store.DueAsync(now, stoppingToken))
                {
                    try
                    {
                        await booking.ReconcileAsync(reservation, stoppingToken);
                    }
                    catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                    {
                        log.LogWarning("Could not reconcile an outstanding booking ({ErrorType}).", ex.GetType().Name);
                        await store.UpdateAsync(reservation.Key, "sending", "sending", now, stoppingToken);
                    }
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                log.LogWarning("Could not reconcile bookings ({ErrorType}).", ex.GetType().Name);
            }
        }
    }
}
