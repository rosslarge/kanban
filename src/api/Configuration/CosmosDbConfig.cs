namespace Kanban.Api.Configuration;

/// <summary>
/// Strongly-typed configuration for the Azure Cosmos DB connection.
/// Bound from the "CosmosDb" section in appsettings.json.
/// In development, points to the local Cosmos DB emulator.
/// </summary>
public class CosmosDbConfig
{
    /// <summary>The Cosmos DB account endpoint and key as a single connection string.</summary>
    public string ConnectionString { get; set; } = string.Empty;

    /// <summary>The name of the Cosmos DB database. Defaults to "kanban".</summary>
    public string DatabaseName { get; set; } = "kanban";

    /// <summary>The name of the Cosmos DB container holding card documents. Defaults to "cards".</summary>
    public string ContainerName { get; set; } = "cards";
}
