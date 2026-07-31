# 99-prompt-overrides.zsh - concise developer-focused prompt
# Loaded after 99-p10k.zsh so generated p10k settings stay easy to regenerate.

typeset -g POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=(
  status                  # exit code of the last command
  command_execution_time  # duration of slow commands
  background_jobs         # background job count
  virtualenv              # active Python virtual environment
  node_version            # shown only in Node projects
  rust_version            # shown only in Rust projects
)

(( $+functions[p10k] )) && p10k reload
