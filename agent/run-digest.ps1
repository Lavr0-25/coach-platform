# RightWay daily digest launcher (comments in English only: codepage safety).
# Backlog #11 "agent on schedule": reads new feedback + moderation reports via
# the admin agent API (key from ../.env.local, AGENT_KEY), writes a markdown
# digest into digest/<date>.md and shows a Windows toast when there is news.
# Runs at Windows logon (same trigger as run-agent.ps1), once per day.
$ErrorActionPreference = 'Continue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

$logDir = Join-Path $dir 'logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$runLog = Join-Path $logDir 'digest.log'

# Once-per-day guard: the task fires at logon; re-logons must not rerun it.
$today = (Get-Date).ToString('yyyy-MM-dd')
if (Test-Path $runLog) {
    $lastStart = Select-String -Path $runLog -Pattern "`tstart" |
        Select-Object -Last 1
    if ($lastStart -and $lastStart.Line.StartsWith($today)) {
        Add-Content $runLog "$stamp`tskip: already started today"
        exit 0
    }
}

Add-Content $runLog "$stamp`tstart"

# Admin agent key lives in the project .env.local (never committed).
$envFile = Join-Path $dir '..\.env.local'
if (-not (Test-Path $envFile)) {
    Add-Content $runLog "$stamp`tERROR: .env.local missing ($envFile)"
    exit 1
}
$agentKey = (Select-String -Path $envFile -Pattern '^AGENT_KEY=(.+)$').Matches[0].Groups[1].Value
if (-not $agentKey) {
    Add-Content $runLog "$stamp`tERROR: AGENT_KEY not found in .env.local"
    exit 1
}

# Public platform URL. Override with env var DIGEST_BASE_URL if needed.
$baseUrl = if ($env:DIGEST_BASE_URL) { $env:DIGEST_BASE_URL } else { 'https://coach-platform-pi.vercel.app' }
$headers = @{ 'x-agent-key' = $agentKey }

function Invoke-AgentGet([string]$path) {
    try {
        # PS 5.1 mis-decodes UTF-8 when the response has no charset header,
        # so take raw bytes and decode explicitly.
        $resp = Invoke-WebRequest -Uri ($baseUrl + $path) -Headers $headers `
            -Method Get -TimeoutSec 30 -UseBasicParsing
        return [Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray()) |
            ConvertFrom-Json
    } catch {
        Add-Content $runLog "$stamp`tERROR: GET $path failed: $($_.Exception.Message)"
        return $null
    }
}

$feedback = Invoke-AgentGet '/api/agent/feedback?status=new&limit=50'
$reports  = Invoke-AgentGet '/api/agent/reports'
if ($null -eq $feedback -or $null -eq $reports) {
    Add-Content $runLog "$stamp`tdone, code 1 (API unreachable)"
    exit 1
}

# Build the markdown digest (UTF-8, rewritten each run for today's date).
$digestDir = Join-Path $dir 'digest'
New-Item -ItemType Directory -Force $digestDir | Out-Null
$digestPath = Join-Path $digestDir ("$today.md")
$lines = @()
$lines += "# Сводка RightWay — $today"
$lines += ''
$lines += "Сгенерировано $stamp · платформа: $baseUrl"
$lines += ''
$newCount = [int]$feedback.counts.new
$fbTotal  = [int]$feedback.counts.in_progress + $newCount + [int]$feedback.counts.resolved + [int]$feedback.counts.rejected
$lines += "## Обращения (feedback)"
$lines += "Новое: $newCount · В работе: $($feedback.counts.in_progress) · Решено: $($feedback.counts.resolved) · Отклонено: $($feedback.counts.rejected) (всего $fbTotal)"
$lines += ''
if ($newCount -gt 0) {
    foreach ($item in $feedback.items) {
        $d = ([datetime]$item.created_at).ToString('dd.MM')
        $lines += "- **[$($item.type)]** $($item.title) — $d"
    }
    $lines += ''
    $lines += "Разобрать: $baseUrl/admin/feedback"
} else {
    $lines += 'Новых обращений нет.'
}
$lines += ''
$rp = $reports.summary
$lines += "## Жалобы (reports)"
if ([int]$rp.total -gt 0) {
    $lines += "На комментарии: $($rp.comment_reports) · На отзывы: $($rp.review_reports) (всего $($rp.total))"
    $lines += ''
    foreach ($u in $rp.by_reported_user) {
        $name = if ($u.name) { $u.name } else { $u.user_id.Substring(0, 8) }
        $lines += "- $name — жалоб: $($u.count)"
    }
    $lines += ''
    $lines += "Разобрать: $baseUrl/admin/reports"
} else {
    $lines += 'Открытых жалоб нет.'
}

Set-Content -Path $digestPath -Value $lines -Encoding UTF8
Add-Content $runLog "$stamp`tdigest: $digestPath (new feedback $newCount, reports $($rp.total))"

# Windows toast only when there is something to look at.
$news = $newCount + [int]$rp.total
if ($news -gt 0) {
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $texts = $xml.GetElementsByTagName('text')
        $texts.Item(0).AppendChild($xml.CreateTextNode('RightWay: есть новое')) | Out-Null
        $texts.Item(1).AppendChild($xml.CreateTextNode("Обращений: $newCount · Жалоб: $($rp.total) — сводка в agent\digest\$today.md")) | Out-Null
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
        Add-Content $runLog "$stamp`ttoast shown (news $news)"
    } catch {
        Add-Content $runLog "$stamp`ttoast failed: $($_.Exception.Message)"
    }
}

exit 0