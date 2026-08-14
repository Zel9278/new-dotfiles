# 70-man-colors.zsh - colored man pages (via less termcap)

export LESS_TERMCAP_mb=$'\e[1;31m'    # blink     -> bold red
export LESS_TERMCAP_md=$'\e[1;36m'    # bold      -> bold cyan    (headings)
export LESS_TERMCAP_me=$'\e[0m'       # end bold/blink
export LESS_TERMCAP_so=$'\e[1;44;33m' # standout  -> yellow on blue (status line)
export LESS_TERMCAP_se=$'\e[0m'       # end standout
export LESS_TERMCAP_us=$'\e[1;32m'    # underline -> bold green   (options)
export LESS_TERMCAP_ue=$'\e[0m'       # end underline
export GROFF_NO_SGR=1                  # let less handle coloring
