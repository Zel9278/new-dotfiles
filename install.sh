#!/usr/bin/env bash
# Symlink dotfiles into $HOME. Existing files are backed up first.
set -euo pipefail

DOTPATH="${DOTPATH:-$HOME/.dotfiles}"

entries=(
  .zshrc
  .zshrc.d
  .gitconfig
  .vimrc
  .p10k.zsh
  .config/fastfetch
  .config/bat
  .config/nvim
  .config/yazi
)

link_entry() {
  local src="$1"
  local dst="$2"

  if [[ -e $dst && ! -L $dst ]]; then
    local bak="$dst.bak.$(date +%Y%m%d%H%M%S)"
    echo "backup: $dst -> $bak"
    mv "$dst" "$bak"
  fi

  mkdir -p "$(dirname "$dst")"
  ln -snfv "$src" "$dst"
}

install_agent_entrypoint() {
  local src="$1"
  local dst="$2"
  local generated

  generated=$(mktemp)
  sed "s|^@.*/ai-memory/AGENTS\\.md$|@${DOTPATH}/ai-memory/AGENTS.md|" "$src" > "$generated"

  if [[ -e $dst && ! -L $dst ]]; then
    local bak="$dst.bak.$(date +%Y%m%d%H%M%S)"
    echo "backup: $dst -> $bak"
    mv "$dst" "$bak"
  fi

  mkdir -p "$(dirname "$dst")"
  mv "$generated" "$dst"
}

for f in "${entries[@]}"; do
  link_entry "$DOTPATH/$f" "$HOME/$f"
done

# Global AI entry points. Resolve the canonical memory path for this machine.
install_agent_entrypoint "$DOTPATH/AGENTS.md" "$HOME/.codex/AGENTS.md"
install_agent_entrypoint "$DOTPATH/CLAUDE.md" "$HOME/.claude/CLAUDE.md"

echo "Done. Run \`exec zsh\` to start using the new config."
echo "On first launch zinit will install plugins automatically, then run \`p10k configure\`."
echo "Codex and Claude Code entry points are installed from $DOTPATH."
echo "Optional packages: run $DOTPATH/install-packages.sh"
