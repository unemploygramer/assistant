# start-phone.ps1 - One command to rule them all
# Load .env file to get Twilio credentials
$envPath = Join-Path $PSScriptRoot ".." ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

Write-Host "Starting Phone Server + Ngrok..." -ForegroundColor Cyan

# Kill any existing ngrok/phone_server processes
Get-Process -Name ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*node*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Start ngrok in background
Write-Host "Starting ngrok..." -ForegroundColor Yellow
$ngrokProcess = Start-Process -FilePath "ngrok" -ArgumentList "http 3001" -PassThru -WindowStyle Hidden

# Wait for ngrok to start
Start-Sleep -Seconds 3

# Get ngrok URL from API
Write-Host "Fetching ngrok URL..." -ForegroundColor Yellow
$maxRetries = 10
$retryCount = 0
$ngrokUrl = $null

while ($retryCount -lt $maxRetries -and -not $ngrokUrl) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
        $httpsTunnel = $response.tunnels | Where-Object { $_.proto -eq 'https' }
        if ($httpsTunnel) {
            $ngrokUrl = $httpsTunnel.public_url
        }
    } catch {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Start-Sleep -Seconds 1
        }
    }
}

if (-not $ngrokUrl) {
    Write-Host "Failed to get ngrok URL. Make sure ngrok is installed and running." -ForegroundColor Red
    Stop-Process -Id $ngrokProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host "NGROK URL:" -ForegroundColor Green
Write-Host "   $ngrokUrl" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host ""

# Update .env file with new URL
$envPath = Join-Path $PSScriptRoot ".." ".env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match "PUBLIC_URL=.*") {
        $envContent = $envContent -replace "PUBLIC_URL=.*", "PUBLIC_URL=$ngrokUrl"
        Set-Content -Path $envPath -Value $envContent -NoNewline
        Write-Host "Updated .env file with new URL" -ForegroundColor Green
    } else {
        Add-Content -Path $envPath -Value "`nPUBLIC_URL=$ngrokUrl"
        Write-Host "Added PUBLIC_URL to .env file" -ForegroundColor Green
    }
} else {
    Write-Host ".env file not found, but that's okay" -ForegroundColor Yellow
}

# Copy URL to clipboard
$ngrokUrl | Set-Clipboard
Write-Host "URL copied to clipboard!" -ForegroundColor Cyan
Write-Host ""

# Display Twilio webhook URL
$webhookUrl = "$ngrokUrl/voice"
Write-Host "Twilio Webhook URL:" -ForegroundColor Cyan
Write-Host "   $webhookUrl" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ""

# Auto-update Twilio webhook
Write-Host "Auto-updating Twilio webhook..." -ForegroundColor Yellow

$twilioSid = $env:TWILIO_ACCOUNT_SID
$twilioToken = $env:TWILIO_AUTH_TOKEN
$twilioPhone = $env:TWILIO_PHONE_NUMBER

if ($twilioSid -and $twilioToken -and $twilioPhone) {
    try {
        # Get phone number SID (need to look it up first)
        $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${twilioSid}:${twilioToken}"))
        $headers = @{
            Authorization = "Basic $auth"
        }
        
        # Get the phone number SID
        $phoneList = Invoke-RestMethod -Uri "https://api.twilio.com/2010-04-01/Accounts/$twilioSid/IncomingPhoneNumbers.json?PhoneNumber=$twilioPhone" -Headers $headers
        $phoneSid = $phoneList.incoming_phone_numbers[0].sid
        
        if ($phoneSid) {
            # Update webhook
            $formBody = "VoiceUrl=$([System.Web.HttpUtility]::UrlEncode($webhookUrl))&VoiceMethod=POST"
            $response = Invoke-RestMethod -Uri "https://api.twilio.com/2010-04-01/Accounts/$twilioSid/IncomingPhoneNumbers/$phoneSid.json" `
                -Method POST `
                -Headers $headers `
                -Body $formBody
            
            Write-Host "SUCCESS! Twilio webhook updated automatically!" -ForegroundColor Green
            Write-Host "You can call your number right now!" -ForegroundColor Green
        } else {
            Write-Host "Could not find phone number. Manual update needed:" -ForegroundColor Yellow
            Write-Host "   1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming" -ForegroundColor Gray
            Write-Host "   2. Click your phone number" -ForegroundColor Gray
            Write-Host "   3. Set Voice webhook to: $webhookUrl" -ForegroundColor Gray
        }
    } catch {
        Write-Host "Auto-update failed (that's okay):" -ForegroundColor Yellow
        Write-Host $_.Exception.Message -ForegroundColor Gray
        Write-Host ""
        Write-Host "Manual update:" -ForegroundColor Yellow
        Write-Host "   1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming" -ForegroundColor Gray
        Write-Host "   2. Click your phone number" -ForegroundColor Gray
        Write-Host "   3. Set Voice webhook to: $webhookUrl" -ForegroundColor Gray
    }
} else {
    Write-Host "Twilio credentials not in environment. Manual update:" -ForegroundColor Yellow
    Write-Host "   1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming" -ForegroundColor Gray
    Write-Host "   2. Click your phone number" -ForegroundColor Gray
    Write-Host "   3. Set Voice webhook to: $webhookUrl" -ForegroundColor Gray
}
Write-Host ""

# Start the phone server
Write-Host "Starting phone server..." -ForegroundColor Yellow
Write-Host ""

Set-Location $PSScriptRoot
node phone_server.js
