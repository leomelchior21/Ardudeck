# Packs ArduDeck for a Raspberry Pi: builds the touch UI, then writes a small
# tarball (no node_modules, no .venv, no logs) and prints the next commands.
#
# Usage (from the repository root):
#   powershell -ExecutionPolicy Bypass -File tools\pack-for-pi.ps1
#   powershell -ExecutionPolicy Bypass -File tools\pack-for-pi.ps1 -SkipBuild
#
param(
    [switch]$SkipBuild,
    [string]$Output = "ardudeck-deploy.tar.gz"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
try {
    if (-not $SkipBuild) {
        Write-Host "[pack] building the touch UI"
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
    }

    if (-not (Test-Path "apps\ui\dist\index.html")) {
        throw "apps/ui/dist/index.html is missing - run without -SkipBuild first"
    }

    if (Test-Path $Output) { Remove-Item -LiteralPath $Output -Force }

    Write-Host "[pack] writing $Output"
    $tar = Get-Command tar.exe -ErrorAction SilentlyContinue
    if (-not $tar) { throw "tar.exe not found - it ships with Windows 10 1803+" }

    & $tar.Source -czf $Output `
        --exclude=node_modules `
        --exclude=.venv `
        --exclude=.git `
        --exclude=data `
        --exclude=logs `
        --exclude=__pycache__ `
        --exclude=.pytest_cache `
        --exclude=$Output `
        .
    if ($LASTEXITCODE -ne 0) { throw "tar failed" }

    $size = [math]::Round((Get-Item $Output).Length / 1MB, 2)
    Write-Host ""
    Write-Host "[pack] done: $Output ($size MB)"
    Write-Host ""
    Write-Host "Next, from this folder (replace the host name with your Pi):" -ForegroundColor Cyan
    Write-Host "  scp .\$Output pi@raspberrypi.local:`$HOME/"
    Write-Host ""
    Write-Host "Then on the Raspberry Pi:" -ForegroundColor Cyan
    Write-Host "  mkdir -p ~/ardudeck-src && tar -xzf ~/$Output -C ~/ardudeck-src"
    Write-Host "  cd ~/ardudeck-src && sudo ./scripts/install-pi.sh"
    Write-Host ""
    Write-Host "The UI is already built, so the installer skips npm entirely."
    Write-Host "Run the installer without --skip-build; it detects the prebuilt dist." -ForegroundColor DarkGray
}
finally {
    Pop-Location
}
