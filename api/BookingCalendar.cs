using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Mags.Booking;

public interface IBookingCalendar
{
    Task<IReadOnlyList<CalendarEntry>> ReadAsync(Slot window, CancellationToken ct);
    Task<CalendarEntry?> GetAsync(string id, CancellationToken ct);
    Task<CalendarEntry?> FindAsync(Guid transaction, CancellationToken ct);
    Task<CalendarEntry> CreateAsync(BookingRequest booking, CancellationToken ct);
}

public sealed class CalendarUnavailableException(string message) : Exception(message);
public sealed class CalendarRejectedException(int status) : Exception($"Graph rejected creation ({status}).");

public sealed class GraphBookingCalendar(IHttpClientFactory clients, BookingSettings settings, TimeProvider clock) : IBookingCalendar
{
    private const string GraphOrigin = "https://graph.microsoft.com";
    private const string CalendarFields = "id,start,end,showAs,isCancelled,responseStatus";
    private const string BookingFields = CalendarFields + ",onlineMeeting";
    private const string BookingProperty = "String {ebd80aae-126a-4fbf-8bca-d806e05720c5} Name MagsBookingId";
    private readonly string _decodedMailboxPath = $"/v1.0/users/{settings.Mailbox}/";
    private readonly string _mailboxPath = $"/v1.0/users/{Uri.EscapeDataString(settings.Mailbox)}";
    private readonly SemaphoreSlim _tokenLock = new(1, 1);
    private string? _token;
    private DateTimeOffset _expires;

    public async Task<IReadOnlyList<CalendarEntry>> ReadAsync(Slot window, CancellationToken ct)
    {
        var start = Uri.EscapeDataString(window.Start.ToString("O", CultureInfo.InvariantCulture));
        var end = Uri.EscapeDataString(window.End.ToString("O", CultureInfo.InvariantCulture));
        return await ReadPagesAsync($"{_mailboxPath}/calendarView?startDateTime={start}&endDateTime={end}&$select={CalendarFields}&$top=100", ct);
    }

    public async Task<CalendarEntry?> GetAsync(string id, CancellationToken ct)
    {
        using var response = await SendAsync(HttpMethod.Get, $"{_mailboxPath}/calendar/events/{Uri.EscapeDataString(id)}?$select={BookingFields}", null, ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        using var json = await ReadJsonAsync(response, ct);
        return ParseEvent(json.RootElement);
    }

    public async Task<CalendarEntry?> FindAsync(Guid transaction, CancellationToken ct)
    {
        var filter = Uri.EscapeDataString($"singleValueExtendedProperties/Any(ep: ep/id eq '{BookingProperty}' and ep/value eq '{transaction:D}')");
        var entries = await ReadPagesAsync($"{_mailboxPath}/events?$filter={filter}&$select={BookingFields}", ct);
        return entries.Count switch
        {
            0 => null,
            1 => entries[0],
            _ => throw new CalendarUnavailableException("Graph returned multiple events for one reservation.")
        };
    }

    public async Task<CalendarEntry> CreateAsync(BookingRequest booking, CancellationToken ct)
    {
        static object GraphTime(DateTimeOffset date) => new
        {
            dateTime = date.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture),
            timeZone = "UTC"
        };
        var body = new
        {
            subject = "Intromøde med MAGS Solutions",
            body = new
            {
                contentType = "text",
                content = "Vi glæder os til at høre om din virksomhed, og hvad du gerne vil have hjælp til. Skriv til mags@mags.dk, hvis du vil flytte eller aflyse mødet."
            },
            start = GraphTime(booking.Slot.Start),
            end = GraphTime(booking.Slot.End),
            showAs = "busy",
            sensitivity = "private",
            isOnlineMeeting = true,
            onlineMeetingProvider = "teamsForBusiness",
            attendees = new[] { new { type = "required", emailAddress = new { address = booking.Email, name = booking.Name } } },
            transactionId = booking.Key.ToString("D"),
            singleValueExtendedProperties = new[] { new { id = BookingProperty, value = booking.Key.ToString("D") } }
        };

        using var response = await SendAsync(HttpMethod.Post, $"{_mailboxPath}/calendar/events", body, ct);
        if ((int)response.StatusCode is 400 or 401 or 403 or 404 or 405 or 422 or 429)
        {
            throw new CalendarRejectedException((int)response.StatusCode);
        }

        using var json = await ReadJsonAsync(response, ct);
        return ParseEvent(json.RootElement);
    }

