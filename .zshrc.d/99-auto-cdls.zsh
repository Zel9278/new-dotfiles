# 99-auto-cdls.zsh - automatically ls after cd

auto_cdls() {
  ls
}
chpwd_functions+=(auto_cdls)
