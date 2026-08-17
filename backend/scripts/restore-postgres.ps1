param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [string]$ComposeFile = "compose.yaml",
  [switch]$AllowDestructiveRestore
)

$ErrorActionPreference = "Stop"
if (-not $AllowDestructiveRestore) {
  throw "Restore replaces database objects. Re-run with -AllowDestructiveRestore after stopping api, bot and worker services."
}

$resolvedCompose = (Resolve-Path -LiteralPath $ComposeFile).Path
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
if ([IO.Path]::GetExtension($resolvedBackup) -ne ".sql") { throw "BackupFile must be a .sql backup created by backup-postgres.ps1" }

Get-Content -LiteralPath $resolvedBackup -Raw |
  & docker compose -f $resolvedCompose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
if ($LASTEXITCODE -ne 0) { throw "Restore failed; inspect PostgreSQL logs before restarting application services." }
Write-Output "Restore completed: $resolvedBackup"
