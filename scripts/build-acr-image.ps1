# Safe production image build: real frontend + linux binary + Dockerfile.runtime.
# Usage: powershell -File scripts/build-acr-image.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

& "$PSScriptRoot\guard-web-dist.ps1"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Building frontend..."
  Push-Location (Join-Path $root 'web')
  $env:DISABLE_ESLINT_PLUGIN = 'true'
  if (Get-Command bun -ErrorAction SilentlyContinue) {
    bun run build
  } else {
    npm run build
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Pop-Location
  & "$PSScriptRoot\guard-web-dist.ps1"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$env:Path = "D:\tools\go\bin;" + $env:Path
if (Test-Path 'D:\tools\go') { $env:GOROOT = 'D:\tools\go' }
$env:GOPROXY = 'https://goproxy.cn,direct'
$env:CGO_ENABLED = '0'
$env:GOWORK = 'off'
$env:GOOS = 'linux'
$env:GOARCH = 'amd64'
$env:GOEXPERIMENT = 'greenteagc'

$ver = (git describe --tags --always).Trim()
Set-Content -Path (Join-Path $root 'VERSION') -Value $ver -NoNewline
Write-Host "go build linux/amd64 VERSION=$ver"
go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$ver'" -o new-api-linux .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Re-check after go build in case something mutated dist mid-flight
& "$PSScriptRoot\guard-web-dist.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:DOCKER_BUILDKIT = '1'
$REGISTRY = 'crpi-4lxuxozna7pfuh5j.ap-southeast-1.personal.cr.aliyuncs.com'
$TAG = Get-Date -Format 'yyyy-MM-dd-HHmm'
$IMAGE = "$REGISTRY/new-api-acr/new-api-acr:$TAG"
$LATEST = "$REGISTRY/new-api-acr/new-api-acr:latest"
Write-Host "docker build $IMAGE"
docker build -f Dockerfile.runtime -t $IMAGE -t $LATEST .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "OK TAG=$TAG"
Write-Host "  $IMAGE"
Write-Host "  $LATEST"
exit 0
