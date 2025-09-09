# XEN Tracker AWS Architecture

```mermaid
flowchart TD
    %% Users
    User[👤 User] --> DNS{🌐 DNS Lookup<br/>wenxen.com}
    
    %% Route 53
    DNS --> R53[📍 Route 53<br/>Hosted Zone<br/>Z033010536Z5ND5INFJY0]
    
    %% CloudFront
    R53 --> CF[🚀 CloudFront CDN<br/>Global Distribution<br/>SSL Termination]
    
    %% API Gateway
    CF --> API[🌉 API Gateway<br/>HTTP API<br/>Regional Endpoint]
    
    %% Lambda
    API --> Lambda[⚡ Lambda Function<br/>xen-tracker-static-site<br/>Python 3.11<br/>512MB RAM]
    
    %% Static Files (embedded in Lambda)
    Lambda --> Files[📁 Static Files<br/>• index.html<br/>• CSS files<br/>• JS files<br/>• ABI files]
    
    %% SSL Certificate
    ACM[🔒 ACM Certificate<br/>*.wenxen.com<br/>Auto-renewal] --> CF
    
    %% Security
    Security[🛡️ Security Headers<br/>• HSTS<br/>• CSP<br/>• X-Frame-Options<br/>• CORS] --> CF
    
    %% IAM
    IAM[🔑 IAM Role<br/>Lambda Execution<br/>CloudWatch Logs] --> Lambda
    
    %% Styling
    classDef user fill:#e1f5fe
    classDef aws fill:#ff9800,color:#fff
    classDef compute fill:#4caf50,color:#fff
    classDef storage fill:#2196f3,color:#fff
    classDef security fill:#f44336,color:#fff
    classDef network fill:#9c27b0,color:#fff
    
    class User user
    class R53,DNS,CF network
    class API,Lambda compute
    class Files storage
    class ACM,Security,IAM security
```

## Architecture Overview

### 🌍 **Global Edge Network**
- **CloudFront**: 200+ edge locations worldwide
- **Custom Domain**: wenxen.com + www.wenxen.com
- **SSL/TLS**: Automatic HTTPS with AWS Certificate Manager

### ⚡ **Serverless Compute**
- **Lambda Function**: Pay-per-request execution
- **API Gateway**: HTTP API for Lambda integration
- **Auto-scaling**: Handles 1000+ concurrent requests

### 📁 **Static File Serving**
- **Embedded Files**: All website files packed in Lambda deployment
- **File Types**: HTML, CSS, JavaScript, ABI contracts
- **Content Types**: Proper MIME type handling

### 🛡️ **Security Features**
- **SSL Certificate**: Auto-validated via Route 53
- **Security Headers**: HSTS, CSP, X-Frame-Options
- **CORS**: Configured for web3 wallet interactions
- **IAM**: Least-privilege Lambda execution role

### 💰 **Cost Optimization**
- **Pay-per-use**: Only charged when someone visits
- **Free Tier**: 1M Lambda requests/month free
- **Estimated Cost**: ~$1-3/month for 10k visits

## Request Flow

1. **User visits wenxen.com**
2. **Route 53** resolves domain to CloudFront
3. **CloudFront** checks cache, forwards to API Gateway if needed
4. **API Gateway** invokes Lambda function
5. **Lambda** serves static files with proper headers
6. **Response** cached at CloudFront edge locations globally

## Deployment Resources

### Created by Terraform:
- ✅ Lambda Function (`xen-tracker-static-site`)
- ✅ API Gateway HTTP API
- ✅ CloudFront Distribution
- ✅ ACM SSL Certificate
- ✅ Route 53 A Records (apex + www)
- ✅ Certificate validation records
- ✅ IAM Role and Policies
- ✅ Security Headers Policy
- ✅ CORS Configuration

### Key Benefits:
- 🚀 **Global Performance**: CloudFront CDN
- 💸 **Cost Effective**: Serverless pay-per-use
- 🔒 **Secure**: HTTPS, security headers
- 🔄 **Auto-scaling**: Handles traffic spikes
- 🛠️ **Easy Updates**: Single command deployment