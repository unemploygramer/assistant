# start-phone.ps1 - Phone server + Cloudflare Tunnel (no ngrok)
# Load .env from project root
$rootDir = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $rootDir ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

Write-Host "Starting Phone Server + Cloudflare Tunnel..." -ForegroundColor Cyan

# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Kill existing cloudflared (avoid duplicate tunnels). Don't kill all node - dashboard may be on 3000.
Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force

$port = $env:PHONE_SERVER_PORT
if (-not $port) { $port = 3001 }
$env:PHONE_SERVER_PORT = $port
$env:PORT = $port

# Your permanent Cloudflare domain (same as start-cloudflare.ps1)
$cloudflareDomain = "voicemail.snaptabapp.com"
$cloudflareUrl = "https://$cloudflareDomain"
$tunnelName = "voicemail-assistant"

Write-Host "Starting phone server on port $port (new window for logs)..." -ForegroundColor Yellow
$serverCmd = "cd '$PSScriptRoot'; `$env:PHONE_SERVER_PORT='$port'; `$env:PORT='$port'; node phone_server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $serverCmd

Start-Sleep -Seconds 4

Write-Host "Starting Cloudflare Tunnel ($tunnelName -> http://localhost:$port)..." -ForegroundColor Yellow

$cloudflaredPath = $null
try {
    $cloudflaredCmd = Get-Command cloudflared -ErrorAction Stop
    $cloudflaredPath = $cloudflaredCmd.Source
    Write-Host "Found cloudflared: $cloudflaredPath" -ForegroundColor Green
} catch {
    $possiblePaths = @(
        "$env:USERPROFILE\AppData\Local\cloudflared\cloudflared.exe",
        "$env:LOCALAPPDATA\cloudflared\cloudflared.exe",
        "$env:ProgramFiles\cloudflared\cloudflared.exe"
    )
    foreach ($p in $possiblePaths) {
        if (Test-Path $p) { $cloudflaredPath = $p; break }
    }
    if (-not $cloudflaredPath) { $cloudflaredPath = "cloudflared" }
}

try {
    if ($cloudflaredPath -and $cloudflaredPath -ne "cloudflared") {
        $cloudflaredProcess = Start-Process -FilePath $cloudflaredPath `
            -ArgumentList "tunnel", "run", "--url", "http://localhost:$port", $tunnelName `
            -NoNewWindow -PassThru
    } else {
        $cloudflaredProcess = Start-Process -FilePath "cloudflared" `
            -ArgumentList "tunnel", "run", "--url", "http://localhost:$port", $tunnelName `
            -NoNewWindow -PassThru
    }
} catch {
    Write-Host "Failed to start cloudflared: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Run manually: cloudflared tunnel run --url http://localhost:$port $tunnelName" -ForegroundColor Yellow
    exit 1
}

Start-Sleep -Seconds 3

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host "CLOUDFLARE URL (PERMANENT):" -ForegroundColor Green
Write-Host "   $cloudflareUrl" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host ""

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match "PUBLIC_URL=.*") {
        $envContent = $envContent -replace "PUBLIC_URL=.*", "PUBLIC_URL=$cloudflareUrl"
        Set-Content -Path $envPath -Value $envContent -NoNewline
    } else {
        Add-Content -Path $envPath -Value "`nPUBLIC_URL=$cloudflareUrl"
    }
    Write-Host "Updated .env PUBLIC_URL" -ForegroundColor Green
}

$cloudflareUrl | Set-Clipboard
Write-Host "URL copied to clipboard." -ForegroundColor Cyan

$webhookUrl = "$cloudflareUrl/voice"
Write-Host ""
Write-Host "Twilio webhook:" -ForegroundColor Cyan
Write-Host "   $webhookUrl" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ""

# Auto-update Twilio webhook
$twilioSid = $env:TWILIO_ACCOUNT_SID
$twilioToken = $env:TWILIO_AUTH_TOKEN
$twilioPhone = $env:TWILIO_PHONE_NUMBER

if ($twilioSid -and $twilioToken -and $twilioPhone) {
    try {
        $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${twilioSid}:${twilioToken}"))
        $headers = @{ Authorization = "Basic $auth" }
        $phoneList = Invoke-RestMethod -Uri "https://api.twilio.com/2010-04-01/Accounts/$twilioSid/IncomingPhoneNumbers.json?PhoneNumber=$twilioPhone" -Headers $headers
        $phoneSid = $phoneList.incoming_phone_numbers[0].sid
        if ($phoneSid) {
            $formBody = "VoiceUrl=$([System.Web.HttpUtility]::UrlEncode($webhookUrl))&VoiceMethod=POST"
            Invoke-RestMethod -Uri "https://api.twilio.com/2010-04-01/Accounts/$twilioSid/IncomingPhoneNumbers/$phoneSid.json" -Method POST -Headers $headers -Body $formBody | Out-Null
            Write-Host "Twilio webhook updated. You can call your number now!" -ForegroundColor Green
        } else {
            Write-Host "Set Voice webhook manually to: $webhookUrl" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Twilio auto-update failed. Set Voice webhook to: $webhookUrl" -ForegroundColor Yellow
    }
} else {
    Write-Host "Set Twilio Voice webhook to: $webhookUrl" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Phone server: other window. Tunnel: this window." -ForegroundColor Gray
Write-Host "Ctrl+C stops tunnel (server keeps running)." -ForegroundColor Yellow
Write-Host ""

Wait-Process -Id $cloudflaredProcess.Id -ErrorAction SilentlyContinue
