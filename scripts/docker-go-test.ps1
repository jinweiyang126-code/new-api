$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)

# Never wipe a real SPA build — only create embed placeholder if index is missing.
& "$PSScriptRoot\ensure-embed-dist.ps1"

$gopath = Join-Path $env:USERPROFILE 'go'
if (-not (Test-Path $gopath)) {
  New-Item -ItemType Directory -Path $gopath | Out-Null
}

$pwdPath = (Get-Location).Path
# Convert Windows path to Docker-friendly path
$srcMount = $pwdPath -replace '\\','/'
$goMount = $gopath -replace '\\','/'

# Inside the container: NEVER `echo ok > web/dist/index.html` (destroys production dist on bind mounts).
$testCmd = @'
set -e
if [ ! -f web/dist/index.html ]; then
  mkdir -p web/dist
  printf '%s\n' '<!doctype html><title>embed</title>' > web/dist/index.html
fi
go test ./model/ ./controller/ ./service/ -count=1 -run 'Invitation|CustomerWithOwner|QuotaLimit|OrgWallet|SelfCreate|Funding|Billing|CreateCustomer'
'@

$args = @(
  'run','--rm',
  '-v', "${srcMount}:/src",
  '-v', "${goMount}:/go",
  '-w', '/src',
  '-e', 'GOPROXY=https://goproxy.cn,direct',
  '-e', 'GOSUMDB=off',
  'golang:1.25-bookworm',
  'bash','-lc', $testCmd
)

Write-Host "docker $($args -join ' ')"
& docker @args
Write-Host "EXIT=$LASTEXITCODE"
exit $LASTEXITCODE
