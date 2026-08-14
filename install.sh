#!/usr/bin/env bash
# Symlink dotfiles into $HOME. Existing files are backed up first.
set -euo pipefail

DOTPATH="${DOTPATH:-$HOME/.dotfiles}"

# Files under home/ map 1:1 onto $HOME. Keeping them in a subdirectory keeps the
# repo root readable; the leading dot is preserved by the destination path.
home_entries=(
  .zshrc
  .zshrc.d
  .gitconfig
  .vimrc
  .p10k.zsh
)

# Entries that keep their path relative to $HOME as-is.
entries=(
  .config/fastfetch
  .config/bat
  .config/nvim
  .config/yazi
)

# pi coding agent keeps config in ~/.pi/agent, not ~/.config/pi.
pi_entries=(
  settings.json
  models.json
)

# pi extensions. Each is a directory with index.ts, auto-discovered by pi from
# ~/.pi/agent/extensions/*/index.ts.
pi_extensions=(
  strict-guard
  mcp-client
  ask
  footer
)

link_entry() {
  local src="$1"
  local dst="$2"

  if [[ -e $dst && ! -L $dst ]]; then
    local bak
    bak="$dst.bak.$(date +%Y%m%d%H%M%S)"
    echo "backup: $dst -> $bak"
    mv "$dst" "$bak"
  fi

  mkdir -p "$(dirname "$dst")"
  ln -snfv "$src" "$dst"
}

# Generate a global entry point from a repo template. Bare relative paths break
# when an agent starts outside the repo (cwd is usually $HOME), so the templates
# use {{DOTPATH}} for anything that must resolve from any working directory.
install_agent_entrypoint() {
  local src="$1"
  local dst="$2"
  local generated

  generated=$(mktemp)
  sed -e "s|^@.*/ai-memory/AGENTS\\.md$|@${DOTPATH}/ai-memory/AGENTS.md|" \
      -e "s|{{DOTPATH}}|${DOTPATH}|g" \
      "$src" > "$generated"

  # Catch any placeholder the rules above do not cover, not just {{DOTPATH}}.
  if grep -q '{{[A-Za-z_]*}}' "$generated"; then
    echo "error: unresolved placeholder in $dst:" >&2
    grep -n '{{[A-Za-z_]*}}' "$generated" >&2
    rm -f "$generated"
    exit 1
  fi

  # Entry points are generated files this script owns. Only back up content we
  # did not write, so repeated runs do not pile up .bak copies of our output.
  if [[ -e $dst && ! -L $dst ]] && ! head -n 1 "$dst" | grep -q '^@.*/ai-memory/AGENTS\.md$'; then
    local bak
    bak="$dst.bak.$(date +%Y%m%d%H%M%S)"
    echo "backup: $dst -> $bak"
    mv "$dst" "$bak"
  fi

  mkdir -p "$(dirname "$dst")"
  mv "$generated" "$dst"
  chmod 600 "$dst"
}

for f in "${home_entries[@]}"; do
  link_entry "$DOTPATH/home/$f" "$HOME/$f"
done

for f in "${entries[@]}"; do
  link_entry "$DOTPATH/$f" "$HOME/$f"
done

# Global AI entry points. Resolve the canonical memory path for this machine.
install_agent_entrypoint "$DOTPATH/AGENTS.md" "$HOME/.codex/AGENTS.md"
install_agent_entrypoint "$DOTPATH/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
install_agent_entrypoint "$DOTPATH/PI.md" "$HOME/.pi/agent/AGENTS.md"

# pi settings and custom providers. Secrets stay out of the repo: models.json
# references API keys by env var name (for example $PIPI_API_KEY).
for f in "${pi_entries[@]}"; do
  link_entry "$DOTPATH/.config/pi/$f" "$HOME/.pi/agent/$f"
done

# pi extensions. Dependencies live in each extension's package.json and are
# installed in place, so they must not be committed (see .gitignore).
#
# shared/ holds helpers imported by several extensions via "../shared/...".
# The loader resolves those relative paths under ~/.pi/agent/extensions, so it
# needs its own symlink. It is deliberately kept out of pi_extensions: pi only
# loads the directories listed there, and shared/ exports no extension entry
# point.
link_entry "$DOTPATH/.config/pi/extensions/shared" "$HOME/.pi/agent/extensions/shared"

for d in "${pi_extensions[@]}"; do
  src="$DOTPATH/.config/pi/extensions/$d"
  link_entry "$src" "$HOME/.pi/agent/extensions/$d"

  if [[ -f "$src/package.json" ]]; then
    if command -v npm >/dev/null 2>&1; then
      echo "npm install: $d"
      (cd "$src" && npm install --silent)
    else
      echo "warning: npm not found; skipping deps for pi extension $d" >&2
    fi
  fi
done

echo "Done. Run \`exec zsh\` to start using the new config."
echo "On first launch zinit will install plugins automatically, then run \`p10k configure\`."
echo "Codex, Claude Code, and pi entry points are installed from $DOTPATH."
echo "pi provider keys are read from the environment (see .config/pi/models.json)."
echo "pi extensions installed: ${pi_extensions[*]}"
echo "Optional packages: run $DOTPATH/install-packages.sh"
