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

for f in "${entries[@]}"; do
  src="$DOTPATH/$f"
  dst="$HOME/$f"

  if [[ -e $dst && ! -L $dst ]]; then
    bak="$dst.bak.$(date +%Y%m%d%H%M%S)"
    echo "backup: $dst -> $bak"
    mv "$dst" "$bak"
  fi

  mkdir -p "$(dirname "$dst")"
  ln -snfv "$src" "$dst"
done

echo "Done. Run \`exec zsh\` to start using the new config."
echo "On first launch zinit will install plugins automatically, then run \`p10k configure\`."
