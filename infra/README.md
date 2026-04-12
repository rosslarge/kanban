# Infrastructure (Terraform)

Provisions the Azure resources for the kanban app: Cosmos DB, Container Apps,
Static Web Apps, Key Vault, Application Insights, and the supporting bits.

See [`docs/deployment-plan.md`](../docs/deployment-plan.md) for the full
architecture and rationale.

## Layout

```
infra/
├── shared/   # Cross-environment resources
│              # Cosmos account, Key Vault, Container Apps Environment,
│              # App Insights, Log Analytics workspace.
└── env/      # Per-environment resources, applied twice with different tfvars.
               # Resource group, Container App, SWA, managed identity,
               # Cosmos database/container, Key Vault secret.
```

Three remote state files in the `tfstate` blob container of the
`kanbantfstate` storage account:

| State file        | Created by         | Contents                                  |
|-------------------|--------------------|-------------------------------------------|
| `shared.tfstate`  | `infra/shared/`    | Resources shared by both environments     |
| `staging.tfstate` | `infra/env/` + staging.tfvars | Staging-only resources         |
| `prod.tfstate`    | `infra/env/` + prod.tfvars    | Prod-only resources            |

## One-time bootstrap

The state storage account itself can't be Terraform-managed (chicken-and-egg).
Run these once, by hand, before any `terraform init`:

```bash
az login
az account set --subscription <your-subscription-id>

az group create -n kanban-shared-rg -l westeurope
az storage account create -n kanbantfstate -g kanban-shared-rg -l westeurope --sku Standard_LRS
az storage container create --account-name kanbantfstate -n tfstate --auth-mode login
```

That's the **only** Azure resource you create by hand. Everything else is
Terraform-managed.

## First apply — shared layer

```bash
cd infra/shared
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

This creates:

- Log Analytics workspace + Application Insights
- Container Apps Environment
- Cosmos DB account (free tier, single region)
- Key Vault (RBAC mode)

## First apply — staging environment

```bash
cd ../env
terraform init -backend-config=backend.staging.hcl
terraform plan -var-file=staging.tfvars
terraform apply -var-file=staging.tfvars
```

This creates:

- `kanban-staging-rg` resource group
- Cosmos database `kanban-staging` + `cards` container
- Key Vault secret `cosmos-connection-staging`
- Managed identity + Key Vault RBAC role assignment
- Container App `kanban-api-staging` (running the bootstrap placeholder image)
- Static Web App `kanban-swa-staging`

After this apply succeeds, capture the URLs:

```bash
terraform output -raw container_app_url
terraform output -raw static_web_app_url
```

## Updating CORS after first apply

The Container App needs to allow the SWA URL via CORS, but the SWA URL only
exists *after* the first apply. So:

1. First apply: `allowed_origin = ""` — API allows nothing, but no UI exists
   yet either, so nothing to call it.
2. Capture the URL: `terraform output -raw static_web_app_url`
3. Set it in `staging.tfvars`: `allowed_origin = "https://kanban-swa-staging-XXX.azurestaticapps.net"`
4. `terraform apply -var-file=staging.tfvars` again — only the Container App
   env var changes.

This two-pass dance only happens on initial bootstrap.

## (Later) Adding production

Production lives in a separate state file. After staging is verified end-to-end:

```bash
# Wipe local backend cache so init switches to the prod backend cleanly
rm -rf .terraform .terraform.lock.hcl

terraform init -backend-config=backend.prod.hcl
terraform apply -var-file=prod.tfvars
```

Then re-init back to staging when iterating:

```bash
rm -rf .terraform .terraform.lock.hcl
terraform init -backend-config=backend.staging.hcl
```

> Yes, this re-init dance is the cost of using one config dir for both
> environments. The upside is **zero risk** of applying staging tfvars
> against prod state — you cannot do it without explicitly re-initing.

## Outputs needed by GitHub Actions later

When wiring up the deploy workflow, copy these into GH Actions environment
variables (or fetch them dynamically from a `terraform output` step):

```bash
terraform output -raw container_app_name
terraform output -raw container_app_url           # → VITE_API_BASE_URL
terraform output -raw static_web_app_name
terraform output -raw static_web_app_url
terraform output -raw managed_identity_client_id
terraform output -raw static_web_app_deployment_token  # sensitive — store as a GH secret
```

## Notes & known issues

- **Provider attribute drift.** This config targets `azurerm` 4.x. Some attribute
  names have moved between minor versions; if `terraform validate` complains
  about an unknown argument, check the registry docs for the version you have
  pinned in `.terraform.lock.hcl`.
- **`free_tier_enabled` is one-shot per subscription.** Once you provision the
  Cosmos account with `free_tier_enabled = true`, that subscription's free
  slot is consumed for the lifetime of the account. Destroying and recreating
  the account does *not* free the slot.
- **Region choice.** Everything lives in `westeurope` because Static Web Apps
  Free tier is only available in a small fixed set of regions (West US 2,
  Central US, East US 2, West Europe, East Asia) — `uksouth` is not on the
  list. UK→Amsterdam adds ~10ms vs UK→London, which is imperceptible for a
  personal app and worth the simplicity of one-region-everything. The SWA
  CDN serves globally regardless, so end-user latency is unaffected.
- **Bootstrap image.** The Container App is created with
  `mcr.microsoft.com/k8se/quickstart:latest` so the first apply succeeds
  before GHCR is wired up. The CI pipeline overrides this on every deploy.
