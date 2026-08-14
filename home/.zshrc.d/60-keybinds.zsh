# 60-keybinds.zsh - key bindings (loaded after plugins)

# Ctrl+Left/Right: word movement (xterm/konsole)
bindkey '^[[1;5C' forward-word
bindkey '^[[1;5D' backward-word

# Alt+Left/Right: word movement
bindkey '^[[1;3C' forward-word
bindkey '^[[1;3D' backward-word

# Home / End / Delete
bindkey '^[[H' beginning-of-line
bindkey '^[[F' end-of-line
bindkey '^[[OH' beginning-of-line
bindkey '^[[OF' end-of-line
bindkey '^[[3~' delete-char
bindkey '^[[3;5~' delete-word

# Ctrl+X Ctrl+E: edit current command line in $EDITOR
autoload -Uz edit-command-line
zle -N edit-command-line
bindkey '^X^E' edit-command-line
