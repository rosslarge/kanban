using Kanban.Api.Configuration;
using Kanban.Api.Endpoints;
using Kanban.Api.Services;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Azure.Cosmos;

var builder = WebApplication.CreateBuilder(args);

// Configuration
var cosmosConfig = builder.Configuration.GetSection("CosmosDb").Get<CosmosDbConfig>()
    ?? throw new InvalidOperationException("CosmosDb configuration is required.");

// Cosmos DB
builder.Services.AddSingleton(_ =>
{
    var options = new CosmosClientOptions
    {
        SerializerOptions = new CosmosSerializationOptions
        {
            PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
        }
    };

    // The local Cosmos emulator uses a self-signed certificate, so bypass SSL
    // validation in Development. Never disable this in production.
    if (builder.Environment.IsDevelopment())
    {
        options.HttpClientFactory = () => new HttpClient(new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        });
        options.ConnectionMode = ConnectionMode.Gateway;
    }

    return new CosmosClient(cosmosConfig.ConnectionString, options);
});

builder.Services.AddSingleton(sp =>
{
    var client = sp.GetRequiredService<CosmosClient>();
    return client.GetContainer(cosmosConfig.DatabaseName, cosmosConfig.ContainerName);
});

builder.Services.AddSingleton<ICardRepository, CosmosCardRepository>();
builder.Services.AddSingleton<ICardService, CardService>();

// CORS — allowed origins are read from configuration so each environment
// (local dev, staging, prod) can permit its own frontend host without code changes.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// Trust X-Forwarded-* headers from the upstream proxy (e.g. Azure Container Apps ingress)
// so HttpContext.Request.Scheme reflects the original https scheme rather than the
// internal http hop. KnownNetworks/KnownProxies are cleared because the ingress IP is
// not predictable; this is safe because Container Apps is the only thing in front of us.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddOpenApi();

var app = builder.Build();

// Ensure Cosmos DB database and container exist (skipped when CosmosClient is not registered, e.g. in tests)
using (var scope = app.Services.CreateScope())
{
    var cosmosClient = scope.ServiceProvider.GetService<CosmosClient>();
    if (cosmosClient is not null)
    {
        var db = await cosmosClient.CreateDatabaseIfNotExistsAsync(cosmosConfig.DatabaseName);
        await db.Database.CreateContainerIfNotExistsAsync(cosmosConfig.ContainerName, "/userId");
    }
}

app.UseForwardedHeaders();

// Middleware: resolve user from header (swaps to JWT claims when auth is added)
app.Use(async (context, next) =>
{
    var userId = context.Request.Headers["X-User-Id"].FirstOrDefault() ?? "dev-user";
    context.Items["UserId"] = userId;
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/openapi/v1.json", "Kanban API"));
}

app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.MapCardEndpoints();

app.Run();

// Allow WebApplicationFactory to access the entry point in tests
public partial class Program { }
