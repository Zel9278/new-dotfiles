#!/usr/bin/env bash
# Verify install.sh generates agent entry points with every placeholder and
# relative path resolved. Runs against a throwaway HOME, never the real one.
set -uo pipefail

REPO_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

pass=0
fail=0

ok() {
  printf 'ok   %s\n' "$1"
  pass=$((pass + 1))
}

ng() {
  printf 'FAIL %s\n' "$1" >&2
  fail=$((fail + 1))
}

# Entry point templates and the paths install.sh writes them to, relative to HOME.
entrypoints=(
  "AGENTS.md:.codex/AGENTS.md"
  "CLAUDE.md:.claude/CLAUDE.md"
  "PI.md:.pi/agent/AGENTS.md"
)

# pi config files that must end up as symlinks into the repo.
pi_links=(
  ".pi/agent/settings.json:.config/pi/settings.json"
  ".pi/agent/models.json:.config/pi/models.json"
)

# Dotfiles living under home/ must be linked from $HOME without the prefix.
home_links=(
  .zshrc
  .zshrc.d
  .gitconfig
  .vimrc
  .p10k.zsh
)

# Paths referenced from generated entry points that must exist in the repo.
referenced_paths=(
  prefs/tone.md
  prefs/privacy.md
  ai-memory/AGENTS.md
)

# --- setup: run install.sh against a sandbox HOME -----------------------------

sandbox=$(mktemp -d)
trap 'rm -rf "$sandbox"' EXIT HUP INT TERM

# A path containing a space catches unquoted expansions in install.sh.
fake_home="$sandbox/home dir"
dotpath="$fake_home/.dotfiles"
mkdir -p "$fake_home"
cp -r "$REPO_ROOT" "$dotpath"
rm -rf "$dotpath/.git"

install_log="$sandbox/install.log"
if HOME="$fake_home" DOTPATH="$dotpath" bash "$dotpath/install.sh" >"$install_log" 2>&1; then
  ok "install.sh exits 0"
else
  ng "install.sh exits 0 (see output below)"
  sed 's/^/     | /' "$install_log" >&2
fi

# --- syntax ------------------------------------------------------------------

for script in install.sh install-packages.sh auto-install.sh tests/test-install.sh; do
  if bash -n "$REPO_ROOT/$script" 2>/dev/null; then
    ok "bash -n $script"
  else
    ng "bash -n $script"
  fi
done

# --- generated entry points --------------------------------------------------

for pair in "${entrypoints[@]}"; do
  template="${pair%%:*}"
  target="$fake_home/${pair#*:}"
  label="${pair#*:}"

  if [[ ! -f $target ]]; then
    ng "$label was generated"
    continue
  fi
  ok "$label was generated"

  # A generated entry point must be a real file, not a symlink: install.sh
  # rewrites content, so linking would leak unresolved placeholders.
  if [[ -L $target ]]; then
    ng "$label is a regular file, not a symlink"
  else
    ok "$label is a regular file, not a symlink"
  fi

  if grep -q '{{DOTPATH}}' "$target"; then
    ng "$label has no unresolved {{DOTPATH}}"
    grep -n '{{DOTPATH}}' "$target" | sed 's/^/     | /' >&2
  else
    ok "$label has no unresolved {{DOTPATH}}"
  fi

  # The canonical reference on line 1 must point at this machine's DOTPATH.
  first_line=$(head -n 1 "$target")
  if [[ $first_line == "@$dotpath/ai-memory/AGENTS.md" ]]; then
    ok "$label line 1 resolves to \$DOTPATH/ai-memory/AGENTS.md"
  else
    ng "$label line 1 resolves to \$DOTPATH/ai-memory/AGENTS.md (got: $first_line)"
  fi

  # No leftover template path from whoever generated the repo copy.
  if grep -q '/home/ced/' "$target"; then
    ng "$label has no hardcoded /home/ced/ path"
    grep -n '/home/ced/' "$target" | sed 's/^/     | /' >&2
  else
    ok "$label has no hardcoded /home/ced/ path"
  fi

  # Every absolute path the entry point points at must exist. This is the check
  # that would have caught the bare `prefs/tone.md` bug.
  missing=0
  while IFS= read -r path; do
    [[ -e $path ]] || { printf '     | missing: %s\n' "$path" >&2; missing=$((missing + 1)); }
  done < <(grep -o "${dotpath}[A-Za-z0-9._/-]*" "$target" | sort -u)

  if [[ $missing -eq 0 ]]; then
    ok "$label references only existing absolute paths"
  else
    ng "$label references only existing absolute paths ($missing missing)"
  fi

  # Instructions the agent must follow from any cwd cannot use bare relative
  # paths. Check the reading-order section, where cwd is unknown.
  bare=$(sed -n '/^## AIエージェントの読み込み/,/^## /p' "$target" |
    grep -o '`[a-z][A-Za-z0-9._-]*/[A-Za-z0-9._/-]*`' | tr -d '`' | sort -u)
  if [[ -z $bare ]]; then
    ok "$label reading order has no bare relative paths"
  else
    ng "$label reading order has no bare relative paths"
    printf '     | %s\n' $bare >&2
  fi

  # The template itself must keep the placeholder, otherwise the next machine
  # inherits this machine's paths.
  if grep -q '{{DOTPATH}}' "$REPO_ROOT/$template"; then
    ok "$template template still uses {{DOTPATH}}"
  else
    ng "$template template still uses {{DOTPATH}}"
  fi
