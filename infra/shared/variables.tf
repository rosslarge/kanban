variable "shared_resource_group_name" {
  type        = string
  description = "Name of the pre-existing resource group that holds the Terraform state storage account and the shared infra (Cosmos, Key Vault, etc.). Created manually via the bootstrap step."
  default     = "kanban-shared-rg"
}

variable "operator_principal_id" {
  type        = string
  description = "Azure AD object ID of the human operator. Granted Key Vault Secrets Officer so both the operator and CI can manage secrets."
  default     = "86e9f194-b258-4261-81a2-0bddc4c00179"
}

variable "cicd_principal_id" {
  type        = string
  description = "Azure AD object ID of the CI/CD managed identity (mi-kanban-cicd)."
  default     = "37358326-637f-4fc1-89ec-d29aef269590"
}
