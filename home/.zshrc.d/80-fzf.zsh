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

export FZF_DEFAULT_OPTS='--height 40% --reverse --border
  --color=fg:-1,bg:-1,hl:#5fafff
  --color=fg+:-1,bg+:#303030,hl+:#87d7ff
  --color=info:#afaf87,prompt:#d7005f,pointer:#af5fff
  --color=marker:#87ff00,spinner:#af5fff,header:#87afaf'
if (( $+commands[rg] )); then
  export FZF_DEFAULT_COMMAND='rg --files --hidden --follow --glob "!.git/*"'
fi

# Colour history entries by whether their command still resolves: green when
# it does, red when it does not (uninstalled tool, typo, host-specific
# binary). fzf has no notion of "valid", so the colouring is applied to the
# lines before fzf sees them and decoded with --ansi.
__hist_cmd_exists() {
  emulate -L zsh
  # noglob: history holds arbitrary text, including pasted escape sequences,
  # which must never be expanded or evaluated while classifying it.
  setopt localoptions extendedglob noglob

  # Drop the leading "  123  " / " 123* " event number fzf lists entries with.
  local line=${1##[[:blank:]]#[0-9]##[*]#[[:blank:]]#}
  local -a toks
  toks=(${(z)line})
  (( ${#toks} )) || return 1

  # Step over leading VAR=value assignments, then look past wrappers that take
  # the real command as their argument.
  local i=1
  while [[ ${toks[i]} == [A-Za-z_][A-Za-z0-9_]#=* ]]; do ((i++)); done
  local cmd=${toks[i]}
  if [[ $cmd == (sudo|doas|command|builtin|env|time|nohup) && -n ${toks[i+1]} ]]; then
    cmd=${toks[i+1]}
  fi
  [[ -n $cmd ]] || return 1

  # Paths are checked directly; everything else against the command table.
  if [[ $cmd == */* || $cmd == .* ]]; then
    [[ $cmd == "~/"* ]] && cmd=${HOME}/${cmd#"~/"}
    [[ -x $cmd ]]
    return
  fi

  # Looked up by key rather than with ${+assoc[$cmd]}: the subscript is an
  # arithmetic context, so a command named "firewall-cmd", or a pasted escape
  # sequence, would be evaluated as an expression instead of taken literally.
  [[ -n ${commands[(e)$cmd]} || -n ${functions[(e)$cmd]} \
    || -n ${aliases[(e)$cmd]} || -n ${builtins[(e)$cmd]} \
    || -n ${reswords[(re)$cmd]} || -n ${galiases[(e)$cmd]} ]]
}

__fzf_history_colored() {
  emulate -L zsh
  setopt localoptions extendedglob
  zmodload -F zsh/parameter p:commands p:functions p:aliases p:builtins p:reswords p:galiases 2>/dev/null

  # Duplicates are dropped, as fzf's own widget does, so a command run dozens
  # of times does not crowd out everything else. The newest one is kept.
  local line cmd
  local -A seen
  fc -rl 1 | while IFS= read -r line; do
    cmd=${line##[[:blank:]]#[0-9]##[*]#[[:blank:]]#}
    [[ -n ${seen[(e)$cmd]} ]] && continue
    seen[$cmd]=1
    if __hist_cmd_exists "$line"; then
      print -r -- $'\e[32m'"$line"$'\e[0m'
    else
      print -r -- $'\e[31m'"$line"$'\e[0m'
    fi
  done
}

# fzf reads the history itself, so colouring it means providing the listing
# instead. That rules out reusing fzf's widget, and this one takes its place:
# it keeps the parts that matter day to day (newest first, no duplicates, the
# typed prefix carried over as the query, multi-select) but not upstream's
# multi-line entry handling, which needs the event numbers this listing hides.
__fzf_history_widget_colored() {
  emulate -L zsh
  # extendedglob is needed by the pattern that strips the event number below.
  setopt localoptions extendedglob pipefail no_aliases 2>/dev/null

  local selected
  selected=$(
    __fzf_history_colored |
      FZF_DEFAULT_OPTS="${FZF_DEFAULT_OPTS} --ansi -n2..,.. --scheme=history
        --highlight-line --multi --query=${(qqq)LBUFFER}
        --bind=ctrl-r:toggle-sort ${FZF_CTRL_R_OPTS-}" \
      FZF_DEFAULT_OPTS_FILE='' \
      fzf
  )
  local ret=$?

  if [[ -n $selected ]]; then
    local -a cmds
    local line
    for line in ${(f)selected}; do
      # Strip the event number the listing is prefixed with; what remains is
      # the command as it was run.
      cmds+=("${line##[[:blank:]]#[0-9]##[*]#[[:blank:]]#}")
    done
    if (( ${#cmds} )); then
      BUFFER=${(pj:\n:)cmds}
      CURSOR=${#BUFFER}
    fi
  fi

  zle reset-prompt
  return $ret
}

# Only take over Ctrl-R once fzf's own integration has loaded, so a missing or
# too-old fzf leaves the default binding alone.
if (( $+widgets[fzf-history-widget] )); then
  zle -N __fzf_history_widget_colored
  bindkey '^R' __fzf_history_widget_colored
fi
