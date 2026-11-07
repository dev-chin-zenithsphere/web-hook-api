[CmdletBinding()]
param(
  [ValidateSet('start', 'restart', 'stop', 'delete', 'status', 'logs', 'monit', 'flush', 'logrotate')]
  [string]$Action = 'start',
  [int]$Lines = 200
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$pm2 = Join-Path $projectRoot 'node_modules\.bin\pm2.cmd'
if (-not (Test-Path -LiteralPath $pm2)) { throw 'PM2 is not installed locally. Run: npm install' }
$ecosystem = Join-Path $projectRoot 'ecosystem.config.cjs'
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot 'logs') | Out-Null

switch ($Action) {
  'start'   { & $pm2 start $ecosystem --env production }
  'restart' { & $pm2 restart checkweigher-gateway --update-env }
  'stop'    { & $pm2 stop checkweigher-gateway }
  'delete'  { & $pm2 delete checkweigher-gateway }
  'status'  { & $pm2 status checkweigher-gateway }
  'logs'    { & $pm2 logs checkweigher-gateway --lines $Lines }
  'monit'   { & $pm2 monit }
  'flush'   { & $pm2 flush checkweigher-gateway }
  'logrotate' {
    & $pm2 install pm2-logrotate
    & $pm2 set pm2-logrotate:max_size 10M
    & $pm2 set pm2-logrotate:retain 14
    & $pm2 set pm2-logrotate:compress true
  }
}
exit $LASTEXITCODE
