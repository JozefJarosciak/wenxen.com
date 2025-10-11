ah, # XEN Tracker - AWS Lambda Deployment

This guide helps you deploy the XEN Tracker to AWS Lambda for cost-effective, serverless hosting.

## 🌟 Why AWS Lambda?

- **Cost-effective**: Pay only when someone visits your site (typically $1-3/month for 10k visits)
- **Serverless**: No servers to manage, automatic scaling
- **Global CDN**: CloudFront provides fast global access
- **HTTPS**: Automatic SSL/TLS certificates with custom domain support

## 📋 Prerequisites

1. **AWS Account**: [Sign up here](https://aws.amazon.com/free/)
2. **AWS CLI**: [Installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
3. **Terraform**: [Download here](https://www.terraform.io/downloads)

## 🔧 Setup AWS Credentials

### Option 1: Easy Setup (Windows)
Run the configuration script:
```cmd
cd deployment
initial-configure-aws.bat
```

### Option 2: Manual Setup
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your preferred region (e.g., us-east-1)
# Enter output format (json)
```

## 🚀 Deployment Instructions

### Initial Setup (First Time Only)
```bash
cd deployment
initial-deploy.bat
```
This creates all AWS infrastructure (Lambda, API Gateway, CloudFront, SSL certificates).

**Wait time**: 5-15 minutes for complete setup (SSL + DNS propagation)

### Updating Your Site (After Changes)
```bash
cd deployment
wenxen-deploy.bat
```
This script automatically:
1. **Updates cache-busting version numbers** in index.html (adds timestamp to ?v= parameters)
2. **Deploys to Lambda** with latest files
3. **Invalidates CloudFront cache** for immediate propagation

**Wait time**: 1-2 minutes for changes to appear globally

### Step 3: Verify Deployment
After deployment completes, visit:
- https://wenxen.com
- https://www.wenxen.com

**Note**: You may need to hard refresh (Ctrl+F5) to see changes immediately.

## 📁 Project Structure

```
wenxen.com/
├── deployment/                    # All deployment files
│   ├── main.tf                   # Terraform infrastructure
│   ├── lambda_handler.py         # AWS Lambda function
│   ├── initial-configure-aws.bat # First-time AWS setup
│   ├── initial-deploy.bat        # First deployment (creates infrastructure)
│   ├── wenxen-deploy.bat         # Update deployment (after changes)
│   ├── get-wenxen-costs.bat      # Quick cost check
│   ├── RunAWSCosts.bat           # Detailed cost dashboard
│   └── GenerateCostDashboard.bat # Cost report generator
├── css/                          # Stylesheets
├── js/                           # JavaScript files
│   ├── config/                   # Chain configurations
│   ├── scanners/                 # Blockchain scanners
│   ├── ui/                       # UI components
│   └── ...
├── ABI/                          # Smart contract ABIs
└── index.html                    # Main HTML file
```

## 📂 What Gets Created

The deployment creates these AWS resources:

- **Lambda Function**: Serves your static files
- **API Gateway**: HTTP endpoint for the Lambda function  
- **CloudFront**: Global CDN for fast loading
- **Security Headers**: Proper security policies
- **IAM Role**: Permissions for Lambda execution

## 💰 Cost Breakdown

For a typical usage of 10,000 page views per month:

| Service | Cost | Description |
|---------|------|-------------|
| Lambda | ~$0.50 | Pay per request + execution time |
| API Gateway | ~$1.00 | HTTP API calls |
| CloudFront | ~$0.50 | CDN data transfer |
| **Total** | **~$2.00/month** | Plus AWS Free Tier benefits |

### AWS Free Tier Benefits
- Lambda: 1M free requests per month
- CloudFront: 50GB free data transfer per month
- API Gateway: 1M free requests per month

## 🔧 Configuration Options

### Environment Variables

Set these before deployment:

```bash
# Windows
set PROJECT_NAME=my-xen-tracker
set AWS_REGION=us-east-1
set DOMAIN_NAME=tracker.mydomain.com

# Linux/Mac
export PROJECT_NAME=my-xen-tracker
export AWS_REGION=us-east-1
export DOMAIN_NAME=tracker.mydomain.com
```

### Custom Domain (Optional)

To use your own domain:

1. Set `DOMAIN_NAME` environment variable
2. Deploy with: `./deploy.sh`
3. Add CNAME record in your DNS:
   ```
   tracker.mydomain.com -> d1234567890.cloudfront.net
   ```

## 🔄 Updating Your Site

After making changes to your HTML, CSS, JS, or configuration files:

```bash
cd deployment
wenxen-deploy.bat
```

This will automatically:
1. **Update cache-busting version numbers** - Adds timestamps to all `?v=` parameters in index.html
2. **Deploy to Lambda** - Uploads all updated files
3. **Invalidate CloudFront cache** - Forces global CDN refresh

**Changes appear in**: 1-2 minutes globally

**Pro tip**: The script handles version numbering automatically, so you don't need to manually update cache-busting parameters!

## 🛠️ Manual Terraform Commands

All Terraform commands must be run from the `deployment` directory:

```bash
cd deployment
```

### Initialize Terraform
```bash
terraform init
```

### Plan Deployment (Preview Changes)
```bash
terraform plan -var="project_name=xen-tracker" -var="aws_region=us-east-1" -var="domain_name=wenxen.com"
```

### Apply Changes Manually
```bash
terraform apply -var="project_name=xen-tracker" -var="aws_region=us-east-1" -var="domain_name=wenxen.com" -auto-approve
```

### Destroy Everything (CAUTION)
```bash
terraform destroy -var="project_name=xen-tracker" -var="aws_region=us-east-1" -var="domain_name=wenxen.com"
```

**Note**: The `wenxen-deploy.bat` script handles all of this automatically. Manual commands are only needed for troubleshooting.

## 🔍 Troubleshooting

### Common Issues

**1. "AWS credentials not configured"**
```bash
aws configure
# Enter your Access Key ID, Secret Access Key, and region
```

**2. "Terraform not found"**
- Download from [terraform.io](https://www.terraform.io/downloads)
- Add to your system PATH

**3. "Terraform not in PATH"**
- The script will try to find Terraform at `C:\terraform\terraform.exe`
- Add Terraform to your system PATH or place it in `C:\terraform\`

**4. CloudFront takes time to propagate**
- Initial deployment: ~15 minutes for SSL + DNS
- Updates: 1-2 minutes for cache invalidation
- Hard refresh browser (Ctrl+F5) to see immediate changes

### Getting Support

1. Check AWS CloudWatch Logs for Lambda errors
2. Verify your file paths are correct
3. Ensure all static files are in the project directory

## 🔐 Security Features

The deployment includes:

- **HTTPS Only**: All traffic redirected to HTTPS
- **Security Headers**: HSTS, Content Security Policy, etc.
- **CORS Configuration**: Proper cross-origin settings
- **Access Logging**: CloudWatch integration

## 🌍 Global Performance

CloudFront edge locations provide fast loading worldwide:

- **200+ Edge Locations**: Servers in major cities globally
- **Automatic Compression**: Gzip/Brotli for faster loading
- **HTTP/2 Support**: Modern protocol for better performance
- **Smart Caching**: Static assets cached for 1 year, HTML for 5 minutes

## 📊 Monitoring & Cost Tracking

### Deployment Metrics
Access your deployment metrics:

1. **AWS Console** → **Lambda** → **Functions** → `xen-tracker-static-site`
2. **CloudWatch** for logs and metrics
3. **CloudFront** → **Distributions** for CDN stats

### Cost Monitoring
The project includes built-in cost tracking tools:

#### Quick Cost Check
```bash
cd deployment
get-wenxen-costs.bat
```
Shows a quick summary of your AWS costs.

#### Detailed Cost Dashboard
```bash
cd deployment
RunAWSCosts.bat
```
Generates a comprehensive HTML cost report with:
- Daily cost breakdown
- Service-level costs
- Historical trends
- Cost forecasting

#### Generate Custom Report
```bash
cd deployment
GenerateCostDashboard.bat
```
Creates a new cost report in the deployment directory.

## 🔄 Backup & Recovery

Your infrastructure is defined as code in `deployment/main.tf`. To backup:

```bash
cd deployment

# Backup Terraform state
cp terraform.tfstate terraform.tfstate.backup

# Export infrastructure
terraform show > infrastructure-backup.txt
```

## 📈 Scaling

This setup automatically scales:

- **Lambda**: Handles 1000+ concurrent requests
- **API Gateway**: 10,000 RPS default limit
- **CloudFront**: Unlimited global traffic

For higher limits, contact AWS support.

---

**Need help?** Check the [main README](README.md) for application-specific questions.