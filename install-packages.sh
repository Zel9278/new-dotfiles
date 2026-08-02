#!/usr/bin/env bash
# Install optional command-line tools used by this dotfiles repository.
set -euo pipefail

as_root() {
  if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

if command -v dnf >/dev/null 2>&1; then
  echo "==> Installing packages with dnf..."
  as_root dnf install -y asciinema fzf eza fastfetch bat neovim ripgrep fd-find yazi
elif command -v apt-get >/dev/null 2>&1; then
  echo "==> Installing packages with apt..."
  as_root apt-get update
  as_root apt-get install -y asciinema fzf eza fastfetch bat neovim ripgrep fd-find yazi
elif command -v pacman >/dev/null 2>&1; then
  arch_packages=(asciinema fzf eza fastfetch bat neovim ripgrep fd yazi)
  package_command=(pacman)

  if command -v paru >/dev/null 2>&1; then
    package_command=(paru)
  else
    read -r -p "paru is not installed. Install it from the AUR? [y/N] " install_paru
    if [[ $install_paru =~ ^[Yy]$ ]]; then
      echo "==> Installing paru build dependencies..."
      as_root pacman -S --needed --noconfirm base-devel git

      paru_tmpdir="$(mktemp -d)"
      trap 'rm -rf "$paru_tmpdir"' EXIT
      git clone https://aur.archlinux.org/paru.git "$paru_tmpdir/paru"
      (
        cd "$paru_tmpdir/paru"
        makepkg -si --noconfirm
      )
      package_command=(paru)
    fi
  fi

  echo "==> Installing packages with ${package_command[0]}..."
  if [[ ${package_command[0]} == paru ]]; then
    paru -S --needed --noconfirm "${arch_packages[@]}"
  else
    as_root pacman -S --needed --noconfirm "${arch_packages[@]}"
  fi
else
  echo "Unsupported distribution: dnf, apt-get, or pacman is required." >&2
  exit 1
fi

echo "Done."
