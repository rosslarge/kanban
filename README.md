# Kanban Board

A personal kanban board for organising software projects and ideas. Cards move through five stages: **Ideas → Planned → In Progress → Shipped → Retrospective**.

## Tech Stack

| Layer       | Technology |
|-------------|------------|
| Frontend    | React 19 + TypeScript + Vite |
| Styling     | Tailwind CSS v4 |
| Drag & drop | dnd-kit |
| State       | Zustand |
| API         | ASP.NET Core 10 Minimal API |
| Database    | Azure Cosmos DB (NoSQL) |
| Testing     | xUnit + Moq + FluentAssertions |
| CI          | GitHub Actions |

## Running Locally

### Frontend

```bash
npm install
npm run dev        # http://localhost:5173
```

The frontend switches between localStorage and the HTTP API via `VITE_STORAGE_BACKEND`. A `.env.local` file is used for local development:

```
VITE_STORAGE_BACKEND=api
```

Without this file the frontend runs in local mode, persisting cards to `localStorage` under `kanban-board-v1` with no API required.

### API

The convenience script starts the Cosmos DB emulator then the API:

```bash
bash src/api/start.sh
```

Or manually:

```bash
# 1. Start the Cosmos DB Linux Emulator (ARM64-native, no certificate needed)
docker run -d --name cosmos-emulator \
  -p 8081:8081 \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview

# 2. Start the API
cd src/api && dotnet run    # http://localhost:5062
```

The API creates the `kanban` database and `cards` container on startup if they don't exist. The emulator connection string in `appsettings.Development.json` uses the well-known emulator key — it is not a secret.

### Tests

```bash
dotnet test tests/api/ --filter "Category!=EndToEnd"   # fast, no emulator needed
dotnet test tests/api/ --filter "Category=EndToEnd"    # requires Cosmos emulator
dotnet test tests/api/                                  # all tests
```

## Project Structure

```
kanban/
├── src/
│   ├── api/                  # C# ASP.NET Core 10 Minimal API
│   │   ├── Configuration/    # Strongly-typed settings (CosmosDbConfig)
│   │   ├── Endpoints/        # Route group definitions (CardEndpoints)
│   │   ├── Models/           # Cosmos DB document model + request/response DTOs
│   │   └── Services/         # ICardRepository, ICardService and their implementations
│   ├── components/           # React UI components
│   ├── hooks/                # Custom hooks (useFilteredCards, useAllTags, …)
│   ├── lib/                  # Utilities, constants, sample data
│   ├── services/             # API client and storage adapter (local/api)
│   ├── store/                # Zustand stores (boardStore, filterStore)
│   └── types/                # Shared TypeScript types
├── tests/
│   └── api/                  # xUnit tests
│       ├── Endpoints/        # HTTP-level integration tests (WebApplicationFactory)
│       ├── Integration/      # Full-stack tests using InMemoryCardRepository
│       ├── Services/         # Unit tests for CardService
│       └── Helpers/          # Shared test builders and factories
└── CLAUDE.md                 # Architecture decisions and coding standards
```

## Coding Standards

See [`CLAUDE.md`](CLAUDE.md) for conventions — documentation comments, test comment requirements, and where to put plans.
