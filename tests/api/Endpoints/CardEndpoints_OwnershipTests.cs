using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Kanban.Api.Models;
using Kanban.Api.Services;
using Kanban.Api.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace Kanban.Api.Tests.Endpoints;

public class CardEndpoints_OwnershipTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly Mock<ICardService> _service = new();

    public CardEndpoints_OwnershipTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var descriptors = services
                    .Where(d => d.ServiceType == typeof(ICardService)
                             || d.ServiceType == typeof(ICardRepository)
                             || d.ServiceType == typeof(Microsoft.Azure.Cosmos.Container)
                             || d.ServiceType == typeof(Microsoft.Azure.Cosmos.CosmosClient))
                    .ToList();
                foreach (var d in descriptors) services.Remove(d);
                services.AddSingleton(_service.Object);
            });
        });
    }

    /// <summary>Verifies that the X-User-Id request header value is forwarded to the service as the userId.</summary>
    [Fact]
    public async Task Request_WithUserId_PassesUserIdToService()
    {
        _service.Setup(s => s.GetCardsAsync("alice", null)).ReturnsAsync([]);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-User-Id", "alice");
        await client.GetAsync("/api/cards");

        _service.Verify(s => s.GetCardsAsync("alice", null), Times.Once);
    }

    /// <summary>Verifies that requests without an X-User-Id header fall back to the "dev-user" default.</summary>
    [Fact]
    public async Task Request_WithoutUserId_DefaultsToDevUser()
    {
        _service.Setup(s => s.GetCardsAsync("dev-user", null)).ReturnsAsync([]);

        var client = _factory.CreateClient();
        await client.GetAsync("/api/cards");

        _service.Verify(s => s.GetCardsAsync("dev-user", null), Times.Once);
    }

    /// <summary>Verifies that a user receives 404 when requesting a card that belongs to another user (ownership enforced at service level).</summary>
    [Fact]
    public async Task GetCard_BelongingToAnotherUser_Returns404()
    {
        // Service returns null for user-2 requesting user-1's card (ownership enforced in service)
        _service.Setup(s => s.GetCardAsync("user-2", "card-owned-by-user-1")).ReturnsAsync((Card?)null);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-User-Id", "user-2");
        var response = await client.GetAsync("/api/cards/card-owned-by-user-1");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>Verifies that two different users each receive only their own cards from the same endpoint.</summary>
    [Fact]
    public async Task TwoUsers_ReceiveDifferentCards()
    {
        var aliceCard = CardTestFactory.Create(userId: "alice", title: "Alice's card");
        var bobCard = CardTestFactory.Create(userId: "bob", title: "Bob's card");

        _service.Setup(s => s.GetCardsAsync("alice", null)).ReturnsAsync([aliceCard]);
        _service.Setup(s => s.GetCardsAsync("bob", null)).ReturnsAsync([bobCard]);

        var aliceClient = _factory.CreateClient();
        aliceClient.DefaultRequestHeaders.Add("X-User-Id", "alice");

        var bobClient = _factory.CreateClient();
        bobClient.DefaultRequestHeaders.Add("X-User-Id", "bob");

        var aliceResult = await (await aliceClient.GetAsync("/api/cards")).Content.ReadFromJsonAsync<List<Card>>();
        var bobResult = await (await bobClient.GetAsync("/api/cards")).Content.ReadFromJsonAsync<List<Card>>();

        aliceResult!.Single().Title.Should().Be("Alice's card");
        bobResult!.Single().Title.Should().Be("Bob's card");
    }
}
