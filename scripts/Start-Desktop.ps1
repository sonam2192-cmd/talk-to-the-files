$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 24 LTS, reopen PowerShell, and try again.' }
$nodeVersionText = node --version
if ($LASTEXITCODE -ne 0) { throw 'Unable to read the Node.js version.' }
$nodeVersion = [version]($nodeVersionText.Trim() -replace '^v', '')
if ($nodeVersion -lt [version]'24.15.0') { throw 'Node.js 24.15.0 or newer is required.' }
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Install the .NET 10 SDK, reopen PowerShell, and try again.' }
if (-not (Test-Path node_modules)) { npm ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' } }
npm run helper
if ($LASTEXITCODE -ne 0) { throw 'Explorer helper build failed.' }
npm start
if ($LASTEXITCODE -ne 0) { throw 'Desktop app failed to start.' }
