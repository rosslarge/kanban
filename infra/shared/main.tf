terraform {
  required_version = ">= 1.6"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "azurerm" {
    # Backend values are supplied via:
    #   terraform init -backend-config=backend.hcl
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

# The shared resource group is created manually as part of the state-bootstrap
# step (see infra/README.md). Reference it as a data source so Terraform never
# tries to manage the resource group that holds its own state file.
data "azurerm_resource_group" "shared" {
  name = var.shared_resource_group_name
}

data "azurerm_client_config" "current" {}

# Random suffix appended to globally-unique names (Cosmos account, Key Vault).
resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
  numeric = true
}

# ── Observability ──────────────────────────────────────────────────────────

resource "azurerm_log_analytics_workspace" "main" {
  name                = "kanban-law"
  location            = data.azurerm_resource_group.shared.location
  resource_group_name = data.azurerm_resource_group.shared.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_application_insights" "main" {
  name                = "kanban-ai"
  location            = data.azurerm_resource_group.shared.location
  resource_group_name = data.azurerm_resource_group.shared.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
}

# ── Container Apps Environment ─────────────────────────────────────────────
# Both the staging and prod Container Apps live inside this single environment
# (which gives them shared networking and a shared Log Analytics workspace).

resource "azurerm_container_app_environment" "main" {
  name                       = "kanban-cae"
  location                   = data.azurerm_resource_group.shared.location
  resource_group_name        = data.azurerm_resource_group.shared.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

# ── Cosmos DB account (free tier, single region) ───────────────────────────
# A single account holds two databases, one per environment. Free tier gives
# 1000 RU/s + 25 GB forever — sufficient for a personal app with two envs.

resource "azurerm_cosmosdb_account" "main" {
  name                       = "kanban-cosmos-${random_string.suffix.result}"
  location                   = "uksouth"
  resource_group_name        = data.azurerm_resource_group.shared.name
  offer_type                 = "Standard"
  kind                       = "GlobalDocumentDB"
  free_tier_enabled          = true
  automatic_failover_enabled = true

  consistency_policy {
    consistency_level       = "Session"
    max_interval_in_seconds = 5
    max_staleness_prefix    = 100
  }

  geo_location {
    location          = "uksouth"
    failover_priority = 0
    zone_redundant    = false
  }
}

# ── Key Vault ──────────────────────────────────────────────────────────────
# RBAC mode (not access policies). Per-env Cosmos connection strings are
# written here by the env layer. Container Apps read them via Key Vault
# secret references with their managed identity.

resource "azurerm_key_vault" "main" {
  name                       = "kanban-kv-${random_string.suffix.result}"
  location                   = data.azurerm_resource_group.shared.location
  resource_group_name        = data.azurerm_resource_group.shared.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  soft_delete_retention_days = 7
  purge_protection_enabled   = false
}

# Grant the human operator Key Vault Secrets Officer so they can manage
# secrets from the portal or CLI.
resource "azurerm_role_assignment" "operator_kv_secrets_officer" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = var.operator_principal_id
}

# Grant the CI/CD managed identity Key Vault Secrets Officer so the env
# layer Terraform can create/update cosmos-connection-{env} secrets.
resource "azurerm_role_assignment" "cicd_kv_secrets_officer" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = var.cicd_principal_id
}
