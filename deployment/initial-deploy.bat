@echo off
echo 🚀 Deploying XEN Tracker to AWS Lambda
echo Project: xen-tracker
echo Region: us-east-1
echo Domain: wenxen.com
echo.

echo 📋 Testing AWS credentials...
"C:\Program Files\Amazon\AWSCLIV2\aws.exe" sts get-caller-identity >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ AWS credentials not configured. Run configure-aws.bat first.
    pause
    exit /b 1
)
echo ✅ AWS credentials working

echo.
echo 🔧 Looking for Terraform...

REM Try to find terraform in various locations
set TERRAFORM_EXE=
if exist "C:\terraform\terraform.exe" set TERRAFORM_EXE=C:\terraform\terraform.exe
if exist "C:\Program Files\terraform\terraform.exe" set TERRAFORM_EXE=C:\Program Files\terraform\terraform.exe
if exist "%USERPROFILE%\terraform.exe" set TERRAFORM_EXE=%USERPROFILE%\terraform.exe

REM Try to use terraform from PATH
terraform --version >nul 2>nul
if %ERRORLEVEL% equ 0 set TERRAFORM_EXE=terraform

if "%TERRAFORM_EXE%"=="" (
    echo ❌ Terraform not found. Please ensure it's installed and in PATH.
    echo.
    echo Try opening a new command prompt and running:
    echo   terraform --version
    echo.
    echo If that doesn't work, restart your computer after installing Terraform.
    pause
    exit /b 1
)

echo ✅ Terraform found: %TERRAFORM_EXE%
echo.

echo 🔧 Initializing Terraform...
%TERRAFORM_EXE% init
if %ERRORLEVEL% neq 0 (
    echo ❌ Terraform init failed
    pause
    exit /b 1
)

echo.
echo 📋 Planning deployment...
echo Note: This will set up SSL certificate and Route 53 records for wenxen.com
%TERRAFORM_EXE% plan -var="aws_region=us-east-1" -var="project_name=xen-tracker" -var="domain_name=wenxen.com" -out=tfplan
if %ERRORLEVEL% neq 0 (
    echo ❌ Terraform plan failed
    pause
    exit /b 1
)

echo.
echo 📋 Ready to deploy. This will create AWS resources.
set /p "deploy=Continue with deployment? (y/N): "
if not /i "%deploy%"=="y" (
    echo Deployment cancelled
    pause
    exit /b 0
)

echo.
echo 🚀 Deploying infrastructure...
%TERRAFORM_EXE% apply tfplan
if %ERRORLEVEL% neq 0 (
    echo ❌ Terraform apply failed
    pause
    exit /b 1
)

echo.
echo ✅ Deployment completed!
echo.

echo 📝 Getting deployment information...
for /f "tokens=*" %%i in ('%TERRAFORM_EXE% output -raw website_url 2^>nul') do set WEBSITE_URL=%%i
for /f "tokens=*" %%i in ('%TERRAFORM_EXE% output -raw cloudfront_url 2^>nul') do set CLOUDFRONT_URL=%%i

echo 🌐 Your Website: %WEBSITE_URL%
echo 🚀 CloudFront URL: %CLOUDFRONT_URL%
echo.
echo 🌐 Your website is now live at:
echo    https://wenxen.com
echo    https://www.wenxen.com
echo.
echo ⏱️  SSL certificate and DNS propagation may take 5-15 minutes.
echo.
echo 💰 Estimated cost: ~$1-3/month for typical usage
echo.
pause