# Запуск ИИ-агента RightWay (Windows планировщик → run-agent.cmd → этот скрипт).
# Скрипт — тонкая обёртка: готовит окружение, запускает Claude Code без
# интерфейса (claude -p) с промптом agent/prompt.md и пишет служебный лог.
# Всю работу (тема → урок → публикация → отчёт) делает агент по промпту.

$ErrorActionPreference = 'Continue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

$logDir = Join-Path $dir 'logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$runLog = Join-Path $logDir 'runs.log'

# claude ставится через npm в %APPDATA%\npm — в PATH планировщика его может не быть
$env:Path += ";$env:APPDATA\npm"

$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) {
    Add-Content $runLog "$stamp`tОШИБКА: claude не найден в PATH (нужен установленный Claude Code)"
    exit 1
}
if (-not (Test-Path (Join-Path $dir 'config.json'))) {
    Add-Content $runLog "$stamp`tОШИБКА: нет agent/config.json (скопируй config.example.json и вставь ключ)"
    exit 1
}

Add-Content $runLog "$stamp`tзапуск"

# Головной запуск: промпт целиком из файла, минимум прав (curl/чтение/PS),
# ограничение по числу ходов — защита от зависания и разрастания стоимости
$prompt = Get-Content (Join-Path $dir 'prompt.md') -Raw
& claude -p $prompt `
    --allowedTools "Bash(curl:*)" "Bash(cat:*)" "Bash(echo:*)" "Bash(ls:*)" "Bash(powershell:*)" "Read(*)" `
    --max-turns 40 2>&1 | Add-Content $runLog

Add-Content $runLog "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`tзавершено, код $LASTEXITCODE"
exit $LASTEXITCODE