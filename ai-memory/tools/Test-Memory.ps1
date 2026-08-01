[CmdletBinding()]
param([string]$MemoryRoot = (Join-Path $PSScriptRoot '..'))

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$categories = @('user', 'environments', 'prefs', 'projects', 'reference', 'trivia', 'paths')
$root = (Resolve-Path -LiteralPath $MemoryRoot).Path
$errors = [System.Collections.Generic.List[string]]::new()
$count = 0

foreach ($category in $categories) {
    $path = Join-Path $root $category
    if (-not (Test-Path -LiteralPath $path -PathType Container)) { continue }
    foreach ($file in @(Get-ChildItem -LiteralPath $path -Filter '*.md' -File -Recurse)) {
        $count++
        $relative = [System.IO.Path]::GetRelativePath($root, $file.FullName).Replace('\', '/')
        $content = Get-Content -LiteralPath $file.FullName -Raw
        if ($file.Name -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*\.md$') { $errors.Add("${relative}: filename must be kebab-case.md") }
        if ($content -notmatch '(?s)^---\s*\r?\n.*?\r?\n---') { $errors.Add("${relative}: frontmatter is missing") }
        if ($content -notmatch "(?m)^type:\s*$([regex]::Escape($category))\s*$") { $errors.Add("${relative}: type must be $category") }
        if ($content -notmatch '(?m)^title:\s*\S') { $errors.Add("${relative}: title is missing") }
        if ($content -notmatch '(?m)^updated:\s*\d{4}-\d{2}-\d{2}\s*$') { $errors.Add("${relative}: updated must use yyyy-mm-dd") }
    }
}

try { & (Join-Path $root 'tools/Update-MemoryIndex.ps1') -MemoryRoot $root -Check } catch { $errors.Add($_.Exception.Message) }
if ($errors.Count -gt 0) {
    $errors | ForEach-Object { "Memory validation error: $_" }
    exit 1
}
"Memory validation passed: $count file(s) checked."
