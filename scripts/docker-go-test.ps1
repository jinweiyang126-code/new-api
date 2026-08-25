$ErrorActionPreference = 'Continue'
Set-Location 'd:\workspace-cursor\new-api'
$gopath = Join-Path $env:USERPROFILE 'go'
if (-not (Test-Path $gopath)) {
  New-Item -ItemType Directory -Path $gopath | Out-Null
}

$pwdPath = (Get-Location).Path
# Convert Windows path to Docker-friendly path
$srcMount = $pwdPath -replace '\\','/'
$goMount = $gopath -replace '\\','/'

$args = @(
  'run','--rm',
  '-v', "${srcMount}:/src",
  '-v', "${goMount}:/go",
  '-w', '/src',
  '-e', 'GOPROXY=https://goproxy.cn,direct',
  '-e', 'GOSUMDB=off',
  'golang:1.25-bookworm',
  'go','test','./model/','./controller/','./service/',
  '-count=1',
  '-run','Invitation|CustomerWithOwner|QuotaLimit|OrgWallet|SelfCreate|Funding|Billing|CreateCustomer'
)

Write-Host "docker $($args -join ' ')"
& docker @args
Write-Host "EXIT=$LASTEXITCODE"
exit $LASTEXITCODE
