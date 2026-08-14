#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
categories='user environments prefs projects reference trivia paths'
errors=0
errors_file=$(mktemp "${TMPDIR:-/tmp}/ai-memory-errors.XXXXXX")
trap 'rm -f "$errors_file"' EXIT HUP INT TERM

error() {
  echo "Memory validation error: $*" >> "$errors_file"
}

for category in $categories; do
  [ -d "$root/$category" ] || continue
  find "$root/$category" -type f -name '*.md' -print | sort | while IFS= read -r file; do
    relative=${file#"$root"/}
    case "$(basename "$file")" in
      *[!a-z0-9-]*.md|.md) error "$relative: filename must be kebab-case.md" ;;
    esac
    grep -q '^---[[:space:]]*$' "$file" || error "$relative: frontmatter is missing"
    grep -q "^type: *${category}[[:space:]]*$" "$file" || error "$relative: type must be $category"
    grep -q '^title: *[^[:space:]].*$' "$file" || error "$relative: title is missing"
    grep -Eq '^updated: *[0-9]{4}-[0-9]{2}-[0-9]{2}[[:space:]]*$' "$file" || error "$relative: updated must use yyyy-mm-dd"
  done
done

count=$(find "$root" -type f -path '*/user/*.md' -o -type f -path '*/environments/*.md' -o -type f -path '*/prefs/*.md' -o -type f -path '*/projects/*.md' -o -type f -path '*/reference/*.md' -o -type f -path '*/trivia/*.md' -o -type f -path '*/paths/*.md' | wc -l | tr -d ' ')

if ! sh "$root/tools/Update-MemoryIndex.sh" --check; then
  errors=$((errors + 1))
fi

if [ -s "$errors_file" ]; then
  cat "$errors_file" >&2
  errors=$((errors + $(wc -l < "$errors_file")))
fi

if [ "$errors" -gt 0 ]; then
  echo "Memory validation failed: $errors error(s)." >&2
  exit 1
fi
echo "Memory validation passed: $count file(s) checked."
