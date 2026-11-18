using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Npgsql;
using SalonPlatform;

if (args is ["--healthcheck"])
{
    try
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
        using var response = await client.GetAsync("http://127.0.0.1:8080/health");
        Environment.ExitCode = response.IsSuccessStatusCode ? 0 : 1;
    }
    catch (HttpRequestException) { Environment.ExitCode = 1; }
    catch (TaskCanceledException) { Environment.ExitCode = 1; }
    return;
}
var builder = WebApplication.CreateBuilder(args);
// Request paths may carry a private guest link. Log operation names through audit_events.
builder.Logging.AddFilter("Microsoft.AspNetCore.Hosting.Diagnostics", LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.AspNetCore.Routing", LogLevel.Warning);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 5 * 1024 * 1024);
var connectionString = builder.Configuration.GetConnectionString("Salon")
    ?? throw new InvalidOperationException("ConnectionStrings:Salon skal angives.");
builder.Services.AddSingleton(NpgsqlDataSource.Create(connectionString));
builder.Services.AddSingleton(new GuestLinks(builder.Configuration["Booking:LinkKey"]));
builder.Services.AddSalonOps(builder.Configuration);
builder.Services.AddRateLimiter(options =>
{
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        await context.HttpContext.Response.WriteAsJsonAsync(new { error = "For mange forsøg. Vent et øjeblik og prøv igen." }, token);
    };
    foreach (var (policy, limit) in new[] { ("salon-read", 180), ("salon-write", 15) })
        options.AddPolicy(policy, context => RateLimitPartition.GetFixedWindowLimiter(
            System.Net.IPAddress.TryParse(context.Request.Headers["X-Real-IP"].ToString(), out var ip)
                ? ip.ToString() : context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = TimeSpan.FromMinutes(1) }));
});
var app = builder.Build();
await Pg.Migrate(app.Services.GetRequiredService<NpgsqlDataSource>());
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "private, no-store";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    try { await next(context); }
    catch (Exception ex) when (!context.Response.HasStarted && !context.RequestAborted.IsCancellationRequested)
    {
        var (status, message) = ex switch
        {
            SalonError e => (e.Status, e.Message),
            BadHttpRequestException => (400, "Tjek de angivne oplysninger."),
            PostgresException { SqlState: "23P01" or "23505" or "40001" or "40P01" } =>
                (409, "Oplysningerne er ændret. Vælg en anden tid eller prøv igen."),
            PostgresException { SqlState: "23503" or "23514" or "22001" } =>
                (400, "Oplysningerne passer ikke til salonens opsætning."),
            _ => (500, "Platformen kunne ikke gennemføre handlingen. Prøv igen.")
        };
        if (status == 500) app.Logger.LogError("Database/API failure {Type} {Code}", ex.GetType().Name, (ex as PostgresException)?.SqlState);
        context.Response.StatusCode = status;
        if(ex is SalonError { Code: not null } coded)
            await context.Response.WriteAsJsonAsync(new {error=message,code=coded.Code});
        else await context.Response.WriteAsJsonAsync(new { error = message });
    }
});
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health", async (NpgsqlDataSource ds) =>
{
    await using var command = ds.CreateCommand("select 1");
    await command.ExecuteScalarAsync();
    return Results.Ok(new { status = "ok" });
});
app.MapSalonOps();
app.MapSalonBookings();
app.Run();

namespace SalonPlatform
{
    public sealed class SalonError(int status, string message, string? code=null) : Exception(message)
    {
        public int Status { get; } = status;
        public string? Code { get; } = code;
    }

    public sealed class GuestLinks
    {
        readonly byte[] key;
        public GuestLinks(string? setting)
        {
            if (!Convert.TryFromBase64String(setting ?? "", new byte[(setting ?? "").Length], out var n) || n < 32)
                throw new InvalidOperationException("Booking:LinkKey skal være en stabil base64-hemmelighed på mindst 32 byte.");
            key = Convert.FromBase64String(setting!);
        }
        // Regenerating the same high-entropy secret allows recovery after a lost HTTP response.
        public string For(Guid appointment, Guid request) => Convert.ToHexStringLower(
            HMACSHA256.HashData(key, Encoding.UTF8.GetBytes($"salon-guest-v1/{appointment:D}/{request:D}")));
        public static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
        public string RequestHash(string value) => Convert.ToHexStringLower(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(value)));
    }
}
