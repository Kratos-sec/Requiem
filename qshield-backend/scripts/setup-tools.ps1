param(
    [string]$InstallDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Info($Message) {
    Write-Host "[setup-tools] $Message"
}

function Get-LatestNucleiRelease {
    $headers = @{
        "User-Agent" = "Requiem-Setup-Script"
        "Accept"     = "application/vnd.github+json"
    }
    $response = Invoke-RestMethod -Uri "https://api.github.com/repos/projectdiscovery/nuclei/releases/latest" -Headers $headers
    return $response
}

function Get-NucleiAssetUrl($Release) {
    $asset = $Release.assets | Where-Object { $_.name -match '^nuclei_.*_windows_amd64\.zip$' } | Select-Object -First 1
    if (-not $asset) {
        throw "Could not find a Windows amd64 nuclei zip in the latest release."
    }
    return $asset.browser_download_url
}

$targetExe = Join-Path $InstallDir "nuclei.exe"

if ((Test-Path $targetExe) -and -not $Force) {
    Write-Info "nuclei.exe already exists at $targetExe"
    exit 0
}

$tempRoot = Join-Path $env:TEMP ("requiem-nuclei-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot | Out-Null

try {
    Write-Info "Fetching latest nuclei release metadata..."
    $release = Get-LatestNucleiRelease
    $downloadUrl = Get-NucleiAssetUrl $release
    $zipPath = Join-Path $tempRoot "nuclei.zip"
    $extractDir = Join-Path $tempRoot "extract"
    New-Item -ItemType Directory -Path $extractDir | Out-Null

    Write-Info "Downloading $downloadUrl"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath

    Write-Info "Extracting nuclei.exe"
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

    $extractedExe = Get-ChildItem -Path $extractDir -Recurse -Filter "nuclei.exe" | Select-Object -First 1
    if (-not $extractedExe) {
        throw "Downloaded archive did not contain nuclei.exe."
    }

    Copy-Item -LiteralPath $extractedExe.FullName -Destination $targetExe -Force
    Write-Info "Installed nuclei.exe to $targetExe"
}
finally {
    if (Test-Path $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
