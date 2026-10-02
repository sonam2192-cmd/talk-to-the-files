param([string]$ModelId, [string]$Region = 'us-east-1', [string]$Profile)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Install .NET 10 SDK first.' }
if (-not $ModelId) { $ModelId = Read-Host 'Bedrock model ID or inference profile ID (Converse compatible)' }
if (-not $ModelId) { throw 'A model ID is required.' }
$env:BEDROCK_MODEL_ID = $ModelId
$env:AWS_REGION = $Region
if ($Profile) { $env:AWS_PROFILE = $Profile }
if (-not $env:ASK_FILES_API_TOKEN) {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  $env:ASK_FILES_API_TOKEN = [Convert]::ToBase64String($bytes)
}
Write-Host 'Paste this local API token into the desktop Settings (do not share it):'
Write-Host $env:ASK_FILES_API_TOKEN
Write-Host 'Endpoint: http://127.0.0.1:5199/api/file-assistant/ask'
dotnet run --project api/AnswerApi.csproj
if ($LASTEXITCODE -ne 0) { throw 'Answer API failed.' }
