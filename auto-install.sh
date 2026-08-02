#!/usr/bin/env bash
# Bootstrap dotfiles on a new machine:
#   bash <(curl -sL https://raw.githubusercontent.com/Zel9278/new-dotfiles/main/auto-install.sh)
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

install_packages="n"
if [[ -t 0 ]]; then
  read -r -p "Install optional packages now? [y/N] " install_packages || install_packages="n"
fi
if [[ $install_packages =~ ^[Yy]$ ]]; then
  echo "==> Running install-packages.sh ..."
  "$DOTPATH/install-packages.sh"
else
  echo "==> Skipping optional packages. Run $DOTPATH/install-packages.sh later."
fi

echo
echo "Done. Run \`exec zsh\` to start using the new shell."
