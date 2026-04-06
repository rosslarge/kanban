using Kanban.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Kanban.Api.Tests.Helpers;

/// <summary>
/// Shared <see cref="WebApplicationFactory{TEntryPoint}"/> that wires the full API pipeline
/// (endpoints → CardService → repository) against an <see cref="InMemoryCardRepository"/>.
/// This allows integration tests to make real HTTP requests without a Cosmos DB emulator.
/// </summary>
public class KanbanApiFixture : WebApplicationFactory<Program>
{
    private InMemoryCardRepository? _repository;

    /// <summary>
    /// Provides direct access to the in-memory repository so tests can inspect
    /// stored state or call <see cref="InMemoryCardRepository.Clear"/> between tests.
    /// Accessing this property ensures the server has been created (triggering ConfigureWebHost).
    /// </summary>
    public InMemoryCardRepository Repository
    {
        get
        {
            // Force server creation if it hasn't happened yet, which triggers ConfigureWebHost
            if (_repository is null)
                _ = Server;

            return _repository!;
        }
    }

    /// <inheritdoc />
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Inject dummy CosmosDb config so Program.cs startup does not throw
        builder.ConfigureAppConfiguration(config =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["CosmosDb:ConnectionString"] = "AccountEndpoint=https://localhost:8081/;AccountKey=dummykey==",
                ["CosmosDb:DatabaseName"] = "kanban",
                ["CosmosDb:ContainerName"] = "cards"
            });
        });

        builder.ConfigureServices(services =>
        {
            // Remove all Cosmos and service registrations from Program.cs
            var typesToRemove = new[]
            {
                typeof(CosmosClient),
                typeof(Container),
                typeof(ICardRepository),
                typeof(ICardService)
            };

            var descriptors = services
                .Where(d => typesToRemove.Contains(d.ServiceType))
                .ToList();

            foreach (var d in descriptors)
                services.Remove(d);

            // Register the in-memory repository as both concrete and interface
            _repository = new InMemoryCardRepository();
            services.AddSingleton(_repository);
            services.AddSingleton<ICardRepository>(_repository);

            // Register the real CardService so the full business logic pipeline runs
            services.AddSingleton<ICardService, CardService>();
        });
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
}
