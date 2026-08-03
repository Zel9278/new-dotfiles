# 80-fzf.zsh - fzf integration
#   Ctrl+R : fuzzy history search (overrides history-search-multi-word)
#   Ctrl+T : insert selected file path
#   Alt+C  : fuzzy cd into directory

if (( $+commands[fzf] )); then
  if fzf --zsh >/dev/null 2>&1; then
    source <(fzf --zsh)   # key bindings + completion
  elif [[ -f /usr/share/fzf/shell/key-bindings.zsh ]]; then
    source /usr/share/fzf/shell/key-bindings.zsh
  fi
elif [[ -f /usr/share/fzf/shell/key-bindings.zsh ]]; then
  source /usr/share/fzf/shell/key-bindings.zsh
fi

# fzf's integration may load after history-search-multi-word. Make the
# intended Ctrl-R binding explicit when the widget is available.
if (( $+widgets[fzf-history-widget] )); then
  bindkey '^R' fzf-history-widget
fi

export FZF_DEFAULT_OPTS='--height 40% --reverse --border'
if (( $+commands[rg] )); then
  export FZF_DEFAULT_COMMAND='rg --files --hidden --follow --glob "!.git/*"'
fi
