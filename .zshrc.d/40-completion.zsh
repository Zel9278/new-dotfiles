# 40-completion.zsh - completion styling (zstyle; compinit itself runs in 50-zinit.zsh)

# Make sure LS_COLORS exists (used for colored completion)
if [[ -z "$LS_COLORS" ]] && (( $+commands[dircolors] )); then
  eval "$(dircolors -b)"
fi

# Arrow-key navigable menu for ambiguous completions
zstyle ':completion:*' menu select

# Case-insensitive, then partial-word matching
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}' 'r:|=*' 'l:|=* r:|=*'

# Colorize completion like ls
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"

# Grouped, verbose output
zstyle ':completion:*' verbose yes
zstyle ':completion:*' group-name ''
zstyle ':completion:*:descriptions' format '%F{yellow}-- %d --%f'
zstyle ':completion:*:messages'     format '%F{purple}-- %d --%f'
zstyle ':completion:*:warnings'     format '%F{red}-- no matches found --%f'

# Path niceties: cd //→/ treated as one slash, offer ~ and .. 
zstyle ':completion:*' squeeze-slashes true
zstyle ':completion:*' special-dirs true

# Colored process list for kill
zstyle ':completion:*:*:kill:*:processes' list-colors '=(#b) #([0-9]#)*=0=01;31'
zstyle ':completion:*:kill:*' command 'ps -u $USER -o pid,%cpu,tty,cputime,cmd'
