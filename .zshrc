# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# Verbose loading: `touch ~/.dotfiles.verbose` to enable
if [[ -f ~/.dotfiles.verbose ]]; then
  echo "\e[35;1mLoading ~/.zshrc.d ...\e[0m"
  for config in "$HOME"/.zshrc.d/*.zsh(N); do
    echo "\e[90m- $config\e[0m"
    source "$config"
  done
  echo "\e[35;1mDone.\e[0m"
else
  for config in "$HOME"/.zshrc.d/*.zsh(N); do
    source "$config"
  done
fi

true

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh
