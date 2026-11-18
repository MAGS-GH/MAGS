using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

namespace SalonPlatform;

public sealed record SalonAccess(string Role, Guid? StaffId)
{
    public bool Manages => Role is "admin" or "owner";
}

public static class OpsAuth
{
    private sealed record Administrators(HashSet<Guid> Subjects);

    public static IServiceCollection AddSalonOps(this IServiceCollection services, IConfiguration config)
    {
        var allow = new HashSet<Guid>();
        foreach (var value in (config["Platform:AdminSubjects"] ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            if (!Guid.TryParse(value, out var id)) throw new InvalidOperationException("Platform:AdminSubjects skal indeholde gyldige bruger-id'er.");
            allow.Add(id);
        }
        services.AddSingleton(new Administrators(allow));
        var issuer = (config["Auth:Issuer"] ?? "https://auth.mercantec.tech").TrimEnd('/');
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
        {
            options.Authority = issuer;
            var localTest = string.Equals(config[HostDefaults.EnvironmentKey],Environments.Development,StringComparison.OrdinalIgnoreCase)
                && new Uri(issuer).IsLoopback;
            options.RequireHttpsMetadata = !localTest;
            options.Audience = config["Auth:Audience"] ?? "mercantec-apps";
            options.MapInboundClaims = false;
            options.IncludeErrorDetails = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidIssuer = issuer, ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true,
                RequireExpirationTime = true, RequireSignedTokens = true, ValidateIssuerSigningKey = true,
                ValidAlgorithms = [SecurityAlgorithms.RsaSha256], ClockSkew = TimeSpan.FromSeconds(30)
            };
            options.Events = new JwtBearerEvents
            {
                OnTokenValidated = ctx =>
                {
                    if (!Guid.TryParse(ctx.Principal?.FindFirstValue("sub"), out _)) ctx.Fail("Ugyldig bruger.");
                    return Task.CompletedTask;
                }
            };
        });
        services.AddAuthorization();
        return services;
    }

    public static Guid Subject(HttpContext ctx) =>
        Guid.TryParse(ctx.User.FindFirstValue("sub"), out var id) ? id : throw new SalonError(401, "Log ind for at fortsætte.");

    public static bool IsAdmin(HttpContext ctx) => ctx.RequestServices.GetRequiredService<Administrators>().Subjects.Contains(Subject(ctx));

    public static async Task<SalonAccess?> Access(HttpContext ctx, NpgsqlDataSource source, Guid salonId)
    {
        if (ctx.User.Identity?.IsAuthenticated != true) return null;
        await using var db = await source.OpenConnectionAsync(ctx.RequestAborted);
        return await Access(ctx, db, null, salonId);
    }

    internal static async Task<SalonAccess?> Access(HttpContext ctx, NpgsqlConnection db, NpgsqlTransaction? tx, Guid salonId)
    {
        if (IsAdmin(ctx)) return new("admin", null);
        await using var cmd = OpsData.Command(db, tx, "SELECT role,staff_id FROM members WHERE salon_id=@s AND sub=@u", ("s",salonId),("u",Subject(ctx)));
        await using var reader = await cmd.ExecuteReaderAsync(ctx.RequestAborted);
        return await reader.ReadAsync(ctx.RequestAborted) ? new(reader.GetString(0), reader.IsDBNull(1) ? null : reader.GetGuid(1)) : null;
    }
}
