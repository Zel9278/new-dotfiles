# 90-yazi.zsh - yazi file manager integration
# `y` で起動すると、終了時に yazi 内で移動していたディレクトリにそのまま cd できる

(( $+commands[yazi] )) || return 0

function y() {
  local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
  yazi "$@" --cwd-file="$tmp"
  if cwd="$(command cat -- "$tmp")" && [[ -n "$cwd" && "$cwd" != "$PWD" ]]; then
    builtin cd -- "$cwd"
  fi
  rm -f -- "$tmp"
}
