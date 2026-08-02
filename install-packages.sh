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

install_github_deb() {
  local repository="$1"
  local asset_name="$2"
  local download_url
  local package_file

  if ! command -v curl >/dev/null 2>&1; then
    echo "Warning: curl is required to download $asset_name" >&2
    return 1
  fi

  download_url="$(curl -fsSL "https://api.github.com/repos/$repository/releases/latest" |
    sed -n 's/.*"browser_download_url": "\([^"]*\)".*/\1/p' |
    grep "/$asset_name$" | head -n 1)"
  if [[ -z $download_url ]]; then
    echo "Warning: release asset not found: $repository/$asset_name" >&2
    return 1
  fi

  package_file="$(mktemp --suffix=.deb)"
  echo "==> Downloading $asset_name..."
  curl -fL "$download_url" -o "$package_file"
  as_root apt-get install -y "$package_file"
  rm -f "$package_file"
}

install_latest_neovim() {
  local architecture="$1"
  local archive_name="nvim-linux-$architecture.tar.gz"
  local directory_name="nvim-linux-$architecture"
  local latest_version current_version download_url archive_file

  command -v curl >/dev/null 2>&1 || return 1
  command -v tar >/dev/null 2>&1 || return 1

  latest_version="$(curl -fsSL https://api.github.com/repos/neovim/neovim/releases/latest |
    sed -n 's/.*"tag_name": "\([^"]*\)".*/\1/p' | head -n 1)" || return 1
  current_version="$(nvim --version 2>/dev/null | sed -n 's/^NVIM v\([0-9.]*\).*/v\1/p' | head -n 1)"
  if [[ -n $current_version && $current_version == "$latest_version" ]]; then
    echo "==> Neovim $latest_version is already installed."
    return 0
  fi

  download_url="https://github.com/neovim/neovim/releases/latest/download/$archive_name"
  archive_file="$(mktemp --suffix=.tar.gz)"
  echo "==> Downloading Neovim $latest_version..."
  curl -fL "$download_url" -o "$archive_file" || {
    rm -f "$archive_file"
    return 1
  }
  mkdir -p "$HOME/.local/bin"
  tar -xzf "$archive_file" -C "$HOME/.local"
  ln -sfn "$HOME/.local/$directory_name/bin/nvim" "$HOME/.local/bin/nvim"
  rm -f "$archive_file"
}

if command -v dnf >/dev/null 2>&1; then
  echo "==> Installing packages with dnf..."
  as_root dnf install -y asciinema fzf eza fastfetch bat neovim ripgrep fd-find yazi
elif command -v apt-get >/dev/null 2>&1; then
  echo "==> Installing packages with apt..."
  as_root apt-get update
  apt_packages=(asciinema fzf eza fastfetch bat neovim ripgrep fd-find yazi)
  available_apt_packages=()

  for package in "${apt_packages[@]}"; do
    if apt-cache show "$package" >/dev/null 2>&1; then
      if [[ $package == neovim ]]; then
        case "$(dpkg --print-architecture)" in
          amd64) install_latest_neovim x86_64 || available_apt_packages+=("$package") ;;
          arm64) install_latest_neovim arm64 || available_apt_packages+=("$package") ;;
          *) available_apt_packages+=("$package") ;;
        esac
      else
        available_apt_packages+=("$package")
      fi
    elif [[ $package == fastfetch || $package == yazi ]]; then
      case "$(dpkg --print-architecture)" in
        amd64)
          if [[ $package == fastfetch ]]; then
            install_github_deb fastfetch-cli/fastfetch fastfetch-linux-amd64.deb || true
          else
            install_github_deb sxyazi/yazi yazi-x86_64-unknown-linux-gnu.deb || true
          fi
          ;;
        arm64)
          if [[ $package == fastfetch ]]; then
            install_github_deb fastfetch-cli/fastfetch fastfetch-linux-aarch64.deb || true
          else
            install_github_deb sxyazi/yazi yazi-aarch64-unknown-linux-gnu.deb || true
          fi
          ;;
        *)
          echo "Warning: no download is configured for $(dpkg --print-architecture): $package" >&2
          ;;
      esac
    else
      echo "Warning: apt package not found, skipping: $package" >&2
    fi
  done

  if ((${#available_apt_packages[@]} > 0)); then
    as_root apt-get install -y "${available_apt_packages[@]}"
  fi
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
