# RightWay AI agent launcher (comments in English only: codepage safety).
$ErrorActionPreference = 'Continue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

$logDir = Join-Path $dir 'logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$runLog = Join-Path $logDir 'runs.log'

# CLI agents install via npm into %APPDATA%\npm - may be missing in scheduler PATH
$env:Path += ";$env:APPDATA\npm"

if (-not (Test-Path (Join-Path $dir 'config.json'))) {
    Add-Content $runLog "$stamp`tERROR: config.json missing"
    exit 1
}
$cfg = Get-Content (Join-Path $dir 'config.json') -Raw | ConvertFrom-Json

# Which CLI agent runs the nightly shift: claude (default) | codex | gemini
$cli = if ($cfg.cli) { $cfg.cli } else { 'claude' }
$exe = Get-Command $cli -ErrorAction SilentlyContinue
if (-not $exe) {
    Add-Content $runLog "$stamp`tERROR: '$cli' not found in PATH (check config.json 'cli')"
    exit 1
}

Add-Content $runLog "$stamp`tstart ($cli)"

$prompt = Get-Content (Join-Path $dir 'prompt.md') -Raw
switch ($cli) {
    # claude: headless prompt with a narrow tool allowlist + turn cap
    'claude' {
        & claude -p $prompt `
            --allowedTools "Bash(curl:*)" "Bash(cat:*)" "Bash(echo:*)" "Bash(ls:*)" "Bash(mkdir:*)" "Bash(powershell:*)" "Read(*)" "Write(*)" `
            --max-turns 40 2>&1 | Add-Content $runLog
    }
    # codex (OpenAI): non-interactive exec mode
    'codex' {
        & codex exec $prompt 2>&1 | Add-Content $runLog
    }
    # gemini (Google): non-interactive prompt mode
    'gemini' {
        & gemini -p $prompt 2>&1 | Add-Content $runLog
    }
    default {
        Add-Content $runLog "$stamp`tERROR: unknown cli '$cli' (supported: claude, codex, gemini)"
        exit 1
    }
}

Add-Content $runLog "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`tdone, code $LASTEXITCODE"
exit $LASTEXITCODE