    private async Task<IReadOnlyList<CalendarEntry>> ReadPagesAsync(string path, CancellationToken ct)
    {
        var entries = new Dictionary<string, CalendarEntry>(StringComparer.Ordinal);
        string? next = path;
        for (var page = 0; next is not null; page++)
        {
            if (page >= 30) throw new CalendarUnavailableException("Graph calendar pagination exceeded its limit.");
            using var response = await SendAsync(HttpMethod.Get, next, null, ct);
            using var json = await ReadJsonAsync(response, ct);
            foreach (var item in json.RootElement.GetProperty("value").EnumerateArray())
            {
                var entry = ParseEvent(item);
                entries[entry.Id] = entry;
            }

            next = json.RootElement.TryGetProperty("@odata.nextLink", out var link) ? link.GetString() : null;
        }

        return entries.Values.ToArray();
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string target, object? body, CancellationToken ct)
    {
        var uri = new Uri(target.StartsWith('/') ? GraphOrigin + target : target, UriKind.Absolute);
        if (uri.Scheme != "https" || uri.Host != "graph.microsoft.com" || !uri.IsDefaultPort ||
            !Uri.UnescapeDataString(uri.AbsolutePath).StartsWith(_decodedMailboxPath, StringComparison.OrdinalIgnoreCase))
        {
            throw new CalendarUnavailableException("Graph returned an unexpected calendar URL.");
        }

        using var request = new HttpRequestMessage(method, uri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await GetTokenAsync(ct));
        request.Headers.TryAddWithoutValidation("Prefer", "outlook.timezone=\"UTC\", IdType=\"ImmutableId\"");
        if (body is not null) request.Content = JsonContent.Create(body);
        using var client = clients.CreateClient("graph");
        var response = await client.SendAsync(request, ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            await _tokenLock.WaitAsync(CancellationToken.None);
            try
            {
                if (_token == request.Headers.Authorization.Parameter) _token = null;
            }
            finally
            {
                _tokenLock.Release();
            }
        }
        return response;
    }

    private async Task<string> GetTokenAsync(CancellationToken ct)
    {
        await _tokenLock.WaitAsync(ct);
        try
        {
            if (_token is not null && _expires > clock.GetUtcNow().AddMinutes(1)) return _token;
            using var client = clients.CreateClient("graph");
            using var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = settings.ClientId,
                ["client_secret"] = settings.ClientSecret,
                ["scope"] = GraphOrigin + "/.default"
            });
            using var response = await client.PostAsync($"https://login.microsoftonline.com/{settings.TenantId}/oauth2/v2.0/token", form, ct);
            using var json = await ReadJsonAsync(response, ct);
            _token = json.RootElement.GetProperty("access_token").GetString();
            _expires = clock.GetUtcNow().AddSeconds(json.RootElement.GetProperty("expires_in").GetInt32());
            return _token ?? throw new CalendarUnavailableException("Graph token response omitted the token.");
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response, CancellationToken ct)
    {
        if (!response.IsSuccessStatusCode)
        {
            throw new CalendarUnavailableException($"Microsoft Graph responded with {(int)response.StatusCode}.");
        }

        return await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
    }

    internal static CalendarEntry ParseEvent(JsonElement item)
    {
        static DateTimeOffset ReadTime(JsonElement time)
        {
            var zone = time.GetProperty("timeZone").GetString();
            if (zone != "UTC") throw new CalendarUnavailableException("Graph returned an unexpected time zone.");
            return DateTimeOffset.Parse(time.GetProperty("dateTime").GetString()!, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal);
        }

        var response = item.TryGetProperty("responseStatus", out var responseStatus) && responseStatus.ValueKind == JsonValueKind.Object &&
            responseStatus.TryGetProperty("response", out var reply) ? reply.GetString() : null;
        var teams = item.TryGetProperty("onlineMeeting", out var meeting) && meeting.ValueKind == JsonValueKind.Object &&
            meeting.TryGetProperty("joinUrl", out var join) && Uri.TryCreate(join.GetString(), UriKind.Absolute, out var url) && url.Scheme == "https";
        var slot = new Slot(ReadTime(item.GetProperty("start")), ReadTime(item.GetProperty("end")));
        if (slot.End <= slot.Start) throw new CalendarUnavailableException("Graph returned an invalid event interval.");
        return new(item.GetProperty("id").GetString() ?? throw new CalendarUnavailableException("Graph returned an event without an identifier."),
            slot,
            item.TryGetProperty("isCancelled", out var cancelled) && cancelled.GetBoolean(), response,
            item.TryGetProperty("showAs", out var showAs) ? showAs.GetString() : null, teams);
    }
}

public sealed class FakeBookingCalendar : IBookingCalendar
{
    private readonly ConcurrentDictionary<Guid, CalendarEntry> _events = new();

    public Task<IReadOnlyList<CalendarEntry>> ReadAsync(Slot window, CancellationToken ct)
    {
        var entries = _events.Values.Where(entry =>
            entry.Slot.Start < window.End && entry.Slot.End > window.Start).ToArray();
        return Task.FromResult<IReadOnlyList<CalendarEntry>>(entries);
    }

    public Task<CalendarEntry?> FindAsync(Guid transaction, CancellationToken ct) =>
        Task.FromResult(_events.GetValueOrDefault(transaction));

    public async Task<CalendarEntry?> GetAsync(string id, CancellationToken ct) =>
        Guid.TryParse(id, out var transaction) ? await FindAsync(transaction, ct) : null;

    public Task<CalendarEntry> CreateAsync(BookingRequest booking, CancellationToken ct) =>
        Task.FromResult(_events.GetOrAdd(booking.Key, key => new CalendarEntry(key.ToString("D"), booking.Slot, false, null, "busy", true)));

}
