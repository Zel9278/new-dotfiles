#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
index="$root/MEMORY-INDEX.md"
check=0
[ "${1:-}" = "--check" ] && check=1

start='<!-- MEMORY-INDEX:START -->'
end='<!-- MEMORY-INDEX:END -->'
categories='user environments prefs projects reference trivia paths'
tmp=$(mktemp "${TMPDIR:-/tmp}/ai-memory-index.XXXXXX")
trap 'rm -f "$tmp"' EXIT HUP INT TERM

{
  printf '%s\n' "$start" '自動生成。手動編集しない。' ''
  for category in $categories; do
    printf '### %s\n' "$category"
    files=''
    if [ -d "$root/$category" ]; then
      files=$(find "$root/$category" -type f -name '*.md' -print | sort)
    fi
    if [ -n "$files" ]; then
      printf '%s\n' "$files" | while IFS= read -r file; do
        relative=${file#"$root"/}
        title=$(awk -F': *' '/^title:/ { print substr($0, index($0, ":") + 1); exit }' "$file" | sed 's/^ *//')
        updated=$(awk -F': *' '/^updated:/ { print substr($0, index($0, ":") + 1); exit }' "$file" | sed 's/^ *//')
        [ -n "$title" ] || title=$(basename "$file" .md)
        suffix=''
        [ -n "$updated" ] && suffix=" (updated: $updated)"
        printf '%s\n' "- [$(basename "$file")]($relative) — $title$suffix"
      done
    else
      printf '%s\n' '- (なし)'
    fi
    printf '\n'
  done
  printf '%s\n' "$end"
} > "$tmp"

if [ "$check" -eq 1 ]; then
  if [ ! -f "$index" ]; then
    echo 'Memory index is missing. Run tools/Update-MemoryIndex.sh.' >&2
    exit 1
  fi
  if cmp -s "$index" "$tmp"; then
    echo 'Memory index is up to date.'
  else
    echo 'Memory index is out of date. Run tools/Update-MemoryIndex.sh.' >&2
    exit 1
  fi
else
  mv "$tmp" "$index"
  echo "Updated: $index"
fi
