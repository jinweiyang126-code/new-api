# Ensure web/dist exists for //go:embed without destroying a real frontend build.
# NEVER overwrite an existing index.html.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'web\dist'
$index = Join-Path $dist 'index.html'

New-Item -ItemType Directory -Force -Path $dist | Out-Null
if (Test-Path $index) {
  Write-Host "ensure-embed-dist: keeping existing web/dist/index.html ($((Get-Item $index).Length) bytes)"
  exit 0
}

@'
<!doctype html>
<html><head><meta charset="utf-8"/><title>embed placeholder</title></head>
<body>frontend not built — run: cd web && bun run build</body></html>
'@ | Set-Content -Path $index -Encoding utf8
Write-Host "ensure-embed-dist: created placeholder web/dist/index.html for go:embed only"
exit 0
