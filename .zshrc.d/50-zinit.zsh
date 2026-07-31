# 50-zinit.zsh - zinit bootstrap & plugins

ZINIT_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/zinit/zinit.git"
if [[ ! -d "$ZINIT_HOME" ]]; then
  mkdir -p "${ZINIT_HOME:h}"
  git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi
source "$ZINIT_HOME/zinit.zsh"

# Extra completions (must be in fpath before compinit)
zinit light zsh-users/zsh-completions

autoload -Uz compinit && compinit

setopt promptsubst

# Oh-My-Zsh libs
zinit snippet OMZL::history.zsh
zinit snippet OMZL::git.zsh
zinit snippet OMZL::key-bindings.zsh
zinit ice wait silent lucid
zinit snippet OMZL::clipboard.zsh
zinit ice lucid
zinit snippet OMZL::spectrum.zsh

# Oh-My-Zsh plugins
zinit snippet OMZP::git
zinit snippet OMZP::sudo   # press ESC twice to prepend sudo

# Plugins (lazy-loaded)
# zsh-autosuggestions: needs atload to start correctly under turbo mode
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=8"
ZSH_AUTOSUGGEST_STRATEGY=(history completion)
ZSH_AUTOSUGGEST_USE_ASYNC=1
zinit ice wait lucid atload"_zsh_autosuggest_start"
zinit light zsh-users/zsh-autosuggestions

zinit ice wait silent lucid
zinit light zdharma-continuum/fast-syntax-highlighting

zinit ice wait silent lucid
zinit light zdharma-continuum/history-search-multi-word

zinit ice wait silent lucid
zinit light zsh-users/zsh-history-substring-search

# Theme
zinit ice depth=1
zinit light romkatv/powerlevel10k

# Key bindings for the plugins above
bindkey "^R" history-search-multi-word
bindkey "^[[A" history-substring-search-up
bindkey "^[[B" history-substring-search-down
