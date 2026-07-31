# 99-alias.zsh - aliases

# core
alias ':q'=exit
alias reload='exec zsh'
alias cls=clear
alias clsls='clear && ls'
if (( $+commands[eza] )); then
  alias ls='eza --group-directories-first'
  alias la='eza -lah --git --group-directories-first'
  alias ll=la
  alias ld=la
  alias lt='eza --tree --level=2 --group-directories-first'
else
  alias ls='ls --color=auto'
  alias la='ls -lah'
  alias ll=la
  alias ld='ls -lah'
fi
alias grep='grep --color=auto'
alias less='less -r'
alias tree='tree -C'
alias tl='tree | less'
alias tal='tree -a | less'
alias dog=cat
alias cb='xsel --clipboard --input'
alias svim='sudoedit'

# system info fetch (fastfetch: successor of neofetch/screenfetch)
if (( $+commands[fastfetch] )); then
  alias ff=fastfetch
  alias nf=fastfetch
  alias sf=fastfetch
fi

# awk1..awk9 → print the Nth field
for i in {1..9}; do
  alias "awk${i}"="awk '{print \$${i}}'"
done

# package management (Fedora)
sudo=sudo
type doas > /dev/null && sudo=doas
alias u="${sudo} dnf update -y"
alias i="${sudo} dnf install -y"
alias p="${sudo} dnf erase -y"
alias s="dnf search"

# docker
type docker-compose > /dev/null && alias dc=docker-compose || alias dc='docker compose'
alias buildup='dc up --build -d'

# package managers / build tools
# pnpm
alias pn=pnpm
alias pni='pnpm install'
alias pna='pnpm add'
alias pnd='pnpm remove'
alias pnu='pnpm update'
alias pnx='pnpm dlx'

# xmake
alias xb='xmake build'
alias xr='xmake run'
alias xc='xmake clean'
alias xconfig='xmake f'

# uv
alias uvr='uv run'
alias uva='uv add'
alias uvd='uv remove'
alias uvs='uv sync'

# cargo
alias cb='cargo build'
alias cr='cargo run'
alias ct='cargo test'
alias cc='cargo check'
alias cf='cargo fmt'
alias ccl='cargo clippy'

# git
alias gf='git fetch -p --all'
alias gpush='git push -u origin $(git branch --show-current)'
alias gdc='git diff --compact-summary --diff-filter=d'

# tmux
alias t='tmux'
alias ta='tmux attach'
alias tk='tmux kill-server'

# ssh host/history picker (fzf)
sshf() {
  (( $+commands[fzf] )) || {
    print -u2 'sshf: fzf is required'
    return 1
  }

  local target
  target=$(
    {
      if [[ -r "$HOME/.ssh/config" ]]; then
        awk '$1 == "Host" { for (i = 2; i <= NF; i++) if ($i !~ /^[*!?]/) print $i }' "$HOME/.ssh/config"
      fi
      fc -ln -r 1 | sed -nE 's/^[[:space:]]*ssh[[:space:]]+(-[^[:space:]]+[[:space:]]+)*([^[:space:]]+).*$/\2/p'
    } | sed '/^$/d' | sort -u | fzf --height 40% --reverse --border --prompt='ssh> '
  ) || return

  [[ -n "$target" ]] && command ssh "$target"
}

# quick edit
alias vz='nvim ~/.zshrc'
alias ve='nvim ~/.zshrc.d/00-env.zsh'
alias va='nvim ~/.zshrc.d/99-alias.zsh'
alias vzd='nvim ~/.zshrc.d/'
