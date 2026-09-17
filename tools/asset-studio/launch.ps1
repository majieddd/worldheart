param([string]$Runtime)
$ErrorActionPreference = 'Stop'
$studioRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $studioRoot '../..')).Path
if (-not $Runtime) { $Runtime = Join-Path (Split-Path $repoRoot -Parent) 'local-asset-runtime' }
$Runtime = [IO.Path]::GetFullPath($Runtime)
$studioPython = Join-Path $Runtime '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $studioPython)) { throw 'Run tools/asset-studio/setup.ps1 first.' }
$env:WH_STUDIO_RUNTIME = $Runtime
try { $ready = Invoke-RestMethod 'http://127.0.0.1:8771/api/status' -TimeoutSec 2 } catch { $ready = $null }
if (-not $ready) {
    Start-Process -FilePath $studioPython -ArgumentList @('-m','uvicorn','server:app','--app-dir',('"'+$studioRoot+'"'),'--host','127.0.0.1','--port','8771') -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Runtime 'studio.log') -RedirectStandardError (Join-Path $Runtime 'studio-errors.log')
}
Write-Output 'Local Asset Studio: http://127.0.0.1:8771/'
Write-Output 'Use Start local engine in the studio to load ComfyUI. Only one generation job runs at a time.'
