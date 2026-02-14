# start-phone.ps1 - One command to start phone server + ngrok
# Usage: .\start-phone.ps1

Write-Host "🚀 Starting Phone Server + Ngrok..." -ForegroundColor Cyan
Write-Host ""

# Check if ngrok is installed
$ngrokCheck = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokCheck) {
    Write-Host "❌ ngrok not found! Install it from: https://ngrok.com/download" -ForegroundColor Red
    Write-Host "   Or use: npm run phone (server only, no ngrok)" -ForegroundColor Yellow
    exit 1
}

# Start both processes
Write-Host "📞 Starting phone server on port 3001..." -ForegroundColor Blue
Write-Host "🌐 Starting ngrok tunnel..." -ForegroundColor Green
Write-Host ""

# Use npm script (runs concurrently)
npm run phone:dev
