# Build script that cleans .next cache before building
# Use this instead of 'npm run build' to avoid OneDrive symlink issues

$projectPath = $PSScriptRoot
$nextCache = Join-Path $projectPath ".next"

Write-Host "Cleaning .next cache..." -ForegroundColor Yellow
if (Test-Path $nextCache) {
    Remove-Item -Recurse -Force $nextCache
    Write-Host "Cache cleaned." -ForegroundColor Green
}

Write-Host "Building..." -ForegroundColor Cyan
npm run build
