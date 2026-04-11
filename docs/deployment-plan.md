# Azure Deployment Plan — Staging → Prod Promotion

## Context

The kanban app (React/Vite frontend + ASP.NET Core 10 minimal API + Cosmos DB) is currently fully buildable locally but has **no deployment path**: no Dockerfile, no IaC, no deploy steps in `.github/workflows/pipeline.yml`, and no prior Azure footprint. The goal is, after a green build:

1. Deploy both UI and API to an **Azure staging environment** for manual verification.
2. **Promote to production** once verified.
3. Keep costs minimal (this is a single-user personal app).
4. Manage secrets and per-environment config centrally.

The plan optimises for "personal app that runs when I use it" — scale-to-zero compute, free tiers, and a simple two-environment promotion model.

---

## Recommended Architecture

| Concern | Service | Tier | Why |
|---|---|---|---|
| Frontend hosting | **Azure Static Web Apps** (two instances: `kanban-swa-staging`, `kanban-swa-prod`) | Free | Built-in GitHub Actions integration, HTTPS + CDN included, $0. |
| API hosting | **Azure Container Apps** (two apps: `kanban-api-staging`, `kanban-api-prod` in one shared **Container Apps Environment**) | Consumption | Scales to zero when idle; pay per-request only. Supports .NET 10 via container image. |
| Container registry | **GitHub Container Registry (ghcr.io)** | Free for private images | Chosen over ACR to avoid the post-12-month Standard tier cost (~$20/mo) and keep costs permanently at $0. Trade-off: Container Apps pulls via a GitHub PAT stored as an app secret (no managed-identity integration), and cold-start pulls cross the internet (+~3–8s on first pull of a new image). |
| Database | **Azure Cosmos DB** — one account (`kanban-cosmos`), two databases (`kanban-staging`, `kanban-prod`) | **Free tier** (1000 RU/s + 25 GB, one per subscription, forever) | Single account keeps cost at $0 while isolating data per env at the database level. Existing partition key `/userId` is preserved. |
| Secrets | **Azure Key Vault** (`kanban-kv`) | Standard | Stores Cosmos connection strings and any future secrets. Container Apps reference Key Vault via **system-assigned managed identity** (no secret material in env vars). Costs pennies. |
| Identity for CI/CD | **User-assigned managed identity + GitHub OIDC federated credentials** | Free | No long-lived Azure credentials in GitHub secrets. One identity per environment, scoped to its resource group. |
| Observability | **Application Insights** (workspace-based, shared between both envs with per-env instrumentation keys) | Free tier (5 GB/mo ingest) | Wired in from day one. Container Apps sends stdout/stderr + metrics; SWA sends client-side telemetry via the JS SDK. |

**Resource groups:** `kanban-staging-rg` and `kanban-prod-rg`. Cosmos DB and Key Vault live in a shared `kanban-shared-rg` (one account each, two scopes inside).

**Estimated monthly cost:** ~$0–3 in typical personal-use patterns. Cosmos free tier + SWA free + Container Apps scale-to-zero means the only non-zero line items are Key Vault operations (<$0.10) and any Container Apps executions beyond the monthly free grant (180,000 vCPU-seconds + 360,000 GiB-seconds — plenty for personal use).

---

## Prerequisite Code Changes

These **must** land before the first deploy will work. None are risky; all are in files already read.

### 1. Fix the hardcoded frontend API URL — `src/config.ts:11`

Currently `apiBaseUrl: 'http://localhost:5029'` is a TypeScript constant, so the CI env var `VITE_API_BASE_URL` is **ignored**. Change to:

```ts
apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5029',
```

Also update `.github/workflows/pipeline.yml:45` to pass the correct default (`http://localhost:5062` currently points at nothing useful post-deploy) — or better, leave CI as-is and pass the real URL only in the deploy workflow.

### 2. Add a Dockerfile for the API — `src/api/Dockerfile`

Multi-stage, based on `mcr.microsoft.com/dotnet/aspnet:10.0` / `sdk:10.0`, exposes port 8080, non-root user. Standard ASP.NET Core container pattern. Published via GHCR from GH Actions using `docker/build-push-action`.

### 3. Make CORS origin configurable — `src/api/Program.cs:49-52`

Replace `policy.WithOrigins("http://localhost:5173")` with a list read from config (e.g. `Cors:AllowedOrigins` array), so staging allows the staging SWA and prod allows the prod SWA. Defaults unchanged for local dev.

