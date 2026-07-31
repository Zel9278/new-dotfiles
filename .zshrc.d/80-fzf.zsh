# 80-fzf.zsh - fzf integration
#   Ctrl+R : fuzzy history search (overrides history-search-multi-word)
#   Ctrl+T : insert selected file path
#   Alt+C  : fuzzy cd into directory

if (( $+commands[fzf] )); then
  source <(fzf --zsh)   # key bindings + completion
elif [[ -f /usr/share/fzf/shell/key-bindings.zsh ]]; then
  source /usr/share/fzf/shell/key-bindings.zsh
fi

export FZF_DEFAULT_OPTS='--height 40% --reverse --border'
if (( $+commands[rg] )); then
  export FZF_DEFAULT_COMMAND='rg --files --hidden --follow --glob "!.git/*"'
fi
