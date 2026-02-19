# start-cloudflare.ps1 - Start server with Cloudflare Tunnel (named tunnel)
Write-Host "Starting Phone Server + Cloudflare Tunnel..." -ForegroundColor Cyan

# Refresh PATH to include user PATH (sometimes scripts don't get it)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Load .env file to get credentials
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

# Kill cloudflared (avoid duplicate tunnels). Don't kill node - dashboard may be on 3000.
Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force

# Phone server port: 3001 so dashboard can use 3000. Tunnel points to 3001.
$port = $env:PHONE_SERVER_PORT
if (-not $port) {
    $port = 3001
}
$env:PHONE_SERVER_PORT = $port

# Your permanent Cloudflare domain
$cloudflareDomain = "voicemail.snaptabapp.com"
$cloudflareUrl = "https://$cloudflareDomain"
$tunnelName = "voicemail-assistant"

Write-Host "Starting phone server on port $port (in new window so you see logs)..." -ForegroundColor Yellow

# Start phone server in a NEW VISIBLE WINDOW - you'll see console logs when calls come in
$serverCmd = "cd '$PSScriptRoot'; `$env:PHONE_SERVER_PORT='$port'; `$env:PORT='$port'; node phone_server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $serverCmd

# Wait for server to start
Start-Sleep -Seconds 4

Write-Host "Starting Cloudflare Tunnel (named tunnel: $tunnelName)..." -ForegroundColor Yellow
Write-Host ""

# Find cloudflared executable - try multiple methods
$cloudflaredPath = $null
$cloudflaredFound = $false

# Method 1: Check if it's in PATH (refresh PATH first)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
try {
    $cloudflaredCmd = Get-Command cloudflared -ErrorAction Stop
    $cloudflaredPath = $cloudflaredCmd.Source
    $cloudflaredFound = $true
    Write-Host "Found cloudflared at: $cloudflaredPath" -ForegroundColor Green
} catch {
    # Method 2: Try where.exe (Windows command)
    try {
        $whereResult = & where.exe cloudflared 2>$null
        if ($whereResult -and (Test-Path $whereResult[0])) {
            $cloudflaredPath = $whereResult[0]
            $cloudflaredFound = $true
            Write-Host "Found cloudflared via where.exe: $cloudflaredPath" -ForegroundColor Green
        }
    } catch {
        # Method 3: Try common locations
        $possiblePaths = @(
            "$env:USERPROFILE\AppData\Local\cloudflared\cloudflared.exe",
            "$env:LOCALAPPDATA\cloudflared\cloudflared.exe",
            "$env:ProgramFiles\cloudflared\cloudflared.exe",
            "C:\cloudflared\cloudflared.exe",
            "$env:USERPROFILE\.cloudflared\cloudflared.exe"
        )
        
        foreach ($path in $possiblePaths) {
            if (Test-Path $path) {
                $cloudflaredPath = $path
                $cloudflaredFound = $true
                Write-Host "Found cloudflared at: $cloudflaredPath" -ForegroundColor Green
                break
            }
        }
    }
}

# If we still haven't found it, just try "cloudflared" - it works in your terminal
if (-not $cloudflaredFound) {
    Write-Host "Couldn't detect cloudflared path, but trying 'cloudflared' directly..." -ForegroundColor Yellow
    Write-Host "(It works in your terminal, so it should work here too)" -ForegroundColor Gray
    $cloudflaredPath = "cloudflared"
    $cloudflaredFound = $true
}

# Start cloudflared tunnel (named tunnel pointing to localhost)
Write-Host "Starting tunnel: $tunnelName -> http://localhost:$port" -ForegroundColor Cyan

# Try to start cloudflared - use full path if we found it, otherwise try just "cloudflared"
try {
    if ($cloudflaredPath -and $cloudflaredPath -ne "cloudflared") {
        $cloudflaredProcess = Start-Process -FilePath $cloudflaredPath `
            -ArgumentList "tunnel", "run", "--url", "http://localhost:$port", $tunnelName `
            -NoNewWindow `
            -PassThru
    } else {
        # Just try "cloudflared" - it works in your terminal, should work here too
        $cloudflaredProcess = Start-Process -FilePath "cloudflared" `
            -ArgumentList "tunnel", "run", "--url", "http://localhost:$port", $tunnelName `
            -NoNewWindow `
            -PassThru
    }
} catch {
    Write-Host "Failed to start cloudflared: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Try running manually in another terminal:" -ForegroundColor Yellow
    Write-Host "  cloudflared tunnel run --url http://localhost:$port $tunnelName" -ForegroundColor Gray
    exit 1
}

# Wait a moment for tunnel to connect
Start-Sleep -Seconds 3

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host "CLOUDFLARE TUNNEL URL (PERMANENT):" -ForegroundColor Green
Write-Host "   $cloudflareUrl" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host ""

# Update .env file with permanent URL
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match "PUBLIC_URL=.*") {
        $envContent = $envContent -replace "PUBLIC_URL=.*", "PUBLIC_URL=$cloudflareUrl"
        Set-Content -Path $envPath -Value $envContent -NoNewline
        Write-Host "Updated .env file with permanent URL" -ForegroundColor Green
    } else {
        Add-Content -Path $envPath -Value "`nPUBLIC_URL=$cloudflareUrl"
        Write-Host "Added PUBLIC_URL to .env file" -ForegroundColor Green
    }
}

# Copy URL to clipboard
$cloudflareUrl | Set-Clipboard
Write-Host "URL copied to clipboard!" -ForegroundColor Cyan
Write-Host ""

# Display Twilio webhook URL
$webhookUrl = "$cloudflareUrl/voice"
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
            Write-Host "Your permanent URL: $webhookUrl" -ForegroundColor Green
            Write-Host "You can call your number right now!" -ForegroundColor Green
        } else {
            Write-Host "Could not find phone number. Manual update:" -ForegroundColor Yellow
            Write-Host "   Set Voice webhook to: $webhookUrl" -ForegroundColor Gray
        }
    } catch {
        Write-Host "Auto-update failed:" -ForegroundColor Yellow
        Write-Host $_.Exception.Message -ForegroundColor Gray
        Write-Host ""
        Write-Host "Manual update (ONE TIME ONLY - URL never changes!):" -ForegroundColor Yellow
        Write-Host "   1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming" -ForegroundColor Gray
        Write-Host "   2. Click your phone number" -ForegroundColor Gray
        Write-Host "   3. Set Voice webhook to: $webhookUrl" -ForegroundColor Gray
        Write-Host "   4. Save" -ForegroundColor Gray
    }
} else {
    Write-Host "Twilio credentials not found. Manual update (ONE TIME ONLY):" -ForegroundColor Yellow
    Write-Host "   Set Voice webhook to: $webhookUrl" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Server and tunnel are running!" -ForegroundColor Cyan
Write-Host "  - Phone server: new window (close that window to stop it)" -ForegroundColor Gray
Write-Host "  - Tunnel: this window" -ForegroundColor Gray
Write-Host "Permanent URL: $cloudflareUrl" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the tunnel (phone server keeps running in its window)." -ForegroundColor Yellow
Write-Host ""

# Keep script running so cloudflared stays alive; Ctrl+C stops tunnel
Wait-Process -Id $cloudflaredProcess.Id -ErrorAction SilentlyContinue
