@echo off
REM This script configures AWS CLI credentials for deploying the XEN Tracker application
REM It prompts for AWS Access Key ID, Secret Access Key, region, and output format,
REM Then configures the AWS CLI and tests the connection.
REM NO NEED TO RUN MORE THAN ONCE ON THE SYSTEM

echo 🔧 AWS CLI Configuration Script
echo.

REM Check if AWS CLI is accessible
where aws >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Using full path to AWS CLI...
    set AWS_CMD="C:\Program Files\Amazon\AWSCLIV2\aws.exe"
) else (
    set AWS_CMD=aws
)

echo Please have your AWS credentials ready:
echo - AWS Access Key ID
echo - AWS Secret Access Key
echo.

REM Prompt for credentials
set /p ACCESS_KEY="Enter your AWS Access Key ID: "
if "%ACCESS_KEY%"=="" (
    echo Error: Access Key ID cannot be empty
    pause
    exit /b 1
)

set /p SECRET_KEY="Enter your AWS Secret Access Key: "
if "%SECRET_KEY%"=="" (
    echo Error: Secret Access Key cannot be empty
    pause
    exit /b 1
)

set /p REGION="Enter your preferred AWS region (default: us-east-1): "
if "%REGION%"=="" set REGION=us-east-1

set /p OUTPUT="Enter output format (default: json): "
if "%OUTPUT%"=="" set OUTPUT=json

echo.
echo 📝 Configuring AWS CLI...

REM Configure AWS CLI
%AWS_CMD% configure set aws_access_key_id "%ACCESS_KEY%"
if %ERRORLEVEL% neq 0 goto error

%AWS_CMD% configure set aws_secret_access_key "%SECRET_KEY%"
if %ERRORLEVEL% neq 0 goto error

%AWS_CMD% configure set default.region "%REGION%"
if %ERRORLEVEL% neq 0 goto error

%AWS_CMD% configure set default.output "%OUTPUT%"
if %ERRORLEVEL% neq 0 goto error

echo.
echo ✅ AWS CLI configured successfully!
echo.

REM Test configuration
echo 🧪 Testing AWS connection...
%AWS_CMD% sts get-caller-identity
if %ERRORLEVEL% neq 0 goto test_error

echo.
echo 🎉 Configuration complete! You can now deploy your XEN Tracker:
echo    deploy.bat
echo.
pause
exit /b 0

:error
echo ❌ Error configuring AWS CLI
pause
exit /b 1

:test_error
echo ❌ AWS connection test failed. Please check your credentials.
pause
exit /b 1
