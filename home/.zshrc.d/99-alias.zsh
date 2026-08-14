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

# package management
sudo=sudo
type doas > /dev/null && sudo=doas
if (( $+commands[dnf] )); then
  alias u="${sudo} dnf update -y"
  alias i="${sudo} dnf install -y"
  alias p="${sudo} dnf remove -y"
  alias s="dnf search"
elif (( $+commands[apt-get] )); then
  alias u="${sudo} apt-get update && ${sudo} apt-get upgrade -y"
  alias i="${sudo} apt-get install -y"
  alias p="${sudo} apt-get remove -y"
  alias s="apt-cache search"
elif (( $+commands[paru] )); then
  alias u='paru -Syu'
  alias i='paru -S --needed'
  alias p='paru -Rns'
  alias s='paru -Ss'
elif (( $+commands[pacman] )); then
  alias u="${sudo} pacman -Syu"
  alias i="${sudo} pacman -S --needed"
  alias p="${sudo} pacman -Rns"
  alias s="${sudo} pacman -Ss"
fi

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
# 各種インストーラ(pnpm 等)が .zshrc 末尾へ書き込む定型ブロックを剥がしてから
# pull する。剥がしきれない差分は --autostash に任せ、競合したら中断する。
upd() {
  local dotfiles="${DOTFILES:-$HOME/.dotfiles}"
  local zshrc="$dotfiles/home/.zshrc"

  # 1) 既知の追記ブロックを除去 (PNPM_HOME 等は 00-env.zsh で管理済み)
  if [[ -f $zshrc ]] && ! git -C "$dotfiles" diff --quiet -- home/.zshrc; then
    local cleaned="${zshrc}.upd.$$"
    if perl -0777 -pe \
      's/\n*^# (pnpm|bun|deno|fnm|nvm|rustup|cargo)\b.*?^# \1 end\n//gms; s/\n*\z/\n/' \
      "$zshrc" > "$cleaned" 2>/dev/null; then
      if cmp -s "$zshrc" "$cleaned"; then
        rm -f "$cleaned"
      else
        cat "$cleaned" > "$zshrc" && rm -f "$cleaned"
        echo "\e[33mupd: .zshrc の追記ブロックを除去しました\e[0m"
      fi
    else
      rm -f "$cleaned"
    fi
  fi

  # 2) 残った差分は autostash 経由で退避しつつ pull
  git -C "$dotfiles" pull --ff-only --autostash || return

  # 3) autostash 復元が競合していたら install.sh へ進まない
  if [[ -n $(git -C "$dotfiles" ls-files --unmerged) ]]; then
    echo "\e[31;1mupd: autostash の復元が競合しました\e[0m"
    echo "解決後に 'git -C $dotfiles stash drop' を実行してください"
    return 1
  fi

  "$dotfiles/install.sh" && exec zsh
}

# tmux
alias t='tmux'
alias ta='tmux attach'
alias tk='tmux kill-server'

# asciinema
if (( $+commands[asciinema] )); then
  alias arec='asciinema rec'
  alias aplay='asciinema play'
  alias aupload='asciinema upload'
  alias astream='asciinema stream'
fi

# nix and flakes
if (( $+commands[nix] )); then
  alias nx='nix run'
  alias nsh='nix shell'
  alias nxd='nix develop'
  alias nxb='nix build'
  alias nfu='nix flake update'
  alias ngc='nix-collect-garbage -d'
fi

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
