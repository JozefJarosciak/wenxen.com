# AWS Tagging and Cost Management for WenXen.com

## 📋 Overview

This document outlines the AWS resource tagging strategy and cost management approach for the WenXen.com application, implemented on **September 8, 2024**.

## 🏷️ Tagging Strategy

### Tag Schema
All WenXen.com AWS resources are tagged with the following consistent schema:

| Tag Key | Tag Value | Purpose |
|---------|-----------|---------|
| `Project` | `wenxen-com` | Identifies all resources belonging to WenXen.com |
| `Environment` | `production` | Indicates this is the live production environment |
| `Application` | `wenxen` | Application identifier for broader categorization |

### Tagged Resources

The following AWS resources have been tagged for cost tracking:

| Resource Type | Resource ID/Name | ARN/Identifier |
|---------------|------------------|----------------|
| **Lambda Function** | `xen-tracker-static-site` | `arn:aws:lambda:us-east-1:981666322065:function:xen-tracker-static-site` |
| **API Gateway** | `1cma2tpnn4` | `arn:aws:apigateway:us-east-1::/apis/1cma2tpnn4` |
| **CloudFront Distribution** | `E2GDRJ4M21BBPZ` | `arn:aws:cloudfront::981666322065:distribution/E2GDRJ4M21BBPZ` |
| **Route 53 Hosted Zone** | `Z033010536Z5ND5INFJY0` | wenxen.com domain |
| **IAM Role** | `xen-tracker-lambda-role` | Lambda execution role |

## 💰 Cost Analysis

### September 2024 Baseline Costs

**WenXen.com Related Services:**
- **Route 53**: $6.16 (DNS hosting)
- **Amazon S3**: $5.08 (Static assets storage)  
- **AWS Amplify**: $0.00008 (Minimal usage)
- **Total Core App Cost**: ~$11.24/month

**Additional Services:**
- **Amazon Registrar**: $36.00 (Annual domain registration)
- **Amazon Lightsail**: $4.17 (VPS hosting - if related)
- **Tax**: $6.74

## 🔧 Implementation Commands

### Initial Tagging (Completed September 8, 2024)

```bash
# Lambda Function
aws lambda tag-resource --resource "arn:aws:lambda:us-east-1:981666322065:function:xen-tracker-static-site" --tags Project=wenxen-com,Environment=production,Application=wenxen

# API Gateway
aws apigatewayv2 tag-resource --resource-arn "arn:aws:apigateway:us-east-1::/apis/1cma2tpnn4" --tags Project=wenxen-com,Environment=production,Application=wenxen

# CloudFront Distribution
aws cloudfront tag-resource --resource "arn:aws:cloudfront::981666322065:distribution/E2GDRJ4M21BBPZ" --tags Items='[{Key=Project,Value=wenxen-com},{Key=Environment,Value=production},{Key=Application,Value=wenxen}]'

# Route 53 Hosted Zone
aws route53 change-tags-for-resource --resource-type hostedzone --resource-id Z033010536Z5ND5INFJY0 --add-tags Key=Project,Value=wenxen-com Key=Environment,Value=production Key=Application,Value=wenxen

# IAM Role
aws iam tag-role --role-name xen-tracker-lambda-role --tags Key=Project,Value=wenxen-com Key=Environment,Value=production Key=Application,Value=wenxen
```

## 📊 Cost Queries

### Basic Cost Query
```bash
aws ce get-cost-and-usage \
  --time-period Start=2024-09-01,End=2024-09-30 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --filter '{
    "Tags": {
      "Key": "Project", 
      "Values": ["wenxen-com"]
    }
  }'
```

### Advanced Cost Query with Grouping
```bash
aws ce get-cost-and-usage \
  --time-period Start=2024-09-01,End=2024-09-30 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE Type=TAG,Key=Environment \
  --filter '{
    "Tags": {
      "Key": "Project", 
      "Values": ["wenxen-com"]
    }
  }'
```

## 🛠️ Automation Tools

### Cost Retrieval Script
Use the automated cost retrieval script: `deployment/get-wenxen-costs.bat`

**Available Options:**
- Previous month costs
- Current month costs  
- Last 30 days costs
- This year costs
- Next month cost forecast

**Usage:**
```cmd
cd deployment
get-wenxen-costs.bat
```

## 🔄 Maintenance

### Adding New Resources
When deploying new AWS resources for WenXen.com, ensure they are tagged with the same schema:

```bash
# Example for new S3 bucket
aws s3api put-bucket-tagging --bucket new-wenxen-bucket --tagging 'TagSet=[{Key=Project,Value=wenxen-com},{Key=Environment,Value=production},{Key=Application,Value=wenxen}]'

# Example for new Lambda function
aws lambda tag-resource --resource "arn:aws:lambda:us-east-1:ACCOUNT:function:NEW-FUNCTION" --tags Project=wenxen-com,Environment=production,Application=wenxen
```

### Cost Optimization Recommendations

1. **CloudFront Caching**: Ensure static assets (CSS/JS/ABI files) have long cache TTLs (current: 24 hours - 1 year)
2. **Lambda Memory**: Monitor Lambda memory usage and adjust if under-utilized (current: 512MB)
3. **API Gateway**: Consider switching to HTTP API if using REST API for lower costs
4. **Route 53**: Consolidate health checks and reduce query volumes if possible

### Monthly Review Process

1. Run `get-wenxen-costs.bat` to get current month costs
2. Compare against previous month using the script options
3. Review any unusual spikes in the AWS Console > Cost Explorer
4. Check for untagged resources: AWS Console > Resource Groups > Tag Editor

## 📈 Cost Forecasting

The cost retrieval script includes forecasting capabilities based on:
- Historical usage patterns
- Current month trends  
- AWS Cost Explorer predictions

### Expected Cost Range
- **Normal Operation**: $10-15/month
- **High Traffic Month**: $15-25/month
- **Domain Renewal Month**: +$36/year

## 🚨 Alerts and Monitoring

### Recommended Cost Alerts
Set up AWS Budgets for:
- **Monthly Budget**: $20 (150% of expected costs)
- **Forecasted Budget**: $25 (Alert when projected to exceed)

### CloudWatch Alarms
Monitor key metrics:
- Lambda duration and memory usage
- API Gateway 4XX/5XX errors
- CloudFront cache hit ratio

## 📚 Related Documentation

- [AWS Cost Management Best Practices](https://docs.aws.amazon.com/cost-management/latest/userguide/best-practices.html)
- [Resource Tagging Strategy](https://docs.aws.amazon.com/general/latest/gr/aws_tagging.html)
- [WenXen.com Deployment Guide](../README-AWS.md)

---

**Last Updated**: September 8, 2024  
**Next Review**: October 8, 2024