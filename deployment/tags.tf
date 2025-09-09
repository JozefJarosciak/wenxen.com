# Resource Tags Configuration for WenXen.com
# These tags are used for cost tracking and resource organization
# The "Project" tag is essential for the cost analysis tools to work correctly

locals {
  common_tags = {
    Project     = "wenxen-com"      # Used by get-wenxen-costs.bat for cost filtering
    Application = "wenxen"           # Application name
    Environment = "production"       # Environment type
    ManagedBy   = "terraform"        # Infrastructure as Code tool
  }
}

# Note: The AWS provider with default_tags is configured in main.tf