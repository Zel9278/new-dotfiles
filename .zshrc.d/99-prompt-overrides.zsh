# 99-prompt-overrides.zsh - concise developer-focused prompt
# Loaded after 99-p10k.zsh so generated p10k settings stay easy to regenerate.

_prompt_overrides_apply() {
  typeset -g POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=(
    status                  # exit code of the last command
    command_execution_time  # duration of slow commands
    background_jobs         # background job count
    virtualenv              # active Python virtual environment
    node_version            # shown only in Node projects
    rust_version            # shown only in Rust projects
  )
}

# zinit may load p10k after this file, so apply the override immediately before
# prompt rendering as well.
autoload -Uz add-zsh-hook
add-zsh-hook precmd _prompt_overrides_apply
_prompt_overrides_apply
