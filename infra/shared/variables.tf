variable "shared_resource_group_name" {
  type        = string
  description = "Name of the pre-existing resource group that holds the Terraform state storage account and the shared infra (Cosmos, Key Vault, etc.). Created manually via the bootstrap step."
  default     = "kanban-shared-rg"
}
