# API Plan — Kanban Board

## Context
The kanban board frontend currently persists data to localStorage via Zustand. This plan adds a C# REST API that handles all CRUD operations, backed by Azure Cosmos DB (NoSQL). No authentication for now — that comes later. The API will run locally against the Cosmos DB Docker emulator and eventually deploy to Azure.

## Decisions
- **Location**: `src/api/` alongside the frontend code
- **Framework**: ASP.NET Core 8+ Minimal API
- **Database**: Azure Cosmos DB (Cosmos DB Linux Emulator for local dev via Docker)
- **SDK**: `Microsoft.Azure.Cosmos` — same SDK local and production, connection string is the only difference
- **Auth**: None for now, designed so `.RequireAuthorization()` can be added to the route group later
- **Multi-user**: Cards are owned by a user via `userId` field. Auth will provide the userId from claims later; for now it's passed as a header or defaults to a dev user

## Data Model

The frontend Card model maps directly to a Cosmos DB document. Card ordering within columns is tracked via a `position` field (integer) so ordering doesn't require a separate document.

```csharp
// Models/Card.cs
public class Card
{
    [JsonPropertyName("id")]
    public string Id { get; set; }              // Cosmos DB document id

    public string UserId { get; set; }          // partition key — card owner
    public string Title { get; set; }
    public string Description { get; set; }
    public List<string> Tags { get; set; }
    public string Priority { get; set; }         // "high" | "medium" | "low"
    public string Category { get; set; }
    public List<CardLink> Links { get; set; }
    public string Notes { get; set; }
    public string ColumnId { get; set; }
    public int Position { get; set; }            // ordering within column (per-user)
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class CardLink
{
    public string Label { get; set; }
    public string Url { get; set; }
}
```

**Cosmos DB container config:**
- Database: `kanban`
- Container: `cards`
- Partition key: `/userId` — all of a user's cards are co-located in one partition, so loading a full board is a single-partition query. Column filtering happens within the partition.

**User resolution (pre-auth):**
Until authentication is added, the API resolves the current user via an `X-User-Id` header, defaulting to `"dev-user"` if absent. When auth is added later, this swaps to reading from the JWT claims — the service interface stays the same.

## API Endpoints

All endpoints are scoped to the current user (resolved from header now, JWT claims later).

```
GET    /api/cards                  → All cards for current user (single-partition query)
GET    /api/cards?columnId=ideas   → User's cards in a specific column
GET    /api/cards/{id}             → Single card by ID (must belong to current user)
POST   /api/cards                  → Create card (server sets userId, generates ID, sets createdAt)
PUT    /api/cards/{id}             → Update card fields (ownership check)
PATCH  /api/cards/{id}/move        → Move card to a different column and/or reorder
DELETE /api/cards/{id}             → Delete card (ownership check)
GET    /api/board                  → Full board state for current user (all columns with ordered cards)
```

### Move/Reorder endpoint detail
`PATCH /api/cards/{id}/move` handles both cross-column moves and same-column reordering:
```json
{
  "toColumnId": "shipped",
  "toPosition": 2
}
```
The service recalculates `position` values for affected cards in the source and destination columns.

### Board endpoint detail
`GET /api/board` returns the full board state in the shape the frontend expects:
```json
{
  "columns": {
    "ideas": { "id": "ideas", "title": "Ideas", "cards": [...] },
    "planned": { "id": "planned", "title": "Planned", "cards": [...] }
  }
}
```
Cards within each column are sorted by `position`.

## Project Structure

```
src/api/
├── Kanban.Api.csproj
├── Program.cs                    # Service registration, middleware, endpoint mapping
├── appsettings.json              # Cosmos DB connection config
├── appsettings.Development.json  # Local emulator connection string
├── Models/
│   ├── Card.cs                   # Cosmos DB document model
│   └── Requests.cs               # CreateCardRequest, UpdateCardRequest, MoveCardRequest
├── Services/
│   ├── ICardService.cs           # Interface (all methods take userId parameter)
│   └── CardService.cs            # Cosmos DB implementation (CRUD + move/reorder, user-scoped)
├── Endpoints/
│   └── CardEndpoints.cs          # Route group mapping all card endpoints
└── Configuration/
    └── CosmosDbConfig.cs         # Options class for Cosmos DB settings
```

## Key Implementation Details

### Cosmos DB Setup (Program.cs)
```csharp
// Register Cosmos client as singleton
builder.Services.AddSingleton(sp =>
{
    var config = builder.Configuration.GetSection("CosmosDb").Get<CosmosDbConfig>();
    return new CosmosClient(config.ConnectionString);
});

// Register CardService
builder.Services.AddSingleton<ICardService, CardService>();
```

### Configuration
```json
// appsettings.Development.json
{
  "CosmosDb": {
    "ConnectionString": "AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
    "DatabaseName": "kanban",
    "ContainerName": "cards"
  }
}
```
The connection string above is the well-known emulator key — not a secret.

### User Resolution Middleware
Until auth is added, a simple middleware extracts the user ID:
```csharp
// Reads X-User-Id header, defaults to "dev-user"
app.Use(async (context, next) =>
{
    var userId = context.Request.Headers["X-User-Id"].FirstOrDefault() ?? "dev-user";
    context.Items["UserId"] = userId;
    await next();
});
```
When auth is added, this swaps to reading from `context.User.FindFirst(ClaimTypes.NameIdentifier)`. The `ICardService` always receives a `userId` parameter — it doesn't care where it came from.

