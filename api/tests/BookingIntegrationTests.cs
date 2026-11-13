using System.Collections.Concurrent;
using System.Net;
using Mags.Booking;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

public sealed class BookingIntegrationTests
{
    [PostgresFact]
    public async Task SameTimeCanBeConfirmedOnceAndAnOutlookMoveReleasesIt()
    {
        await using var harness = await TestHarness.CreateAsync();
        var slot = await harness.FirstSlotAsync();
        var first = harness.Request(slot, "first@example.test");
        var second = harness.Request(slot, "second@example.test");
        var results = await Task.WhenAll(harness.ReserveAsync(first), harness.ReserveAsync(second));

        Assert.Equal([201, 409], results.Select(result => result.Status).Order().ToArray());
        var winner = results[0].Status == 201 ? first : second;
        Assert.Equal(200, (await harness.ReserveAsync(winner)).Status);
        Assert.Equal(1, harness.Calendar.CreateCount);

        harness.Calendar.Move(winner.Key, new Slot(slot.Start.AddMinutes(30), slot.End.AddMinutes(30)));
        var slots = (await harness.Service.GetAvailabilityAsync(default)).Days.SelectMany(day => day.Slots).ToArray();
        Assert.Contains(slot, slots);
        Assert.DoesNotContain(new Slot(slot.Start.AddMinutes(30), slot.End.AddMinutes(30)), slots);
        Assert.Equal(409, (await harness.ReserveAsync(winner)).Status);
        Assert.Equal(201, (await harness.ReserveAsync(harness.Request(slot, "new@example.test"))).Status);
    }

    [PostgresFact]
    public async Task LostResponseKeepsSlotHeldAndReconcilesWithoutSendingAgain()
    {
        await using var harness = await TestHarness.CreateAsync();
        var slot = await harness.FirstSlotAsync();
        var request = harness.Request(slot, "guest@example.test");
        harness.Calendar.LoseNextResponse = true;

        Assert.Equal(202, (await harness.ReserveAsync(request)).Status);
        Assert.Equal(202, (await harness.ReserveAsync(request)).Status);
        Assert.Equal(409, (await harness.ReserveAsync(harness.Request(slot, "other@example.test"))).Status);
        var pending = Assert.IsType<Reservation>(await harness.Store.FindAsync(request.Key, default));
        Assert.Equal("sending", pending.State);

        await harness.Service.ReconcileAsync(pending, default);
        Assert.Equal(200, (await harness.ReserveAsync(request)).Status);
        Assert.Equal(1, harness.Calendar.CreateCount);

        harness.Calendar.Cancel(request.Key);
        Assert.Contains(slot, (await harness.Service.GetAvailabilityAsync(default)).Days.SelectMany(day => day.Slots));
    }

    [PostgresFact]
    public async Task FinalCalendarCheckFailsClosedAndIdempotencyRejectsChangedDetails()
    {
        await using var harness = await TestHarness.CreateAsync();
        var slot = await harness.FirstSlotAsync();
        var request = harness.Request(slot, "guest@example.test");
        harness.Calendar.Unavailable = true;

        Assert.Equal(new BookingResult(503, "not_created"), await harness.ReserveAsync(request));
        Assert.Equal(new BookingResult(503, "not_created"), await harness.ReserveAsync(request));
        await Assert.ThrowsAsync<CalendarUnavailableException>(() => harness.Service.GetAvailabilityAsync(default));
        Assert.Equal(0, harness.Calendar.CreateCount);
        harness.Calendar.Unavailable = false;
        var second = harness.Request(slot, "guest@example.test");
        Assert.Equal(201, (await harness.ReserveAsync(second)).Status);
        Assert.Equal("idempotency_conflict", (await harness.ReserveAsync(second with { RequestHash = "different" })).Code);
    }

    [PostgresFact]
    public async Task RetryAfterAmbiguousWriteUsesSameTransactionAndOnlyOneDispatch()
    {
        await using var harness = await TestHarness.CreateAsync();
        var slot = await harness.FirstSlotAsync();
        var request = harness.Request(slot, "guest@example.test");
        harness.Calendar.FailBeforeNextCreate = true;

        Assert.Equal(202, (await harness.ReserveAsync(request)).Status);
        Assert.Equal(202, (await harness.ReserveAsync(request)).Status);
        Assert.Equal(1, harness.Calendar.CreateCount);
        harness.Clock.Now = harness.Clock.Now.AddSeconds(26);

        var results = await Task.WhenAll(harness.ReserveAsync(request), harness.ReserveAsync(request));
        Assert.Single(results, result => result.Status == 201);
        Assert.Equal(2, harness.Calendar.CreateCount);
        Assert.Equal([request.Key, request.Key], harness.Calendar.Transactions.ToArray());
        Assert.Equal(200, (await harness.ReserveAsync(request)).Status);
    }

