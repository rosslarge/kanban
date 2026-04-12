variable "environment" {
  type        = string
  description = "Environment name. Drives resource names and the Cosmos database name."

  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "environment must be either 'staging' or 'prod'."
  }
}

variable "allowed_origin" {
  type        = string
  description = "Frontend origin allowed by CORS on the API. Set to the SWA URL after the first apply."
  default     = ""
}

variable "bootstrap_container_image" {
  type        = string
  description = "Container image used when the Container App is first created. The CI pipeline overrides this on every deploy. Should be a public image so the first apply succeeds before GHCR is wired up."
  default     = "mcr.microsoft.com/k8se/quickstart:latest"
}

# ── Remote-state references for the shared layer ───────────────────────────

variable "tfstate_storage_account_name" {
  type        = string
  description = "Name of the storage account holding all Terraform state files."
  default     = "kanbantfstate"
}

variable "tfstate_container_name" {
  type        = string
  description = "Blob container holding Terraform state files."
  default     = "tfstate"
}

variable "shared_state_resource_group" {
  type        = string
  description = "Resource group containing the state storage account."
  default     = "kanban-shared-rg"
}

variable "shared_state_key" {
  type        = string
  description = "Blob key for the shared layer's state file."
  default     = "shared.tfstate"
}
