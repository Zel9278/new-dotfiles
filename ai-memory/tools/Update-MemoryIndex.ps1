[CmdletBinding()]
param(
    [string]$MemoryRoot = (Join-Path $PSScriptRoot '..'),
    [switch]$Check
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$categories = @('user', 'environments', 'prefs', 'projects', 'reference', 'trivia', 'paths')
$start = '<!-- MEMORY-INDEX:START -->'
$end = '<!-- MEMORY-INDEX:END -->'
$root = (Resolve-Path -LiteralPath $MemoryRoot).Path
$index = Join-Path $root 'MEMORY-INDEX.md'

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add($start)
$lines.Add('自動生成。手動編集しない。')
$lines.Add('')

foreach ($category in $categories) {
    $lines.Add("### $category")
    $path = Join-Path $root $category
    $files = if (Test-Path -LiteralPath $path -PathType Container) {
        @(Get-ChildItem -LiteralPath $path -Filter '*.md' -File -Recurse | Sort-Object FullName)
    } else { @() }

    if ($files.Count -eq 0) {
        $lines.Add('- (なし)')
    } else {
        foreach ($file in $files) {
            $relative = [System.IO.Path]::GetRelativePath($root, $file.FullName).Replace('\', '/')
            $content = Get-Content -LiteralPath $file.FullName -Raw
            $title = if ($content -match '(?m)^title:\s*(.+)$') { $matches[1].Trim() } else { $file.BaseName }
            $updated = if ($content -match '(?m)^updated:\s*(.+)$') { " (updated: $($matches[1].Trim()))" } else { '' }
            $lines.Add("- [$($file.Name)]($relative) — $title$updated")
        }
    }
    $lines.Add('')
}
$lines.Add($end)
$generated = $lines -join "`n"

$content = if (Test-Path -LiteralPath $index -PathType Leaf) { Get-Content -LiteralPath $index -Raw } else { '' }
$pattern = '(?s)' + [regex]::Escape($start) + '.*?' + [regex]::Escape($end)
$updated = if ($content -match $pattern) {
    [regex]::Replace($content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $generated })
} else { $generated }

if ($Check) {
    if ((Test-Path -LiteralPath $index -PathType Leaf) -and $updated -eq $content) { 'Memory index is up to date.'; exit 0 }
    throw 'Memory index is out of date. Run tools/Update-MemoryIndex.ps1.'
}

[System.IO.File]::WriteAllText($index, $updated, [System.Text.UTF8Encoding]::new($false))
"Updated: $index"
