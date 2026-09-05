param(
    [string]$InstancePath = '',
    [int]$PreferredPort = 0,
    [string]$ExtrasProfileDirectory = '',
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$configPath = Join-Path $projectRoot 'fishonmc-tracker.config.json'

if (-not $InstancePath -and (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    $config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
    $InstancePath = [string]$config.instancePath
    if (-not $PreferredPort) { $PreferredPort = [int]$config.preferredPort }
    if (-not $ExtrasProfileDirectory) { $ExtrasProfileDirectory = [string]$config.extrasProfileDirectory }
}
if (-not $PreferredPort) { $PreferredPort = 45831 }
if (-not $InstancePath -or $InstancePath -like '*Path\To\Your*') { throw 'Set instancePath in fishonmc-tracker.config.json or pass -InstancePath.' }
$resolvedInstance = [IO.Path]::GetFullPath($InstancePath)
if (-not (Test-Path -LiteralPath $resolvedInstance -PathType Container)) { throw "Minecraft instance was not found: $resolvedInstance" }

Import-Module (Join-Path $PSScriptRoot 'TrackerLauncher.psm1') -Force
$fingerprint = Get-TrackerPathFingerprint -Path $resolvedInstance
$url = $null
foreach ($port in Get-TrackerPortCandidates -PreferredPort $PreferredPort) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 1
        if ($health.service -eq 'fishonmc-tracker-bridge' -and $health.instanceFingerprint -eq $fingerprint) { $url = "http://127.0.0.1:$port/"; break }
    } catch { }
}

if (-not $url) {
    $runtime = Join-Path $projectRoot 'bridge\runtime\logs'
    [IO.Directory]::CreateDirectory($runtime) | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $stdout = Join-Path $runtime "tracker-$stamp.stdout.log"
    $stderr = Join-Path $runtime "tracker-$stamp.stderr.log"
    $bridgeEntry = Join-Path $projectRoot 'bridge\src\main.js'
    $arguments = @("`"$bridgeEntry`"", '--instance', "`"$resolvedInstance`"", '--port', [string]$PreferredPort)
    if ($ExtrasProfileDirectory) { $arguments += @('--profile-dir', "`"$ExtrasProfileDirectory`"") }
    $previousMode = $env:FISHON_PUBLIC_MODE
    $env:FISHON_PUBLIC_MODE = '1'
    try { $process = Start-Process -FilePath (Get-Command node).Source -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru }
    finally { $env:FISHON_PUBLIC_MODE = $previousMode }
    for ($attempt = 0; $attempt -lt 60 -and -not $url; $attempt++) {
        Start-Sleep -Milliseconds 250
        if ($process.HasExited) { break }
        foreach ($port in Get-TrackerPortCandidates -PreferredPort $PreferredPort) {
            try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 1; if ($health.service -eq 'fishonmc-tracker-bridge' -and $health.instanceFingerprint -eq $fingerprint) { $url = "http://127.0.0.1:$port/"; break } } catch { }
        }
    }
    if (-not $url) { throw "FishOnMC Tracker did not become ready. See $stderr" }
}

Write-Output "FishOnMC Tracker: $url"
if (-not $NoBrowser) { Start-Process $url }
return $url
