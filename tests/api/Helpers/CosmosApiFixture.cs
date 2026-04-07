using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.DependencyInjection;

namespace Kanban.Api.Tests.Helpers;

/// <summary>
/// Shared <see cref="WebApplicationFactory{TEntryPoint}"/> that keeps the real Cosmos DB
/// registrations from Program.cs intact, connecting to the local Cosmos DB emulator.
/// Uses a dedicated test database (<c>kanban-e2e-tests</c>) to avoid polluting the dev database,
/// and deletes it on teardown via <see cref="IAsyncLifetime"/>.
///
/// Configuration is injected via environment variables (set before the host builds)
/// because Program.cs reads CosmosDb config during top-level statement execution,
/// before WebApplicationFactory's ConfigureAppConfiguration hook runs.
/// </summary>
public class CosmosApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    /// <summary>
    /// The well-known Cosmos DB emulator connection string.
    /// This key is not a secret — it is the same for every emulator instance.
    /// </summary>
    private const string EmulatorConnectionString =
        "AccountEndpoint=http://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";

    /// <summary>Dedicated database name used by e2e tests, separate from the dev database.</summary>
    private const string TestDatabaseName = "kanban-e2e-tests";

    /// <summary>Container name matching the application's default.</summary>
    private const string TestContainerName = "cards";

    /// <inheritdoc />
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Set Development environment so the SSL bypass for the emulator activates
        builder.UseEnvironment("Development");

        // Set config via environment variables so it is available when Program.cs
        // reads configuration during top-level statement execution (before
        // ConfigureAppConfiguration runs).
        Environment.SetEnvironmentVariable("CosmosDb__ConnectionString", EmulatorConnectionString);
        Environment.SetEnvironmentVariable("CosmosDb__DatabaseName", TestDatabaseName);
        Environment.SetEnvironmentVariable("CosmosDb__ContainerName", TestContainerName);
    }

    /// <summary>
    /// Creates an <see cref="HttpClient"/> with the X-User-Id header pre-set,
    /// so tests don't need to add it manually on every request.
    /// </summary>
    /// <param name="userId">The user ID to send with every request.</param>
    /// <returns>A configured HttpClient targeting the test server.</returns>
    public HttpClient CreateClientForUser(string userId)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add("X-User-Id", userId);
        return client;
    }

    /// <summary>
    /// Ensures the test server is created (which triggers database/container initialisation
    /// in Program.cs) before any tests run.
    /// </summary>
    public Task InitializeAsync()
    {
        // Accessing Server forces the WebApplicationFactory to build and start the host,
        // which runs Program.cs including CreateDatabaseIfNotExistsAsync
        _ = Server;
        return Task.CompletedTask;
    }

    /// <summary>
    /// Deletes the dedicated test database after all tests in the class have run,
    /// ensuring no test data persists between runs.
    /// </summary>
    public async Task DisposeAsync()
    {
        try
        {
            var cosmosClient = Services.GetRequiredService<CosmosClient>();
            var database = cosmosClient.GetDatabase(TestDatabaseName);
            await database.DeleteAsync();
        }
        catch
        {
            // If the emulator is already stopped or the database doesn't exist, ignore
        }
    }
}
