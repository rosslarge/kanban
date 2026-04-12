output "shared_resource_group_name" {
  value       = data.azurerm_resource_group.shared.name
  description = "Name of the resource group hosting the shared infra."
}

output "location" {
  value       = data.azurerm_resource_group.shared.location
  description = "Azure region used by all resources in this stack."
}

output "name_suffix" {
  value       = random_string.suffix.result
  description = "Random suffix used to globally-unique-ify Cosmos and Key Vault names."
}

output "container_app_environment_id" {
  value       = azurerm_container_app_environment.main.id
  description = "ID of the Container Apps Environment that hosts both staging and prod apps."
}

output "cosmos_account_name" {
  value       = azurerm_cosmosdb_account.main.name
  description = "Name of the shared Cosmos DB account."
}

output "cosmos_account_id" {
  value       = azurerm_cosmosdb_account.main.id
  description = "Resource ID of the shared Cosmos DB account."
}

output "cosmos_account_endpoint" {
  value       = azurerm_cosmosdb_account.main.endpoint
  description = "HTTPS endpoint of the Cosmos account, used to build connection strings."
}

output "cosmos_primary_key" {
  value       = azurerm_cosmosdb_account.main.primary_key
  description = "Primary access key for the Cosmos account. Stored in remote state — protect the state container."
  sensitive   = true
}

output "key_vault_id" {
  value       = azurerm_key_vault.main.id
  description = "Resource ID of the shared Key Vault."
}

output "key_vault_uri" {
  value       = azurerm_key_vault.main.vault_uri
  description = "DNS URI of the shared Key Vault, used in Container App secret references."
}

output "application_insights_connection_string" {
  value       = azurerm_application_insights.main.connection_string
  description = "App Insights connection string injected into both Container Apps."
  sensitive   = true
}

output "log_analytics_workspace_id" {
  value       = azurerm_log_analytics_workspace.main.id
  description = "Workspace ID for App Insights and Container Apps logs."
}
