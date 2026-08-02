# dotfiles

zsh ベースの dotfiles。ベース: https://github.com/Zel9278/new-dotfiles

## 構成

| ファイル | 内容 |
|---|---|
| `.zshrc` | `.zshrc.d/*.zsh` を番号順に読み込むローダー |
| `.zshrc.d/00-env.zsh` | 環境変数 / PATH |
| `.zshrc.d/40-completion.zsh` | 補完の強化(メニュー選択・大文字小文字無視・色付け) |
| `.zshrc.d/50-zinit.zsh` | zinit のブートストラップとプラグイン定義 |
| `.zshrc.d/60-keybinds.zsh` | キーバインド(単語移動・Home/End・Ctrl+X Ctrl+E) |
| `.zshrc.d/70-man-colors.zsh` | man ページの色付け |
| `.zshrc.d/80-fzf.zsh` | fzf 統合(Ctrl+R / Ctrl+T / Alt+C) |
| `.zshrc.d/90-yazi.zsh` | yazi 統合(`y` で終了時にそのディレクトリへ cd) |
| `.zshrc.d/99-alias.zsh` | エイリアス(eza / fastfetch があればそちらを使用) |
| `.zshrc.d/99-auto-cdls.zsh` | cd 後に自動で `ls` |
| `.zshrc.d/99-p10k.zsh` | powerlevel10k 設定の読み込み |
| `.zshrc.d/99-local.zsh` | `~/.zshrc.local` を読み込み(管理外のローカル設定用) |
| `.gitconfig` | git のユーザー情報・エイリアス・便利設定 |
| `.vimrc` | vim の最小限の見やすい設定 |
| `.p10k.zsh` | powerlevel10k の設定(`p10k configure` で生成) |
| `.config/fastfetch/config.jsonc` | fastfetch の表示設定(`ff` コマンド) |
| `.config/bat/config` | bat のテーマ設定 |
| `.config/nvim/` | Neovim 設定([LazyVim](https://www.lazyvim.org/) ベース) |
| `.config/yazi/yazi.toml` | yazi 設定(実行ファイルをターミナルで直接起動。KIOの "launching executables is not allowed" 回避) |
| `ai-memory/` | Codex と Claude で共有する分類型の作業コンテキスト・判断メモ |
| `AGENTS.md` / `CLAUDE.md` | AI が `ai-memory/` を参照・更新するためのリポジトリ指示 |
| `asciinema` | ターミナル操作の録画・再生・共有(alias: `arec` / `aplay` / `aupload` / `astream`) |
| `install.sh` | `$HOME` と `~/.codex` / `~/.claude` にシンボリックリンクを張る(既存ファイルはバックアップ) |
| `auto-install.sh` | 新規マシン用ブートストラップ(clone → install) |

## AI Memory

`ai-memory/AGENTS.md` を正本にして、メモをトピック・種類ごとのMarkdownに分けて管理する。
索引の更新と検証は、Linux/macOSでは `ai-memory/tools/*.sh`、Windowsでは `ai-memory/tools/*.ps1` を使う。
個人メモ、生成索引、Obsidian設定はGit管理外。`install.sh` はCodexとClaude Codeのグローバル入口だけを `~/.dotfiles` へリンクする。

## プラグイン(zinit 経由で自動インストール)

- [zsh-autosuggestions](https://github.com/zsh-users/zsh-autosuggestions) — 履歴からの薄い入力候補
- [fast-syntax-highlighting](https://github.com/zdharma-continuum/fast-syntax-highlighting) — コマンドの色付け
- [history-search-multi-word](https://github.com/zdharma-continuum/history-search-multi-word) — 履歴検索
- [zsh-history-substring-search](https://github.com/zsh-users/zsh-history-substring-search) — ↑↓ で前方一致履歴
- [zsh-completions](https://github.com/zsh-users/zsh-completions) — 追加の補完定義
- [powerlevel10k](https://github.com/romkatv/powerlevel10k) — プロンプトテーマ
- OMZ スニペット: history / git / key-bindings / clipboard / spectrum / sudo(ESC 2回で sudo 付与)

## git の主なエイリアス・設定

| コマンド | 内容 |
|---|---|
| `git lg` | グラフ付きの見やすいログ |
| `git st` / `git co` / `git sw` / `git br` | status -sb / checkout / switch / branch |
| `git dc` / `git unstage` | staged の diff / add の取り消し |
| `push.autoSetupRemote` | `git push` だけで upstream 設定 |
| `fetch.prune` / `rerere` | 消えたブランチ参照を掃除 / コンフリクト解消を記憶 |

## asciinema のエイリアス

`asciinema` がインストールされている場合だけ、次のエイリアスを有効にする。

| コマンド | 内容 |
|---|---|
| `arec` | ターミナル録画(`asciinema rec`) |
| `aplay` | 録画再生(`asciinema play`) |
| `aupload` | 録画アップロード(`asciinema upload`) |
| `astream` | ライブ配信(`asciinema stream`) |

録画は `arec demo.cast` のように保存し、再生は `aplay demo.cast` で行う。録画ファイルはdotfilesへコミットしない。

## Nix のエイリアス

`nix` がインストールされている場合だけ、次のエイリアスを有効にする。

| コマンド | 内容 |
|---|---|
| `nx` | パッケージを実行(`nix run`) |
| `nsh` | 一時的なパッケージ環境(`nix shell`) |
| `nxd` | 開発シェル(`nix develop`) |
| `nxb` | flakeをビルド(`nix build`) |
| `nfu` | flakeの依存関係を更新(`nix flake update`) |
| `ngc` | 古いNix世代を削除(`nix-collect-garbage -d`) |

## 依存ツール(任意)

このdotfilesが使うコマンドラインツールを、検出したパッケージマネージャーから導入できる。

```sh
~/.dotfiles/install-packages.sh
```

対応しているパッケージマネージャーは `dnf` (Fedora)、`apt-get` (Debian / Ubuntu)、`pacman` (Arch) 。Archで `paru` が無い場合は、AURから `paru` を導入するか確認してから進む。

Fedoraで手動実行する場合:

```sh
sudo dnf install -y asciinema fzf eza fastfetch bat neovim ripgrep fd-find yazi
```

- **fzf**: Ctrl+R で曖昧履歴検索、Ctrl+T でファイル挿入、Alt+C でディレクトリ移動
- **eza**: モダンな ls(インストールされている場合自動で ls 系エイリアスが切り替わる)
- **fastfetch**: システム情報表示(`ff` / `nf` / `sf`)
- **bat**: シンタックスハイライト付き cat
- **neovim + ripgrep + fd-find**: LazyVim 本体と検索系ツール
- **yazi**: ターミナルファイルマネージャ(マウス対応)。`y` で起動すると終了時のディレクトリに移動できる
- **asciinema**: ターミナル操作の録画・再生・共有(`arec` / `aplay` / `aupload` / `astream`)
- **Nix**: パッケージ管理と再現可能な開発環境(`nx` / `nsh` / `nxd` / `nxb` / `nfu` / `ngc`)

## yazi の主な操作

| キー | 動作 |
|---|---|
| `h` `j` `k` `l` / マウス | 移動(クリック・スクロール・ダブルクリックも可) |
| `Enter` | 開く / ディレクトリに入る |
| `Space` | 選択(複数可) → `y`=コピー `x`=切り取り `p`=貼り付け |
| `a` | 新規作成 / `r` リネーム / `d` ゴミ箱 |
| `Tab` | タブ追加 |
| `~` でヘルプ、`q` | 終了 |

## Neovim (LazyVim)

`EDITOR=nvim`。リーダーキーは `Space`。主な操作:

| キー | 動作 |
|---|---|
| `Space` `Space` | ファイル曖昧検索 |
| `Space` `e` | ファイルツリー表示切替 |
| `Space` `s` `g` | 全文検索(live grep) |
| `Space` `,` | 開いているバッファ(タブ)切替 |
| `gd` / `K` | 定義ジャンプ / ホバーでドキュメント |
| `Space` `c` `a` | コードアクション(LSP) |
| `Space` `g` `g` | lazygit風Git UI |
| `Ctrl` `/` | ターミナル表示切替 |
| `Space` `q` `q` | 終了 |

- 初回起動時にプラグイン・LSP・tree-sitter parser が自動インストールされる
- カスタマイズは `lua/plugins/` にファイルを追加(例: `example.lua` 参照)

## インストール

新しいマシンではこれ一発:

```sh
bash <(curl -sL https://raw.githubusercontent.com/Zel9278/new-dotfiles/main/auto-install.sh)
```

手動の場合:

```sh
git clone <このリポジトリのURL> ~/.dotfiles
~/.dotfiles/install.sh
exec zsh          # 初回起動時に zinit がプラグインを自動インストール
p10k configure    # プロンプトの見た目を対話的に設定
```

`install.sh` は通常のdotfilesに加えて、次のAIエージェント入口も作成する。

```text
~/.codex/AGENTS.md  -> ~/.dotfiles/AGENTS.md
~/.claude/CLAUDE.md -> ~/.dotfiles/CLAUDE.md
```

既存の実ファイルは `.bak.<日時>` に退避する。Yuki InferenceなどCodexのユーザー固有設定は、dotfilesには含めず `~/.codex/config.toml` で管理する。

## Tips

- `touch ~/.dotfiles.verbose` で `.zshrc.d` の読み込みログを表示(`rm` で無効化)
- プラグイン更新: `zinit update --all`
- `reload` で zsh を再起動(設定反映)
- 補完は Tab でメニュー表示 → 矢印キーで選択
- Ctrl+X Ctrl+E でコマンドラインをエディタで編集
- マシン固有の設定は `~/.zshrc.local` に書く(dotfiles には含めない)
