using System.Globalization;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Mags.Booking;

public sealed record BookingSettings(
    string Mode,
    string ConnectionString,
    string TenantId,
    string ClientId,
    string ClientSecret,
    string Mailbox,
    string TurnstileSecret,
    string[] TurnstileHostnames,
    string RequestHashKey)
{
    public bool Enabled => Mode is "fake" or "graph";

    public static BookingSettings Read(IConfiguration config, bool development)
    {
        var section = config.GetSection("Booking");
        var requestedMode = section["Mode"]?.Trim().ToLowerInvariant();
        var mode = requestedMode == "graph" || (development && requestedMode == "fake")
            ? requestedMode
            : "disabled";
        var connection = config.GetConnectionString("Booking") ?? "";
        var tenant = section["TenantId"]?.Trim() ?? "";
        var client = section["ClientId"]?.Trim() ?? "";
        var secret = section["ClientSecret"] ?? "";
        var mailbox = section["Mailbox"]?.Trim() ?? "";
        var turnstile = section["TurnstileSecret"] ?? "";
        var hosts = (section["TurnstileHostname"] ?? "mags.dk,www.mags.dk")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var hashKey = section["RequestHashKey"] ?? "";

        if (mode == "graph" && (!Guid.TryParse(tenant, out _) || !Guid.TryParse(client, out _) ||
            string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(mailbox) ||
            string.IsNullOrWhiteSpace(turnstile) || hosts.Length == 0 || hashKey.Trim().Length < 32))
        {
            mode = "disabled";
        }

        if (mode == "fake" && hashKey.Length == 0)
        {
            hashKey = "mags-booking-development-only-key";
        }

        return new(string.IsNullOrWhiteSpace(connection) ? "disabled" : mode, connection,
            tenant, client, secret, mailbox, turnstile, hosts, hashKey);
    }
}

public sealed record Slot(DateTimeOffset Start, DateTimeOffset End);
public sealed record BookingDay(DateOnly Date, IReadOnlyList<Slot> Slots);
public sealed record Availability(string TimeZone, IReadOnlyList<BookingDay> Days);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ReservationInput(DateTimeOffset? Start, string? Name, string? Email, string? TurnstileToken, Guid? IdempotencyKey);

public sealed record BookingRequest(Slot Slot, string Name, string Email, string Token, Guid Key, string RequestHash, string RecipientHash)
{
    public static BookingRequest? Parse(ReservationInput input, string hashKey)
    {
        var name = input.Name?.Trim();
        var email = input.Email?.Trim();
        var token = input.TurnstileToken ?? "";
        if (input.Start is not { } start || input.IdempotencyKey is not { } key || key == Guid.Empty ||
            name is null || name.Length is < 2 or > 100 || name.Any(char.IsControl) ||
            email is null || email.Length is < 3 or > 254 || email.Any(char.IsControl) ||
            !MailAddress.TryCreate(email, out var address) || address.Address != email ||
            !address.Host.Contains('.') || token.Length > 2048)
        {
            return null;
        }

        start = start.ToUniversalTime();
        if (start.Year is < 2000 or > 2100) return null;
        var slot = new Slot(start, start.AddMinutes(30));
        var canonicalAddress = email.ToLowerInvariant();
        var data = JsonSerializer.Serialize(new[] { start.ToString("O", CultureInfo.InvariantCulture), name, canonicalAddress });
        return new(slot, name, email, token, key, Hash(hashKey, $"request:{data}"), Hash(hashKey, $"recipient:{canonicalAddress}"));
    }

    public static string Hash(string key, string value) =>
        Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(value)));
}

public sealed record CalendarEntry(string Id, Slot Slot, bool Cancelled, string? Response, string? ShowAs, bool HasTeamsLink)
{
    public bool Blocks => !Cancelled && Response != "declined" && ShowAs != "free";
}

public static class BookingHours
{
    public const string TimeZone = "Europe/Copenhagen";
    private static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById(TimeZone);

    public static DateOnly LocalDate(DateTimeOffset time) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(time, Zone).DateTime);

    public static Slot Window(DateTimeOffset now)
    {
        var today = LocalDate(now);
        return new(At(today.AddDays(1), 8 * 60), At(today.AddDays(30), 16 * 60));
    }

    public static Availability Available(DateTimeOffset now, IReadOnlyList<CalendarEntry> events, HashSet<DateTimeOffset> heldStarts)
    {
        var today = LocalDate(now);
        var days = Enumerable.Range(1, 30).Select(offset => today.AddDays(offset)).Select(date =>
            new BookingDay(date, DaySlots(date)
                .Where(slot => slot.Start >= now.AddHours(24) && !heldStarts.Contains(slot.Start) && !Overlaps(slot, events))
                .ToArray())).ToArray();
        return new(TimeZone, days);
    }

    public static bool IsAllowed(Slot slot, DateTimeOffset now)
    {
        var date = LocalDate(slot.Start);
        return slot.Start >= now.AddHours(24) && date <= LocalDate(now).AddDays(30) && DaySlots(date).Contains(slot);
    }

    public static bool Overlaps(Slot slot, IReadOnlyList<CalendarEntry> events) =>
        events.Any(entry => entry.Blocks && entry.Slot.Start < slot.End && entry.Slot.End > slot.Start);

    private static IEnumerable<Slot> DaySlots(DateOnly date) => Enumerable.Range(0, 16).Select(index =>
    {
        var start = At(date, 8 * 60 + index * 30);
        return new Slot(start, start.AddMinutes(30));
    });

    internal static DateTimeOffset At(DateOnly day, int minute)
    {
        var local = day.ToDateTime(TimeOnly.MinValue.AddMinutes(minute));
        return new DateTimeOffset(local, Zone.GetUtcOffset(local)).ToUniversalTime();
    }
}
