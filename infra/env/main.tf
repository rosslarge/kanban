terraform {
  required_version = ">= 1.6"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  backend "azurerm" {
    # Backend values are supplied via:
    #   terraform init -backend-config=backend.staging.hcl
    #   terraform init -backend-config=backend.prod.hcl
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
}

# Read the outputs of the shared layer (Cosmos account, Key Vault, Container
# Apps Environment, App Insights). Both staging and prod env states reference
# the same shared state file.
data "terraform_remote_state" "shared" {
  backend = "azurerm"
  config = {
    resource_group_name  = var.shared_state_resource_group
    storage_account_name = var.tfstate_storage_account_name
    container_name       = var.tfstate_container_name
    key                  = var.shared_state_key
    use_azuread_auth     = true
  }
}

locals {
  rg_name      = "kanban-${var.environment}-rg"
  api_app_name = "kanban-api-${var.environment}"
  swa_name     = "kanban-swa-${var.environment}"
  mi_name      = "mi-kanban-${var.environment}"
  db_name      = "kanban-${var.environment}"
  secret_name  = "cosmos-connection-${var.environment}"
}

# ── Resource group for this environment ────────────────────────────────────

resource "azurerm_resource_group" "env" {
  name     = local.rg_name
  location = data.terraform_remote_state.shared.outputs.location
}

# ── Cosmos DB database + container (inside the shared account) ─────────────

resource "azurerm_cosmosdb_sql_database" "env" {
  name                = local.db_name
  resource_group_name = data.terraform_remote_state.shared.outputs.shared_resource_group_name
  account_name        = data.terraform_remote_state.shared.outputs.cosmos_account_name
}

resource "azurerm_cosmosdb_sql_container" "cards" {
  name                = "cards"
  resource_group_name = data.terraform_remote_state.shared.outputs.shared_resource_group_name
  account_name        = data.terraform_remote_state.shared.outputs.cosmos_account_name
  database_name       = azurerm_cosmosdb_sql_database.env.name
  partition_key_paths = ["/userId"]
}

# ── Cosmos connection string stored as a Key Vault secret ──────────────────
# The Container App reads this via a Key Vault secret reference rather than an
# env-var literal, so the connection string never appears in plain text on the
# Container Apps resource.

resource "azurerm_key_vault_secret" "cosmos_connection" {
  name         = local.secret_name
  key_vault_id = data.terraform_remote_state.shared.outputs.key_vault_id
  value        = "AccountEndpoint=${data.terraform_remote_state.shared.outputs.cosmos_account_endpoint};AccountKey=${data.terraform_remote_state.shared.outputs.cosmos_primary_key};"
}

# ── Managed identity used by the Container App to read the secret ──────────

resource "azurerm_user_assigned_identity" "app" {
  name                = local.mi_name
  location            = azurerm_resource_group.env.location
  resource_group_name = azurerm_resource_group.env.name
}

resource "azurerm_role_assignment" "app_kv_secrets_user" {
  scope                = data.terraform_remote_state.shared.outputs.key_vault_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# ── Container App ──────────────────────────────────────────────────────────
# The image is set to a public bootstrap image on first apply. The CI pipeline
# updates it on each deploy via `az containerapp update --image ...`, and the
# lifecycle.ignore_changes block below stops Terraform from rolling it back.

resource "azurerm_container_app" "api" {
  name                         = local.api_app_name
  resource_group_name          = azurerm_resource_group.env.name
  container_app_environment_id = data.terraform_remote_state.shared.outputs.container_app_environment_id
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  secret {
    name                = "cosmos-connection"
    key_vault_secret_id = azurerm_key_vault_secret.cosmos_connection.versionless_id
    identity            = azurerm_user_assigned_identity.app.id
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 0
    max_replicas = 1

    container {
      name   = "api"
      image  = var.bootstrap_container_image
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name        = "CosmosDb__ConnectionString"
        secret_name = "cosmos-connection"
      }
      env {
        name  = "CosmosDb__DatabaseName"
        value = local.db_name
      }
      env {
        name  = "Cors__AllowedOrigins__0"
        value = var.allowed_origin
      }
      env {
        name  = "ApplicationInsights__ConnectionString"
        value = data.terraform_remote_state.shared.outputs.application_insights_connection_string
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].container[0].image,
    ]
  }

  depends_on = [azurerm_role_assignment.app_kv_secrets_user]
}

# ── Static Web App for the frontend ────────────────────────────────────────
# SWA Free tier is only available in a fixed set of backend regions
# (West US 2, Central US, East US 2, West Europe, East Asia). The CDN fronting
# the app serves globally, so this `location` only affects the deploy backplane,
# not user-perceived latency.

resource "azurerm_static_web_app" "frontend" {
  name                = local.swa_name
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  sku_tier            = "Free"
  sku_size            = "Free"
}
