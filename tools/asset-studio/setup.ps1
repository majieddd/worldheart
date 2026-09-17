param([string]$Runtime, [switch]$SkipModels)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (-not $Runtime) { $Runtime = Join-Path (Split-Path $repoRoot -Parent) 'local-asset-runtime' }
$Runtime = [IO.Path]::GetFullPath($Runtime)
$studioUv = (Get-Command uv -ErrorAction Stop).Source
function Checked { param([string]$Exe,[string[]]$ArgsList); & $Exe @ArgsList; if ($LASTEXITCODE -ne 0) { throw "Setup step failed: $Exe" } }
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
if (-not (Test-Path (Join-Path $Runtime '.venv/Scripts/python.exe'))) { Checked $studioUv @('venv','--python','3.12',(Join-Path $Runtime '.venv')) }
if (-not (Test-Path (Join-Path $Runtime 'blender-py311/Scripts/python.exe'))) { Checked $studioUv @('venv','--python','3.11',(Join-Path $Runtime 'blender-py311')) }
$repos=@(@('ComfyUI','https://github.com/Comfy-Org/ComfyUI.git','8ad078bbf81b966cc3c1e96ad9d2d13293f91347'),@('Hunyuan3D-2','https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git','f8db63096c8282cb27354314d896feba5ba6ff8a'))
foreach ($entry in $repos) {
    $target = Join-Path $Runtime $entry[0]
    if (-not (Test-Path $target)) { Checked 'git' @('clone', $entry[1], $target); Checked 'git' @('-C',$target,'checkout',$entry[2]) }
    $revision = (& git -C $target rev-parse HEAD).Trim()
    if ($revision -ne $entry[2]) { throw "$target has another revision. Preserve it; choose a separate Runtime folder for the pinned setup." }
}
$studioPython = Join-Path $Runtime '.venv/Scripts/python.exe'
Checked $studioUv @('pip','install','--python',$studioPython,'torch','torchvision','torchaudio','--index-url','https://download.pytorch.org/whl/cu130')
Checked $studioUv @('pip','install','--python',$studioPython,'-r',(Join-Path $Runtime 'ComfyUI/requirements.txt'),'-r',(Join-Path $PSScriptRoot 'requirements-studio.txt'),'--torch-backend','cu130')
Checked $studioUv @('pip','install','--python',(Join-Path $Runtime 'blender-py311/Scripts/python.exe'),'bpy==4.5.3','numpy<2','pillow','scipy')
if (-not $SkipModels) { Checked $studioPython @((Join-Path $PSScriptRoot 'download_models.py'),$Runtime) }
Checked $studioPython @('-X','utf8',(Join-Path $PSScriptRoot 'prepare_motion.py'))
Write-Output 'Setup finished. Launch with tools/asset-studio/launch.ps1 and run a small pilot.'
