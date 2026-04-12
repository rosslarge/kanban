output "resource_group_name" {
  value       = azurerm_resource_group.env.name
  description = "Resource group containing this environment's per-env resources."
}

output "container_app_name" {
  value       = azurerm_container_app.api.name
  description = "Name of the Container App. Used by `az containerapp update` from CI."
}

output "container_app_url" {
  value       = "https://${azurerm_container_app.api.ingress[0].fqdn}"
  description = "Public HTTPS URL of the API. Use this as VITE_API_BASE_URL when building the frontend."
}

output "static_web_app_name" {
  value       = azurerm_static_web_app.frontend.name
  description = "Name of the Static Web App."
}

output "static_web_app_url" {
  value       = "https://${azurerm_static_web_app.frontend.default_host_name}"
  description = "Public HTTPS URL of the frontend. Set this as the API's allowed_origin."
}

output "static_web_app_deployment_token" {
  value       = azurerm_static_web_app.frontend.api_key
  description = "Deployment token for `swa deploy`. Sensitive — fetch via `terraform output -raw`."
  sensitive   = true
}

output "managed_identity_client_id" {
  value       = azurerm_user_assigned_identity.app.client_id
  description = "Client ID of the Container App's managed identity. Used by Container Apps to authenticate to Key Vault."
}

output "cosmos_database_name" {
  value       = azurerm_cosmosdb_sql_database.env.name
  description = "Name of this environment's Cosmos database."
}