### 4. Handle forwarded headers / HTTPS redirect behind Container Apps — `src/api/Program.cs:85`

Container Apps terminates TLS at the ingress; the app sees HTTP. Either remove `UseHttpsRedirection()` in non-dev or add `ForwardedHeaders` middleware so ASP.NET trusts `X-Forwarded-Proto`. Preferred: forwarded headers.

### 5. Read Cosmos connection from env var at runtime

Already works out-of-the-box: ASP.NET Core binds `CosmosDb__ConnectionString` env var into `CosmosDb.ConnectionString` via configuration providers. Container Apps will inject this as a **Key Vault secret reference**, so no code change — just don't commit any prod connection string to `appsettings.json`.

---

## Terraform State

**Backend:** `azurerm` (Terraform's first-party Azure remote state backend). State lives in an Azure Storage Account blob container.

**Layout:**
```
Resource group:   kanban-shared-rg
Storage account:  kanbantfstate           (Standard_LRS, smallest tier)
Blob container:   tfstate
State files:      staging.tfstate
                  prod.tfstate
```

**Why two state files instead of Terraform workspaces:** Workspaces all share the same backend key by default, and they're easy to mis-select on the command line. Two named state files (`-backend-config="key=staging.tfstate"`) make it impossible to apply staging config against the prod state by accident.

**Locking:** The `azurerm` backend uses **blob leases** for state locking — automatic, no separate lock table (unlike AWS S3 + DynamoDB). Concurrent runs from CI and laptop are safe; the second one waits or fails fast.

**Bootstrap chicken-and-egg:** The state storage account can't be managed by the Terraform that uses it. Create it once by hand:

```bash
az group create -n kanban-shared-rg -l uksouth
az storage account create -n kanbantfstate -g kanban-shared-rg -l uksouth --sku Standard_LRS
az storage container create --account-name kanbantfstate -n tfstate
```

This is the **only** manual Azure resource. Everything else is Terraform-managed.

**Access from CI:** The GH Actions OIDC managed identity needs `Storage Blob Data Contributor` on `kanbantfstate`. Granted by Terraform itself once the identity exists, or manually for the bootstrap.

**Access from laptop:** `az login` → `terraform init -backend-config="key=staging.tfstate"`. The user's Azure account (Owner on the subscription) already has the storage permissions.

**State file contents are sensitive** (they include Cosmos connection strings as outputs by default). The blob container is private; only authenticated principals with the data role can read it. Do not output Key Vault secret values from Terraform — reference them via `data "azurerm_key_vault_secret"` blocks at consumption time so they never land in state. (Cosmos primary keys read from the Cosmos resource will still be in state — that's unavoidable for Terraform-managed Cosmos. The mitigation is access control on the state container.)

---

## Local Iteration Strategy

The deploy pipeline has three layers that can fail independently. Test them in this order, locally, before involving GitHub Actions at all. This separates "did my Terraform work?" from "did my container work?" from "did my YAML work?".

### Layer 1 — Terraform (fully local)
Everything runs from the laptop with `az login`:
- `terraform fmt` / `terraform validate` — syntax + reference checks (zero Azure calls).
- `terraform plan -var-file=staging.tfvars` — reads real state from the backend, shows planned changes, makes no mutations. Catches ~80% of mistakes.
- `terraform apply -var-file=staging.tfvars` — provisions the staging stack from the laptop. The CI pipeline does literally the same thing later; testing it locally first means CI isn't the place you discover Terraform bugs.

**You can build out the entire staging Azure footprint without ever touching GitHub Actions.**

### Layer 2 — API container (fully local)
- `docker build -t kanban-api:dev src/api/` — verifies the Dockerfile.
- `docker run -p 8080:8080 -e CosmosDb__ConnectionString="<staging-connection>" kanban-api:dev` — runs the image against the **real staging Cosmos DB** from the laptop. Verifies the container starts, the app reads config from env vars correctly, and the Cosmos client can authenticate over the public endpoint.
- Once happy: `docker login ghcr.io -u <user> -p <PAT>` and `docker push ghcr.io/<user>/kanban-api:dev`. This is exactly what the GH Actions step does.
- `az containerapp update --name kanban-api-staging --image ghcr.io/<user>/kanban-api:dev` — deploys the laptop-built image to the staging Container App by hand. End-to-end verification of the container path, no YAML involved.

### Layer 3 — Frontend (fully local)
- `VITE_API_BASE_URL=https://kanban-api-staging.<random>.azurecontainerapps.io VITE_STORAGE_BACKEND=api npm run build` — produces a `dist/` configured for the staging API.
- `npx @azure/static-web-apps-cli deploy ./dist --deployment-token <token-from-portal>` — deploys to the staging SWA from the laptop. Verifies the build pipeline and API URL plumbing.

### Layer 4 — GitHub Actions YAML (the only step that requires pushing)
Once layers 1–3 are working by hand:
- Static-check the YAML locally with `actionlint` (`brew install actionlint && actionlint`). Catches syntax + obvious errors.
- Optionally simulate jobs with [`act`](https://github.com/nektos/act) (`brew install act`). Imperfect for OIDC + Azure auth, but good for shaping the workflow structure.
- Push to `deploy-proto` and iterate. Because layers 1–3 already work, any failure here is unambiguously a YAML / GH Actions / OIDC issue, not a Terraform or container or frontend issue.

**Two things that genuinely cannot be tested off-GitHub:**
1. The OIDC federated credential trust relationship — it only fires when `actions/checkout` runs in real GH Actions.
2. GitHub Environment protection rules and the manual approval prompt.

Everything else has a local equivalent.

---

## Secrets & Configuration Management

| Secret / config | Stored in | Surfaced to app via |
|---|---|---|
| Cosmos connection string (staging) | Key Vault secret `cosmos-connection-staging` | Container App secret → env var `CosmosDb__ConnectionString` |
| Cosmos connection string (prod) | Key Vault secret `cosmos-connection-prod` | Same pattern, prod app |
| Allowed CORS origin (per env) | Container App env var (not secret) | `Cors__AllowedOrigins__0` |
| `VITE_API_BASE_URL` (per env) | GitHub Actions environment variable | Baked into Vite build at deploy time |
| Azure subscription / tenant IDs | GitHub Actions environment **variables** (not secrets) | `azure/login` action |
| Managed identity client ID | GitHub Actions environment **variables** | OIDC federated credential |

**No long-lived secrets in GitHub.** OIDC federation + Key Vault + managed identity means zero secret material leaves Azure.

GitHub Actions **Environments** (`staging`, `production`) hold per-env variables and enforce the manual-approval gate on `production`.

---

## CI/CD Workflow

> **Branch strategy during pipeline development:** All deploy work happens on the `deploy-proto` branch first. The deploy workflow triggers on pushes to `deploy-proto` so the user can iterate on Terraform, the Dockerfile, and GH Actions YAML against real Azure resources. **While on `deploy-proto`, only the staging path runs** — production jobs are gated behind a `if: github.ref == 'refs/heads/main'` condition and never fire. This eliminates any risk of touching prod resources during iteration. When the pipeline is stable, the branch trigger flips from `deploy-proto` to `main`, and the prod jobs become active automatically.

Extend `.github/workflows/pipeline.yml` with a new `deploy` workflow (or new jobs gated on the existing `frontend` / `api` / `e2e` jobs succeeding on `deploy-proto`):

```
push to deploy-proto   (later: main)
  └─ frontend (existing)   ─┐
  └─ api      (existing)   ─┼─ all green ──┐
  └─ e2e      (existing)   ─┘              │
                                           ▼
                              ┌─ build-and-push-image (GHCR)
                              ├─ deploy-api-staging (Container Apps revision update)
                              └─ deploy-web-staging (SWA deploy, VITE_API_BASE_URL = staging API FQDN)
                                           │
                                           ▼
                              ─── only when ref == main ───
                                           │
                              [Manual approval — GitHub Environment: production]
                                           │
                              ├─ deploy-api-prod (same image tag → prod Container App)
                              └─ deploy-web-prod (SWA deploy, VITE_API_BASE_URL = prod API FQDN)
```

Key details:
- **Branch trigger today**: `on: push: branches: [deploy-proto, main]`. The prod jobs carry `if: github.ref == 'refs/heads/main'`, so pushes to `deploy-proto` only run staging. When iteration is done, no trigger change is needed — merging to `main` automatically lights up the prod jobs.
- **Existing E2E job needs widening**: `.github/workflows/pipeline.yml:80` currently restricts the E2E job to `github.ref == 'refs/heads/main'` + main-targeting PRs. Widen to also include `refs/heads/deploy-proto` so the gating tests run on this branch. Revert (or leave) when promoting.
- **No prod resources are touched from `deploy-proto`**: the prod Container App, prod SWA deploy, and prod approval gate are all conditional on `ref == main`. Zero risk of accidental prod deploys during iteration.
- **One image, promoted**: when prod runs (post-merge), it re-deploys the same image tag (git SHA) the staging step pushed — guarantees staging and prod run identical binaries.
- **Frontend is rebuilt per environment** because `VITE_API_BASE_URL` is compiled in. Small cost, big clarity win.
- Deployments use `azure/login@v2` (OIDC), `azure/container-apps-deploy-action`, and `Azure/static-web-apps-deploy`.

### OIDC federated credential — important branch detail

The user-assigned managed identity used for `azure/login` has its **federated credential subject** scoped to a specific branch (e.g. `repo:rosslarge/kanban:ref:refs/heads/deploy-proto`). To support both branches during the transition, register **two federated credentials** on the same identity — one for `deploy-proto`, one for `main`. The `production` environment credential is scoped by GH Environment instead (`repo:rosslarge/kanban:environment:production`), which is branch-agnostic and needs no change.

---

## Files to Create / Modify

**Create:**
- `src/api/Dockerfile` — multi-stage ASP.NET Core container
- `src/api/.dockerignore`
- `infra/` — Terraform configuration using the `azurerm` provider. Declares RGs, Cosmos, Key Vault, Container Apps Environment, two Container Apps, two SWAs, managed identities, role assignments. Root `main.tf` + `variables.tf` + `outputs.tf`, with per-environment `.tfvars` files (`staging.tfvars`, `prod.tfvars`).
- **Remote state backend**: an `azurerm` backend pointing at a dedicated storage account (`kanbantfstate`) in a `kanban-shared-rg` resource group. Created once by hand via `az storage account create`, then referenced in `terraform { backend "azurerm" {} }`.
- `.github/workflows/deploy.yml` — the deploy pipeline above. (Or extend `pipeline.yml`.)

**Modify:**
- `src/config.ts:11` — read `VITE_API_BASE_URL` from env
- `src/api/Program.cs:47-53` — configurable CORS origins
- `src/api/Program.cs:84-85` — forwarded headers, conditional HTTPS redirect
- `src/api/appsettings.json` — add empty `Cors:AllowedOrigins` default

---

## Verification

1. **Terraform apply succeeds** — `terraform init` against the remote `azurerm` backend, then `terraform apply -var-file=staging.tfvars` followed by `terraform apply -var-file=prod.tfvars` creates all resources. Portal check confirms Cosmos free tier is active and Container Apps can reach Key Vault (managed identity has `Key Vault Secrets User` role).
2. **First staging deploy** — push a change to `deploy-proto`; watch GH Actions deploy staging; verify the staging SWA loads, can create/move/delete a card, and the data lands in the `kanban-staging` Cosmos database (portal Data Explorer).
3. **Manual promotion** — once promoted to `main`, click approve on the GH Actions `production` gate; verify prod SWA loads with the same card data schema but an empty `kanban-prod` database; verify no cross-contamination.
4. **Scale-to-zero sanity check** — leave the API idle for ~10 min, hit the prod SWA, confirm first request cold-starts successfully and subsequent requests are warm.
5. **Secret rotation dry-run** — rotate the Cosmos key in the portal, update Key Vault secret, confirm Container App picks up the new value on next revision (or via `az containerapp secret set`). No code or GH secrets touched.

---

## Decisions (resolved during planning)

- **Compute**: Azure Container Apps (consumption plan) — scales to zero, supports .NET 10, one image promoted staging → prod.
- **Container registry**: GitHub Container Registry. Accepted trade-off: PAT stored as a Container App secret (rotated periodically) and slightly slower cold-start image pulls. Chosen to avoid ACR's post-12-month Standard tier cost.
- **IaC**: Terraform (`azurerm` provider) with remote state in a dedicated Azure storage account.
- **Domains**: Default Azure subdomains (`*.azurestaticapps.net`, `*.azurecontainerapps.io`). Custom domains deferred.
- **Observability**: Application Insights (workspace-based) wired in from day one for both the API and the frontend.
- **Iteration branch**: All deploy work happens on `deploy-proto`. While on this branch, only the staging path runs (prod jobs gated by `if: github.ref == 'refs/heads/main'`). Merging to `main` activates the prod jobs with no further pipeline changes.
