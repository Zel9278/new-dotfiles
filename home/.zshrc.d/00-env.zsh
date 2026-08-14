# 00-env.zsh - environment variables & PATH

export TERM="${TERM:-xterm-256color}"
export EDITOR=nvim
export VISUAL="$EDITOR"

export DOTFILES="$HOME/.dotfiles"
export ZD="$HOME/.zshrc.d"

# PATH (deduplicated, earlier entries take precedence)
typeset -U path PATH
path=(
  "$HOME/.opencode/bin"
  "$HOME/.local/bin"
  "$HOME/bin"
  "$HOME/.cargo/bin"
  "$HOME/go/bin"
  $path
)

# pnpm (binaries live in $PNPM_HOME/bin)
export PNPM_HOME="$HOME/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME/bin:"*) ;;
  *) path=("$PNPM_HOME/bin" $path) ;;
esac

# xmake (migrated from .bashrc)
[[ ! -f "$HOME/.xmake/profile" ]] || source "$HOME/.xmake/profile"

# fcitx5 (from .bash_profile; the current desktop session sets XMODIFIERS=@im=none,
# so leave this commented out unless you actually need it)
# export XMODIFIERS="@im=fcitx5"