done

# --- repo paths referenced by the entry points -------------------------------

for path in "${referenced_paths[@]}"; do
  if [[ -f $REPO_ROOT/$path ]]; then
    ok "$path exists in repo"
  else
    ng "$path exists in repo"
  fi
done

# --- home/ dotfiles ----------------------------------------------------------

for entry in "${home_links[@]}"; do
  link="$fake_home/$entry"
  expected="$dotpath/home/$entry"

  if [[ -L $link && $(readlink "$link") == "$expected" ]]; then
    ok "HOME/$entry links to home/$entry"
  else
    ng "HOME/$entry links to home/$entry (got: $(readlink "$link" 2>/dev/null || echo 'not a symlink'))"
  fi

  # The link must resolve, catching a home/ entry that was moved or renamed.
  if [[ -e $link ]]; then
    ok "HOME/$entry resolves"
  else
    ng "HOME/$entry resolves"
  fi
done

# Nothing should be left at the old repo root location.
for entry in "${home_links[@]}"; do
  if [[ -e $REPO_ROOT/$entry ]]; then
    ng "$entry no longer sits in the repo root"
  else
    ok "$entry no longer sits in the repo root"
  fi
done

# --- pi config symlinks ------------------------------------------------------

for pair in "${pi_links[@]}"; do
  link="$fake_home/${pair%%:*}"
  expected="$dotpath/${pair#*:}"
  label="${pair%%:*}"

  if [[ -L $link && $(readlink "$link") == "$expected" ]]; then
    ok "$label links into the repo"
  else
    ng "$label links into the repo (got: $(readlink "$link" 2>/dev/null || echo 'not a symlink'))"
  fi

  if [[ -f $link ]]; then
    ok "$label resolves to a readable file"
  else
    ng "$label resolves to a readable file"
  fi
done

# --- json validity -----------------------------------------------------------

for json in .config/pi/settings.json .config/pi/models.json; do
  if python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$REPO_ROOT/$json" 2>/dev/null; then
    ok "$json is valid JSON"
  else
    ng "$json is valid JSON"
  fi
done

# Secrets must stay out of the repo: keys are env var references only.
if grep -q '"apiKey": *"\$[A-Z_]*"' "$REPO_ROOT/.config/pi/models.json"; then
  ok "models.json references API keys by env var"
else
  ng "models.json references API keys by env var"
fi

if grep -qE '"apiKey": *"(sk-|gsk_|pi-)' "$REPO_ROOT/.config/pi/models.json"; then
  ng "models.json contains no literal API key"
else
  ok "models.json contains no literal API key"
fi

# --- idempotence -------------------------------------------------------------

# Re-running must not create .bak files, since everything is already a symlink
# or a generated file install.sh owns.
before=$(find "$fake_home" -name '*.bak.*' | wc -l)
HOME="$fake_home" DOTPATH="$dotpath" bash "$dotpath/install.sh" >/dev/null 2>&1
after=$(find "$fake_home" -name '*.bak.*' | wc -l)

if [[ $before -eq $after ]]; then
  ok "re-running install.sh creates no new backups"
else
  ng "re-running install.sh creates no new backups ($before -> $after)"
fi

# --- placeholder guard -------------------------------------------------------

# Inject an unresolvable placeholder and confirm install.sh fails instead of
# writing a broken entry point.
guard_home="$sandbox/guard"
guard_path="$guard_home/.dotfiles"
mkdir -p "$guard_home"
cp -r "$REPO_ROOT" "$guard_path"
rm -rf "$guard_path/.git"
printf '\n- broken: `{{DOTPATH_TYPO}}/prefs/tone.md`\n' >>"$guard_path/AGENTS.md"
# Simulate a placeholder the sed rule does not know about.
sed -i 's/{{DOTPATH_TYPO}}/{{DOTPATH}}X{{DOTPATH_LEFTOVER}}/' "$guard_path/AGENTS.md"

if HOME="$guard_home" DOTPATH="$guard_path" bash "$guard_path/install.sh" >/dev/null 2>&1; then
  ng "install.sh fails on an unresolved placeholder"
else
  ok "install.sh fails on an unresolved placeholder"
fi

# --- memory tooling ----------------------------------------------------------

if sh "$dotpath/ai-memory/tools/Update-MemoryIndex.sh" >/dev/null 2>&1 &&
  sh "$dotpath/ai-memory/tools/Test-Memory.sh" >/dev/null 2>&1; then
  ok "ai-memory index generates and validates"
else
  ng "ai-memory index generates and validates"
fi

# --- summary -----------------------------------------------------------------

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[[ $fail -eq 0 ]]
