using System.Globalization;
using System.Net;
using System.Text.Json;
using Mags.Booking;
using Xunit;

public sealed class GraphCalendarTests
{
    [Fact]
    public async Task CalendarViewFollowsPagesAndUsesExpandedOccurrenceIntervals()
    {
        var http = new ScriptedHttp(
            request =>
            {
                Assert.Equal("login.microsoftonline.com", request.RequestUri!.Host);
                return Json("""{"access_token":"mock-token","expires_in":3600}""");
            },
            request =>
            {
                Assert.Equal("/v1.0/users/owner@example.test/calendarView", Uri.UnescapeDataString(request.RequestUri!.AbsolutePath));
                Assert.Contains("$select=id,start,end,showAs,isCancelled,responseStatus", request.RequestUri.Query);
                Assert.DoesNotContain("subject", request.RequestUri.Query);
                Assert.Equal("mock-token", request.Headers.Authorization?.Parameter);
                return Json("""
                    {"value":[{"id":"weekly-occurrence","type":"occurrence","start":{"dateTime":"2027-03-28T07:15:00","timeZone":"UTC"},
                      "end":{"dateTime":"2027-03-28T07:45:00","timeZone":"UTC"},"isCancelled":false,"showAs":"busy"}],
                     "@odata.nextLink":"https://graph.microsoft.com/v1.0/users/owner@example.test/calendarView?$skiptoken=next"}
                    """);
            },
            request =>
            {
                Assert.Contains("$skiptoken=next", request.RequestUri!.Query);
                return Json("""
                    {"value":[{"id":"cancelled-occurrence","type":"exception","start":{"dateTime":"2027-03-28T09:00:00","timeZone":"UTC"},
                      "end":{"dateTime":"2027-03-28T09:30:00","timeZone":"UTC"},"isCancelled":true,"showAs":"busy"}]}
                    """);
            });
        var calendar = new GraphBookingCalendar(http, Settings, TimeProvider.System);
        var window = new Slot(Utc("2027-03-28T06:00:00Z"), Utc("2027-03-28T14:00:00Z"));
        var entries = await calendar.ReadAsync(window, default);

        Assert.Equal(2, entries.Count);
        Assert.True(BookingHours.Overlaps(new Slot(Utc("2027-03-28T07:00:00Z"), Utc("2027-03-28T07:30:00Z")), entries));
        Assert.False(BookingHours.Overlaps(new Slot(Utc("2027-03-28T09:00:00Z"), Utc("2027-03-28T09:30:00Z")), entries));
        Assert.Equal(0, http.Remaining);
    }

    [Fact]
    public async Task CreateSetsTeamsAttendeeAndStableCorrelationAndReadFindsMovedEvent()
    {
        var key = Guid.NewGuid();
        var start = Utc("2027-03-28T08:00:00Z");
        var booking = BookingRequest.Parse(new ReservationInput(start, "Test Gæst", "guest@example.test", "", key), Settings.RequestHashKey)!;
        const string response = """
            {"id":"created-event","start":{"dateTime":"2027-03-28T08:00:00","timeZone":"UTC"},
             "end":{"dateTime":"2027-03-28T08:30:00","timeZone":"UTC"},"showAs":"busy",
             "onlineMeeting":{"joinUrl":"https://teams.microsoft.com/l/meetup-join/example"}}
            """;
        var http = new ScriptedHttp(
            _ => Json("""{"access_token":"mock-token","expires_in":3600}"""),
            request =>
            {
                Assert.Equal(HttpMethod.Post, request.Method);
                Assert.EndsWith("/calendar/events", request.RequestUri!.AbsolutePath);
                using var body = JsonDocument.Parse(request.Content!.ReadAsStringAsync().GetAwaiter().GetResult());
                var item = body.RootElement;
                Assert.True(item.GetProperty("isOnlineMeeting").GetBoolean());
                Assert.Equal("teamsForBusiness", item.GetProperty("onlineMeetingProvider").GetString());
                Assert.Equal("guest@example.test", item.GetProperty("attendees")[0].GetProperty("emailAddress").GetProperty("address").GetString());
                Assert.Equal(key.ToString("D"), item.GetProperty("transactionId").GetString());
                Assert.Equal(key.ToString("D"), item.GetProperty("singleValueExtendedProperties")[0].GetProperty("value").GetString());
                return Json(response, HttpStatusCode.Created);
            },
            request =>
            {
                Assert.Equal(HttpMethod.Get, request.Method);
                Assert.EndsWith("/events", request.RequestUri!.AbsolutePath);
                Assert.Contains($"ep/value eq '{key:D}'", Uri.UnescapeDataString(request.RequestUri.Query));
                var moved = response.Replace("T08:", "T10:", StringComparison.Ordinal);
                return Json("{\"value\":[" + moved + "]}");
            });
        var calendar = new GraphBookingCalendar(http, Settings, TimeProvider.System);

        Assert.True((await calendar.CreateAsync(booking, default)).HasTeamsLink);
        Assert.Equal(start.AddHours(2), (await calendar.FindAsync(key, default))!.Slot.Start);
        Assert.Equal(0, http.Remaining);
    }

    private static BookingSettings Settings => new("graph", "", Guid.NewGuid().ToString(), Guid.NewGuid().ToString(), "mock-secret",
        "owner@example.test", "", [], "test-hash-key");

    private static DateTimeOffset Utc(string value) => DateTimeOffset.Parse(value, CultureInfo.InvariantCulture);

    private static HttpResponseMessage Json(string body, HttpStatusCode status = HttpStatusCode.OK) => new(status)
    {
        Content = new StringContent(body)
    };

    private sealed class ScriptedHttp(params Func<HttpRequestMessage, HttpResponseMessage>[] responses) : HttpMessageHandler, IHttpClientFactory
    {
        private readonly Queue<Func<HttpRequestMessage, HttpResponseMessage>> _responses = new(responses);
        public int Remaining => _responses.Count;
        public HttpClient CreateClient(string name) => new(this, disposeHandler: false);

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(_responses.Dequeue()(request));
    }
}