    private sealed class TestHarness : IAsyncDisposable
    {
        private readonly NpgsqlDataSource _data;
        private readonly string _schema;
        private readonly string _connectionString;
        private readonly BookingSettings _settings;
        public SimulatedCalendar Calendar { get; } = new();
        public FixedClock Clock { get; } = new(new DateTimeOffset(2027, 3, 26, 6, 0, 0, TimeSpan.Zero));
        public BookingStore Store { get; }
        public BookingService Service { get; }

        private TestHarness(string connectionString, string schema)
        {
            _schema = schema;
            _connectionString = connectionString;
            var connection = new NpgsqlConnectionStringBuilder(connectionString) { SearchPath = schema };
            _data = NpgsqlDataSource.Create(connection.ConnectionString);
            _settings = new BookingSettings("fake", connection.ConnectionString, "", "", "", "", "", [], "test-hash-key");
            Store = new BookingStore(_data);
            Service = new BookingService(_settings, Store, Calendar, new NoExternalHttp(), Clock, NullLogger<BookingService>.Instance);
        }

        public static async Task<TestHarness> CreateAsync()
        {
            var connectionString = Environment.GetEnvironmentVariable("MAGS_BOOKING_TEST_DB")!;
            var schema = $"booking_test_{Guid.NewGuid():N}";
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"create schema {schema}", connection);
            await command.ExecuteNonQueryAsync();
            return new TestHarness(connectionString, schema);
        }

        public async Task<Slot> FirstSlotAsync() => (await Service.GetAvailabilityAsync(default)).Days[0].Slots[1];

        public BookingRequest Request(Slot slot, string email) =>
            BookingRequest.Parse(new ReservationInput(slot.Start, "Test Gæst", email, null, Guid.NewGuid()), _settings.RequestHashKey)!;

        public Task<BookingResult> ReserveAsync(BookingRequest request) => Service.ReserveAsync(request, IPAddress.Loopback, default);

        public async ValueTask DisposeAsync()
        {
            await _data.DisposeAsync();
            await using var connection = new NpgsqlConnection(_connectionString);
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"drop schema {_schema} cascade", connection);
            await command.ExecuteNonQueryAsync();
        }
    }

    private sealed class SimulatedCalendar : IBookingCalendar
    {
        private readonly ConcurrentDictionary<Guid, CalendarEntry> _events = new();
        private int _createCount;
        public int CreateCount => _createCount;
        public ConcurrentQueue<Guid> Transactions { get; } = new();
        public bool LoseNextResponse { get; set; }
        public bool FailBeforeNextCreate { get; set; }
        public bool Unavailable { get; set; }

        public Task<IReadOnlyList<CalendarEntry>> ReadAsync(Slot window, CancellationToken ct)
        {
            if (Unavailable) throw new CalendarUnavailableException("Outlook test outage");
            return Task.FromResult<IReadOnlyList<CalendarEntry>>(_events.Values.Where(entry =>
                entry.Slot.Start < window.End && entry.Slot.End > window.Start).ToArray());
        }

        public Task<CalendarEntry?> GetAsync(string id, CancellationToken ct) => FindAsync(Guid.Parse(id), ct);
        public Task<CalendarEntry?> FindAsync(Guid transaction, CancellationToken ct) => Task.FromResult(_events.GetValueOrDefault(transaction));

        public Task<CalendarEntry> CreateAsync(BookingRequest booking, CancellationToken ct)
        {
            Interlocked.Increment(ref _createCount);
            Transactions.Enqueue(booking.Key);
            if (FailBeforeNextCreate)
            {
                FailBeforeNextCreate = false;
                throw new HttpRequestException("Simulated connection reset before Outlook received the event");
            }
            var entry = _events.GetOrAdd(booking.Key, key => new CalendarEntry(key.ToString(), booking.Slot, false, null, "busy", true));
            if (!LoseNextResponse) return Task.FromResult(entry);
            LoseNextResponse = false;
            throw new HttpRequestException("Simulated timeout after the event was created");
        }

        public void Move(Guid key, Slot slot) => _events[key] = _events[key] with { Slot = slot };
        public void Cancel(Guid key) => _events[key] = _events[key] with { Cancelled = true };
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class NoExternalHttp : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => throw new InvalidOperationException("Integration tests should not use external HTTP.");
    }

    private sealed class PostgresFactAttribute : FactAttribute
    {
        public PostgresFactAttribute()
        {
            if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MAGS_BOOKING_TEST_DB")))
                Skip = "Set MAGS_BOOKING_TEST_DB to a disposable PostgreSQL database.";
        }
    }
}
