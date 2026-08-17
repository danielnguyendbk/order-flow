param(
  [string]$ComposeFile = "compose.yaml",
  [string]$OutputDirectory = "backups"
)

$ErrorActionPreference = "Stop"
$resolvedCompose = (Resolve-Path -LiteralPath $ComposeFile).Path
$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $resolvedOutput "order-flow-$timestamp.sql"

# PostgreSQL credentials stay inside the Compose container; no secret is written
# to the host command line or backup artifact.
& docker compose -f $resolvedCompose exec -T postgres sh -c 'pg_dump --format=plain --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > $backup
if ($LASTEXITCODE -ne 0) { Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue; throw "pg_dump failed" }

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $backup).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$backup.sha256" -Value "$hash  $([IO.Path]::GetFileName($backup))" -NoNewline
Write-Output "Backup created: $backup"
Write-Output "SHA-256: $hash"
