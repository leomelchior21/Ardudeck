# Copies the ArduDeck deploy bundle onto the FAT32 "bootfs" partition of a
# Raspberry Pi OS USB stick. Nothing is formatted or erased: the files simply
# land in the Pi's boot partition, which the Pi can always read.
#
# Usage from the repository root:
#   powershell -ExecutionPolicy Bypass -File tools\copy-to-pi-stick.ps1
#   powershell -ExecutionPolicy Bypass -File tools\copy-to-pi-stick.ps1 -DriveLetter F
#
param(
    [string]$DriveLetter = "E"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$files = @("ardudeck-deploy.tar.gz", "pi-install-instructions.txt")

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
    Write-Host "Administrator rights are needed to mount the boot partition." -ForegroundColor Yellow
    Write-Host "A UAC prompt will appear - accept it and the copy runs in a new window."
    $arguments = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass",
        "-File", "`"$PSCommandPath`"",
        "-DriveLetter", $DriveLetter
    )
    Start-Process powershell -Verb RunAs -ArgumentList $arguments
    return
}

foreach ($file in $files) {
    if (-not (Test-Path (Join-Path $repo $file))) {
        throw "$file is missing. Run tools\pack-for-pi.ps1 first."
    }
}

$volume = Get-Volume | Where-Object { $_.FileSystemLabel -eq "bootfs" -and $_.FileSystem -eq "FAT32" }
if (-not $volume) {
    throw "No FAT32 volume labelled 'bootfs' found. Is the Raspberry Pi stick plugged in?"
}

if (Get-Volume -DriveLetter $DriveLetter -ErrorAction SilentlyContinue) {
    throw "Drive $DriveLetter is already used. Pick another letter with -DriveLetter."
}

Write-Host "Mounting $($volume.UniqueId) as ${DriveLetter}:"
mountvol "${DriveLetter}:" $volume.UniqueId

foreach ($file in $files) {
    Copy-Item -LiteralPath (Join-Path $repo $file) -Destination "${DriveLetter}:\" -Force
    Write-Host "  copied $file"
}

Write-Host ""
Write-Host "Contents of the boot partition (ArduDeck files):"
Get-ChildItem "${DriveLetter}:\" | Where-Object { $_.Name -like "ardudeck*" -or $_.Name -like "pi-install*" } |
    Select-Object Name, @{n = 'Size'; e = { "{0:N0} bytes" -f $_.Length } } |
    Format-Table -AutoSize

$free = [math]::Round((Get-Volume -DriveLetter $DriveLetter).SizeRemaining / 1MB, 1)
Write-Host "Free space left on the boot partition: $free MB"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Use 'Safely Remove Hardware' before unplugging the stick."
Write-Host "  2. Plug it into the Raspberry Pi and, in a terminal there:"
Write-Host "       ls /boot/firmware/ardudeck-deploy.tar.gz   # stick is the boot medium"
Write-Host "       ls /media/*/ardudeck-deploy.tar.gz         # stick is a normal USB drive"
Write-Host "  3. Follow pi-install-instructions.txt (also copied to the stick)."
Write-Host ""
Write-Host "The ext4 partition on this stick was not touched." -ForegroundColor DarkGray
