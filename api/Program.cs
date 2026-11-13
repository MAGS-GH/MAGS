using System.Net;
using System.Threading.RateLimiting;
using Mags.Booking;
using Microsoft.AspNetCore.RateLimiting;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
var settings = BookingSettings.Read(builder.Configuration, builder.Environment.IsDevelopment());
builder.WebHost.ConfigureKestrel(server => server.Limits.MaxRequestBodySize = 8192);
builder.Services.AddSingleton(settings);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHttpClient("graph", client => client.Timeout = TimeSpan.FromSeconds(7))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false }).RemoveAllLoggers();
builder.Services.AddHttpClient("turnstile", client => client.Timeout = TimeSpan.FromSeconds(4))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false }).RemoveAllLoggers();
builder.Services.AddRateLimiter(limiter =>
{
    limiter.RejectionStatusCode = 429;
    limiter.OnRejected = (context, ct) => new ValueTask(context.HttpContext.Response.WriteAsJsonAsync(new { code = "rate_limited" }, ct));
    limiter.AddConcurrencyLimiter("availability", options =>
    {
        options.PermitLimit = 8;
        options.QueueLimit = 0;
        options.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
    limiter.AddConcurrencyLimiter("reservation", options =>
    {
        options.PermitLimit = 16;
        options.QueueLimit = 0;
        options.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
});

if (settings.Enabled)
{
    builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(settings.ConnectionString));
    builder.Services.AddSingleton<BookingStore>();
    if (settings.Mode == "graph") builder.Services.AddSingleton<IBookingCalendar, GraphBookingCalendar>();
    else builder.Services.AddSingleton<IBookingCalendar, FakeBookingCalendar>();
    builder.Services.AddSingleton<BookingService>();
    builder.Services.AddHostedService<BookingReconciliationWorker>();
}

var app = builder.Build();
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    try
    {
        await next(context);
    }
    catch (Exception ex) when (!context.RequestAborted.IsCancellationRequested && !context.Response.HasStarted)
    {
        if (ex is BadHttpRequestException badRequest && badRequest.StatusCode is >= 400 and < 500)
        {
            context.Response.StatusCode = badRequest.StatusCode;
            await context.Response.WriteAsJsonAsync(new { code = "invalid_request" });
            return;
        }

        app.Logger.LogWarning("Booking request failed ({ErrorType}).", ex.GetType().Name);
        context.Response.StatusCode = 503;
        await context.Response.WriteAsJsonAsync(new { code = "unavailable" });
    }

    if (context.Response.StatusCode is >= 400 and < 500 && !context.Response.HasStarted && context.Response.ContentType is null)
    {
        await context.Response.WriteAsJsonAsync(new { code = "invalid_request" });
    }
});
app.UseRateLimiter();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/booking/availability", async (HttpContext context) =>
{
    if (!settings.Enabled) return Error(503, "unavailable");
    var booking = context.RequestServices.GetRequiredService<BookingService>();
    return Results.Ok(await booking.GetAvailabilityAsync(context.RequestAborted));
}).RequireRateLimiting("availability");

app.MapPost("/api/booking/reservations", async (ReservationInput input, HttpContext context) =>
{
    if (!settings.Enabled) return Error(503, "unavailable");
    var request = BookingRequest.Parse(input, settings.RequestHashKey);
    if (request is null) return Error(400, "invalid_request");
    var ipHeader = context.Request.Headers["X-Booking-Client-IP"].ToString();
    IPAddress.TryParse(ipHeader, out var ip);
    var booking = context.RequestServices.GetRequiredService<BookingService>();
    var result = await booking.ReserveAsync(request, ip, context.RequestAborted);
    if (result.Slot is not null) return Results.Json(result.Slot, statusCode: result.Status);
    if (result.Status == 202) context.Response.Headers.RetryAfter = "5";
    return Error(result.Status, result.Code ?? "unavailable");
}).RequireRateLimiting("reservation");

app.Run();

static IResult Error(int status, string code) => Results.Json(new { code }, statusCode: status);