### Position Management
When moving/reordering cards, the service:
1. Removes the card from its current column (adjusts positions of remaining cards)
2. Inserts at the target position in the destination column (shifts positions of cards at and after the target index)
3. Updates the card's `columnId`, `position`, and `completedAt` (auto-set when moved to shipped/retrospective)
4. All position queries are scoped to the current user's partition

### CORS
The API needs CORS configured to accept requests from the Vite dev server:
```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});
```

### Database Initialisation
On startup, the API ensures the database and container exist:
```csharp
var client = app.Services.GetRequiredService<CosmosClient>();
await client.CreateDatabaseIfNotExistsAsync("kanban");
var db = client.GetDatabase("kanban");
await db.CreateContainerIfNotExistsAsync("cards", "/userId");
```

### Docker (Cosmos DB Emulator)
```bash
docker run -d --name cosmos-emulator \
  -p 8081:8081 -p 10250-10255:10250-10255 \
  -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest
```

## Testing

### Framework & Libraries
- **xUnit** — test framework (standard for .NET)
- **Moq** — mocking Cosmos DB `Container` and `ICardService`
- **Microsoft.AspNetCore.Mvc.Testing** — `WebApplicationFactory` for endpoint integration tests
- **FluentAssertions** — readable assertion syntax

### Test Project
```
tests/api/
├── Kanban.Api.Tests.csproj
├── Services/
│   ├── CardService_CreateTests.cs
│   ├── CardService_ReadTests.cs
│   ├── CardService_UpdateTests.cs
│   ├── CardService_DeleteTests.cs
│   └── CardService_MoveTests.cs      # position management edge cases
├── Endpoints/
│   ├── CardEndpoints_CrudTests.cs     # HTTP routing, status codes, serialization
│   ├── CardEndpoints_BoardTests.cs    # /api/board response shape
│   └── CardEndpoints_OwnershipTests.cs # user scoping, cross-user rejection
└── Helpers/
    └── CosmosContainerMockBuilder.cs  # reusable mock setup for Container
```

### What to test

**Service layer (CardService)** — mock the Cosmos DB `Container`:
- Create: generates ID, sets `createdAt`, sets `userId`, auto-sets `completedAt` for shipped/retrospective
- Read: returns only cards for the given `userId`, filters by `columnId` when specified
- Update: applies partial updates, rejects if card belongs to a different user
- Delete: removes card, rejects if wrong user
- Move/reorder: the most important tests — position recalculation:
  - Move card from one column to another at a specific position
  - Reorder within the same column
  - Move to an empty column
  - Move to the end of a column
  - Positions of other cards in source and destination columns are correctly adjusted

**Endpoint layer** — mock `ICardService`, use `WebApplicationFactory`:
- Correct HTTP methods and status codes (201 for create, 204 for delete, 404 for missing, etc.)
- Request body deserialization (invalid/missing fields return 400)
- `X-User-Id` header is read and passed to the service
- Default user (`"dev-user"`) when header is absent
- Response body shape matches the documented contracts

### Running Tests
```bash
# From tests/api/
dotnet test

# With coverage
dotnet test --collect:"XPlat Code Coverage"
```

## Implementation Phases

### Phase 1: Project Scaffold
1. Create `src/api/` directory and `Kanban.Api.csproj` targeting .NET 8
2. Add NuGet packages: `Microsoft.Azure.Cosmos`
3. Create `Program.cs` with Cosmos DB client registration, CORS, and Swagger
4. Create configuration classes and `appsettings.json` files
5. Add database initialisation on startup

### Phase 2: Models & Service
1. Create `Card.cs` and request/response DTOs
2. Create `ICardService` interface with all CRUD + move operations
3. Implement `CardService` against Cosmos DB SDK
4. Handle position management logic for ordering

### Phase 3: Unit Tests for Service Layer
1. Create `tests/api/` project with xUnit, Moq, FluentAssertions
2. Build `CosmosContainerMockBuilder` helper for reusable Cosmos mocking
3. Write tests for create, read, update, delete operations
4. Write thorough tests for move/reorder position logic (the most complex part)

### Phase 4: Endpoints
1. Create `CardEndpoints.cs` with route group `/api/cards`
2. Map all CRUD endpoints
3. Map the move/reorder endpoint
4. Map the `/api/board` aggregate endpoint
5. Add Swagger/OpenAPI annotations

### Phase 5: Endpoint Integration Tests
1. Set up `WebApplicationFactory` with mocked `ICardService`
2. Write tests for HTTP routing, status codes, request validation
3. Write tests for user scoping (X-User-Id header, default user, ownership rejection)

### Phase 6: Frontend Integration
1. Create `src/lib/api.ts` — fetch wrapper for all API endpoints
2. Modify `boardStore.ts` to call the API instead of (or alongside) localStorage
3. Remove localStorage persistence, replace with API calls
4. Handle loading states and errors

## Running Locally

```bash
# 1. Start Cosmos DB emulator
docker run -d --name cosmos-emulator \
  -p 8081:8081 -p 10250-10255:10250-10255 \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest

# 2. Start the API (from src/api/)
dotnet run

# 3. Start the frontend (from project root)
npm run dev
```

API runs on `http://localhost:5062` (or configured port), frontend on `http://localhost:5173`.

## Verification
1. `dotnet build` in `src/api/` — compiles without errors
2. Start Cosmos emulator, then `dotnet run` — API starts, database/container auto-created
3. `curl http://localhost:5062/api/board` — returns empty board structure
4. `curl -X POST http://localhost:5062/api/cards -H 'Content-Type: application/json' -d '{...}'` — creates a card
5. `curl http://localhost:5062/api/cards` — returns the created card
6. Frontend `npm run dev` — board loads data from API instead of localStorage
7. Create, edit, move, delete cards via UI — verify changes persist across page refresh via API
