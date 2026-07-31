#!/usr/bin/env bash
# Install Zel9278/new-dotfiles on a new machine.
set -euo pipefail

DOTPATH="${DOTPATH:-$HOME/.dotfiles}"
REPO="${DOTFILES_REPO:-https://github.com/Zel9278/new-dotfiles}"

if [[ -d "$DOTPATH/.git" ]]; then
  echo "==> $DOTPATH already exists; pulling latest..."
  git -C "$DOTPATH" pull --ff-only
else
  echo "==> Cloning $REPO into $DOTPATH ..."
  git clone "$REPO" "$DOTPATH"
fi

echo "==> Running install.sh ..."
"$DOTPATH/install.sh"

echo
echo "Done. Run \`exec zsh\` to start using the new shell."
