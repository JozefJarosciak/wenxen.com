@echo off
echo WenXen.com Quick Deploy
echo ========================
echo.

REM Change to script directory
cd /d "%~dp0"

echo Current directory: %CD%
echo.

echo Checking Terraform...
terraform version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Terraform not found in PATH. Trying to find it...
    
    REM Try to find terraform in common locations
    if exist "C:\terraform\terraform.exe" (
        set TERRAFORM_CMD="C:\terraform\terraform.exe"
        echo Found Terraform at C:\terraform\terraform.exe
    ) else (
        echo Terraform not found. Please ensure Terraform is installed and in PATH.
        echo.
        echo Try opening a new command prompt and running: terraform --version
        echo If that fails, restart your computer after installing Terraform.
        pause
        exit /b 1
    )
) else (
    set TERRAFORM_CMD=terraform
    echo Terraform found in PATH
)

echo.
echo Starting deployment...
echo    Project: xen-tracker
echo    Region: us-east-1  
echo    Domain: wenxen.com
echo.

REM Generate new version timestamp using PowerShell (more reliable)
for /f "usebackq" %%i in (`powershell -Command "Get-Date -Format 'yyyyMMddHHmmss'"`) do set NEW_VERSION=%%i
for /f "usebackq tokens=*" %%i in (`powershell -Command "Get-Date -Format 'MMMM dd, yyyy at h:mm tt'"`) do set HUMAN_DATE=%%i

echo Updating cache-busting version numbers to: %NEW_VERSION%

REM Change to parent directory where index.html is located
pushd ..

REM Check if index.html exists
if exist "index.html" (
    echo Found index.html, updating version numbers...
    
    REM Update version numbers in index.html (cache-busting only)
    powershell -Command "(Get-Content 'index.html') -replace '\?v=\d+', '?v=%NEW_VERSION%' | Set-Content 'index.html'"
    
    echo Version numbers updated successfully!
) else (
    echo index.html not found in parent directory
    echo Current directory: %CD%
    dir *.html
)

REM Return to deployment directory
popd
echo.

REM Run the deployment command
echo Updating Lambda function with latest files...
%TERRAFORM_CMD% apply -var="aws_region=us-east-1" -var="project_name=xen-tracker" -var="domain_name=wenxen.com" -auto-approve

if %ERRORLEVEL% neq 0 (
    echo.
    echo Deployment failed!
    echo Check the error messages above for details.
    pause
    exit /b 1
)

echo.
echo Lambda deployment successful!

REM Invalidate CloudFront cache using PowerShell for robustness
echo Invalidating CloudFront cache...
powershell -Command "$ErrorActionPreference = 'SilentlyContinue'; $distId = %TERRAFORM_CMD% output -raw cloudfront_distribution_id; if ($distId) { echo ('Found CloudFront Distribution ID: ' + $distId); aws cloudfront create-invalidation --distribution-id $distId --paths '/*'; if ($LASTEXITCODE -eq 0) { echo 'CloudFront cache invalidated successfully!' } else { echo 'CloudFront invalidation may have failed, but deployment completed.' } } else { echo 'Could not get CloudFront Distribution ID, skipping cache invalidation.' }"

echo.
echo Deployment successful!
echo.

echo Your website has been updated at:
   https://wenxen.com
   https://www.wenxen.com
echo.

echo Changes may take 1-2 minutes to appear due to CDN caching.
   Press Ctrl+F5 to force refresh your browser.
echo.

REM Try to get the website URL from terraform output
echo Getting deployment info...
for /f "tokens=*" %%i in ('%TERRAFORM_CMD% output -raw website_url 2^>nul') do set WEBSITE_URL=%%i
if not "%WEBSITE_URL%"=="" (
    echo Direct link: %WEBSITE_URL%
    echo.
)

echo WenXen.com deployment complete!
echo.

echo Press any key to exit...
pause >nul
