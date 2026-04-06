# Kanban Board

A personal kanban board for organising software projects and ideas. Cards move through five stages: **Ideas → Planned → In Progress → Shipped → Retrospective**.

## Project Structure

```
kanban/
├── src/
│   ├── api/                  # C# ASP.NET Core 10 Minimal API
│   │   ├── Configuration/    # Strongly-typed settings (CosmosDbConfig)
│   │   ├── Endpoints/        # Route group definitions (CardEndpoints)
│   │   ├── Models/           # Cosmos DB document model + request/response DTOs
│   │   └── Services/         # ICardRepository, ICardService and their implementations
│   ├── components/           # React UI components (Board, KanbanColumn, KanbanCard, …)
│   ├── hooks/                # Custom hooks (useFilteredCards, useAllTags)
│   ├── lib/                  # Utilities, constants, sample data
│   ├── store/                # Zustand stores (boardStore, filterStore)
│   └── types/                # Shared TypeScript types (Card, Column, ColumnId, …)
├── tests/
│   └── api/                  # xUnit tests for the API
│       ├── Endpoints/        # HTTP-level integration tests (WebApplicationFactory)
│       ├── Helpers/          # Shared test helpers (CardTestFactory)
│       └── Services/         # Unit tests for CardService
├── docs/
│   ├── frontend-plan.md      # Frontend architecture and implementation plan
│   └── api-plan.md           # API architecture and implementation plan
└── CLAUDE.md                 # Coding standards for this project
```

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 19 + TypeScript + Vite |
| Styling   | Tailwind CSS v4 |
| Drag & drop | dnd-kit |
| State     | Zustand (localStorage persistence) |
| API       | ASP.NET Core 10 Minimal API |
| Database  | Azure Cosmos DB (NoSQL) |
| Testing   | xUnit + Moq + FluentAssertions |

## Running Locally

### Frontend

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`. Card data is persisted to `localStorage` under the key `kanban-board-v1`.

### API

The API requires the Azure Cosmos DB Linux Emulator running locally.

```bash
# 1. Start the Cosmos DB emulator
docker run -d --name cosmos-emulator \
  -p 8081:8081 -p 10250-10255:10250-10255 \
  -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest

# 2. Start the API
cd src/api
dotnet run
```

The API runs on `http://localhost:5062` and creates the `kanban` database and `cards` container on startup if they do not already exist. The emulator connection string in `src/api/appsettings.Development.json` uses the well-known emulator key — it is not a secret.

### Tests

```bash
cd tests/api
dotnet test
```

All 49 tests run against mocked dependencies — no running Cosmos DB emulator is required.

## Plans

- [`docs/frontend-plan.md`](docs/frontend-plan.md) — Component design, state management approach, drag-and-drop strategy
- [`docs/api-plan.md`](docs/api-plan.md) — API endpoints, Cosmos DB data model, position management, authentication design

## Coding Standards

See [`CLAUDE.md`](CLAUDE.md) for project-wide conventions:

- All methods and classes must have documentation comments (JSDoc for TypeScript, XML docs for C#)
- All tests must have a comment describing the behaviour under verification
- Implementation plans go in `docs/`
