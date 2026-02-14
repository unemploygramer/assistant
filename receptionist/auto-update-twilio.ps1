# auto-update-twilio.ps1 - Auto-updates Twilio webhook when ngrok URL changes
# This makes free ngrok actually usable

param(
    [string]$TwilioAccountSid = $env:TWILIO_ACCOUNT_SID,
    [string]$TwilioAuthToken = $env:TWILIO_AUTH_TOKEN,
    [string]$PhoneNumber = $env:TWILIO_PHONE_NUMBER
)

Write-Host "Auto-Updating Twilio Webhook..." -ForegroundColor Cyan

# Get ngrok URL
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
    Write-Host "Failed to get ngrok URL. Is ngrok running?" -ForegroundColor Red
    exit 1
}

$webhookUrl = "$ngrokUrl/voice"
Write-Host "Ngrok URL: $ngrokUrl" -ForegroundColor Green
Write-Host "Webhook URL: $webhookUrl" -ForegroundColor Green

# Update Twilio via API
if (-not $TwilioAccountSid -or -not $TwilioAuthToken -or -not $PhoneNumber) {
    Write-Host "Missing Twilio credentials. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER" -ForegroundColor Red
    exit 1
}

try {
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${TwilioAccountSid}:${TwilioAuthToken}"))
    
    $body = @{
        VoiceUrl = $webhookUrl
        VoiceMethod = "POST"
    } | ConvertTo-Json
    
    $headers = @{
        Authorization = "Basic $auth"
        "Content-Type" = "application/x-www-form-urlencoded"
    }
    
    # Twilio API needs form-encoded, not JSON
    $formBody = "VoiceUrl=$([System.Web.HttpUtility]::UrlEncode($webhookUrl))&VoiceMethod=POST"
    
    $response = Invoke-RestMethod -Uri "https://api.twilio.com/2010-04-01/Accounts/$TwilioAccountSid/IncomingPhoneNumbers/$PhoneNumber.json" `
        -Method POST `
        -Headers $headers `
        -Body $formBody
    
    Write-Host "SUCCESS! Twilio webhook updated automatically!" -ForegroundColor Green
    Write-Host "You can now call your number and it will work!" -ForegroundColor Green
} catch {
    Write-Host "Failed to update Twilio:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual update:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming" -ForegroundColor Gray
    Write-Host "2. Click your number" -ForegroundColor Gray
    Write-Host "3. Set Voice webhook to: $webhookUrl" -ForegroundColor Gray
}
