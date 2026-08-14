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

install_latest_fzf() {
  local architecture="$1"
  local latest_version download_url archive_file archive_name

  command -v curl >/dev/null 2>&1 || return 1
  command -v tar >/dev/null 2>&1 || return 1

  latest_version="$(curl -fsSL https://api.github.com/repos/junegunn/fzf/releases/latest |
    sed -n 's/.*"tag_name": "\([^\"]*\)".*/\1/p' | head -n 1)" || return 1
  if [[ -z $latest_version ]]; then
    return 1
  fi

  if [[ "v$(fzf --version 2>/dev/null | awk '{print $1}')" == "$latest_version" ]]; then
    echo "==> fzf $latest_version is already installed."
    return 0
  fi

  archive_name="fzf-${latest_version#v}-linux_${architecture}.tar.gz"
  download_url="https://github.com/junegunn/fzf/releases/download/${latest_version}/${archive_name}"
  archive_file="$(mktemp --suffix=.tar.gz)"
  echo "==> Downloading fzf $latest_version..."
  curl -fL "$download_url" -o "$archive_file" || {
    rm -f "$archive_file"
    return 1
  }
  mkdir -p "$HOME/.local/bin"
  tar -xzf "$archive_file" -C "$HOME/.local/bin" fzf
  rm -f "$archive_file"
  chmod +x "$HOME/.local/bin/fzf"
}

# pi coding agent, installed with pnpm. pnpm keeps global packages under
# $PNPM_HOME, which needs no root, and .zshrc.d/00-env.zsh already puts
# $PNPM_HOME/bin on PATH. The version is pinned so every machine gets a known
# release. --ignore-scripts follows upstream guidance: pi needs no lifecycle
# scripts, and skipping them avoids running third-party install hooks.
#
# Node itself also comes from pnpm (`pnpm env use -g lts`) rather than a distro
# package. Debian/Ubuntu's `npm` pulls in ~400 packages (eslint, webpack,
# babel, tap) and its `nodejs` is 18, older than the 22 pi requires, so
# installing it meant paying for a large dependency tree and then fetching a
# newer Node anyway.
PI_PACKAGE="@earendil-works/pi-coding-agent"
PI_VERSION="0.84.1"
PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"

install_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    echo "==> pnpm $(pnpm --version) is already installed."
    return 0
  fi

  # The standalone installer needs no Node, which matters on a fresh machine
  # where the distro package may be missing or too old.
  if command -v curl >/dev/null 2>&1; then
    echo "==> Installing pnpm..."
    if curl -fsSL https://get.pnpm.io/install.sh | env PNPM_HOME="$PNPM_HOME" SHELL="${SHELL:-/bin/sh}" sh -; then
      export PNPM_HOME
      export PATH="$PNPM_HOME/bin:$PATH"
      command -v pnpm >/dev/null 2>&1 && return 0
    fi
    echo "Warning: pnpm installer failed." >&2
  fi

  # Fall back to corepack, which ships with Node 16.9+.
  if command -v corepack >/dev/null 2>&1; then
    echo "==> Enabling pnpm through corepack..."
    corepack enable pnpm >/dev/null 2>&1 && command -v pnpm >/dev/null 2>&1 && return 0
  fi

  echo "Warning: could not install pnpm; skipping pi." >&2
  return 1
}

install_pi() {
  local required_major=22
  local node_major installed_version

  install_pnpm || return 1

  # pi declares engines.node >=22.19.0. Installing on older Node produces a
  # binary that fails at runtime, so check before touching anything. pnpm can
  # provide Node itself; ask for the current LTS rather than a fixed major so
  # the runtime keeps moving with upstream support windows.
  node_major="$(node --version 2>/dev/null | sed -n 's/^v\([0-9]*\).*/\1/p')"
  if [[ -z $node_major ]] || ((node_major < required_major)); then
    echo "==> Installing the current Node LTS through pnpm..."
    if pnpm env use -g lts >/dev/null 2>&1; then
      export PATH="$PNPM_HOME/bin:$PATH"
      node_major="$(node --version 2>/dev/null | sed -n 's/^v\([0-9]*\).*/\1/p')"
    fi
  fi
  if [[ -z $node_major ]]; then
    echo "Warning: node not found; skipping pi." >&2
    return 1
  fi
  # The LTS line can still be older than what pi needs, so verify rather than
  # assume the install above was enough.
  if ((node_major < required_major)); then
    echo "Warning: pi needs Node >= $required_major (found $(node --version)); skipping." >&2
    return 1
  fi

  installed_version="$(pi --version 2>/dev/null | sed -n 's/^v\{0,1\}\([0-9][0-9.]*\).*/\1/p' | head -n 1)"
  if [[ $installed_version == "$PI_VERSION" ]]; then
    echo "==> pi $PI_VERSION is already installed."
    return 0
  fi

  # An earlier npm-based install would shadow or be shadowed by the pnpm copy
  # depending on PATH order, so remove it first.
  if [[ -e $HOME/.local/lib/node_modules/$PI_PACKAGE ]]; then
    echo "==> Removing the npm-installed pi..."
    npm uninstall -g --prefix "$HOME/.local" "$PI_PACKAGE" >/dev/null 2>&1 || true
  fi

  echo "==> Installing pi $PI_VERSION..."
  pnpm add -g --ignore-scripts "${PI_PACKAGE}@${PI_VERSION}" || {
    echo "Warning: pi installation failed." >&2
    return 1
  }

  if ! command -v pi >/dev/null 2>&1; then
    echo "Note: add $PNPM_HOME/bin to PATH to use pi." >&2
  fi
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
    if [[ $package == fzf ]]; then
      case "$(dpkg --print-architecture)" in
        amd64) install_latest_fzf amd64 || available_apt_packages+=("$package") ;;
        arm64) install_latest_fzf arm64 || available_apt_packages+=("$package") ;;
        *) available_apt_packages+=("$package") ;;
      esac
    elif apt-cache show "$package" >/dev/null 2>&1; then
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

# Installed with pnpm rather than a distro package: pi is not packaged by dnf,
# apt, or pacman, so this runs the same way on every supported distribution.
# pnpm is installed first when missing.
install_pi || true

echo "Done."
