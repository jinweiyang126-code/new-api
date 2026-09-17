# Fail the build if web/dist looks like a test/embed placeholder.
# Call this before `go build` / Docker image packaging for production.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$index = Join-Path $root 'web\dist\index.html'

if (-not (Test-Path $index)) {
  Write-Error "web/dist/index.html missing. Run: cd web && bun run build (or npm run build)"
  exit 1
}

$raw = Get-Content -Path $index -Raw
$len = (Get-Item $index).Length
$trimmed = $raw.Trim()

if ($trimmed -eq 'ok') {
  Write-Error "web/dist/index.html is the Go-test placeholder 'ok'. Restore with: cd web && bun run build"
  exit 1
}

if ($len -lt 200) {
  Write-Error "web/dist/index.html is too small ($len bytes) — refusing to ship. Run: cd web && bun run build"
  exit 1
}

if ($raw -notmatch '(?i)<!doctype|<html' -or $raw -notmatch '(?i)script') {
  Write-Error "web/dist/index.html does not look like a production SPA build. Run: cd web && bun run build"
  exit 1
}

if ($raw -match '(?i)embed placeholder|frontend not built|use frontend dev server') {
  Write-Error "web/dist/index.html is still an embed/dev placeholder. Run: cd web && bun run build"
  exit 1
}

Write-Host "guard-web-dist: OK ($len bytes)"
exit 0
