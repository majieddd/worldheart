param([string]$Runtime,[switch]$VerifyOnly)
$ErrorActionPreference='Stop'
$researchRepo=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if(-not $Runtime){$Runtime=Join-Path (Split-Path $researchRepo -Parent) 'local-asset-runtime'}
$Runtime=[IO.Path]::GetFullPath($Runtime)
$researchPython=Join-Path $Runtime '.venv/Scripts/python.exe'
$researchUv=(Get-Command uv -ErrorAction Stop).Source
function Checked { param([string]$Exe,[string[]]$ArgsList); & $Exe @ArgsList; if($LASTEXITCODE -ne 0){throw "Research setup failed: $Exe"} }
if(-not $VerifyOnly){
    $shared=Join-Path $Runtime 'modly-trellis2/venv/Lib/site-packages'
    if(-not (Test-Path -LiteralPath $shared)){throw 'Complete the existing Modly/Trellis setup first. Its verified CUDA rasterizer is reused read-only.'}
    foreach($name in @('mia-env','instantmesh-env')){
        $target=Join-Path $Runtime $name
        if(-not (Test-Path -LiteralPath (Join-Path $target 'Scripts/python.exe'))){Checked $researchUv @('venv','--python','3.11',$target)}
    }
    # The 3.57 GB CUDA wheel repeatedly timed out as one response. Use the same
    # verified, resumable route that completed the measured local installation.
    $wheel=Join-Path $Runtime 'wheels/torch-2.8.0+cu129-cp311-cp311-win_amd64.whl'
    Checked $researchPython @('-X','utf8',(Join-Path $PSScriptRoot 'download_verified.py'),'--url','https://download-r2.pytorch.org/whl/cu129/torch-2.8.0%2Bcu129-cp311-cp311-win_amd64.whl','--output',$wheel,'--size','3571828172','--sha256','8a92b6ac49be932a8e4f70282d0d396a95a0fc877a9fbe0bd36be5f765707c84')
    Checked $researchUv @('pip','install','--python',(Join-Path $Runtime 'mia-env/Scripts/python.exe'),'--find-links',(Split-Path $wheel -Parent),'-r',(Join-Path $PSScriptRoot 'requirements-mia.txt'))
    # Dependencies remain isolated; this never installs into Modly's environment.
    Set-Content -LiteralPath (Join-Path $Runtime 'instantmesh-env/Lib/site-packages/modly-runtime.pth') -Value $shared
    Checked $researchUv @('pip','install','--no-deps','--python',(Join-Path $Runtime 'instantmesh-env/Scripts/python.exe'),'-r',(Join-Path $PSScriptRoot 'requirements-instantmesh.txt'))
}
$researchArgs=@('-X','utf8',(Join-Path $PSScriptRoot 'setup_research.py'),$Runtime)
if($VerifyOnly){$researchArgs+='--verify-only'}
Checked $researchPython $researchArgs
Write-Output 'Research runtime verified. Open Motion library & engine comparisons in Asset Studio. Candidate quality is checked separately.'
