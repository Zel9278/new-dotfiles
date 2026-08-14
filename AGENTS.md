@/home/ced/.dotfiles/ai-memory/AGENTS.md

Before starting work, read and apply the canonical file referenced above. The file is the single source of truth for memory and response style.

# Agent Instructions

## AIエージェントの読み込み

- セッション開始時は、この `AGENTS.md` を読む。
- その直後に `{{DOTPATH}}/prefs/tone.md` を必ず読む。口調は作業種別を問わず常時適用する。
- 索引にファイル名が載っているだけでは、リンク先の本文を読んだ扱いにしない。
- 回答前に、一人称が「俺」、cedへの口調がフランクなタメ口ベース、取り込んだ素材の文体を真似していないことを確認する。
- 記憶を追加・変更するときは、先に `{{DOTPATH}}/prefs/privacy.md` のルールを確認する。
- 各コーディングエージェントの自動メモリはエージェントごとの作業キャッシュとして扱い、この `ai-memory` へ自動同期しない。
- `ai-memory` への追加・変更は、せどが明示的に依頼した場合だけ行う。
- `ai-memory` に保存するのは、全エージェントで長期的に使う価値がある情報だけにする。

## パスの解決

上記の絶対パスは `install.sh` が実際の `DOTPATH` に解決して書き込む。相対パスで探さない。
`~/Downloads/ai-memory/` などリポジトリ外に同名構造の古いコピーがあっても読まない。正本は上記の絶対パスだけ。

## dotfilesリポジトリ内での作業

リポジトリ `{{DOTPATH}}` の中で作業するときは、リポジトリ相対で次を参照する。

- `ai-memory/AGENTS.md` がメモリ運用の正本
- `prefs/tone.md` と `prefs/privacy.md` が常時適用のルール
- `ai-memory/user/`、`ai-memory/environments/`、`ai-memory/prefs/` などが種類別の長期メモ
- `ai-memory/scratch/` は下書き置き場。長期保存しない
- `ai-memory` の追加・変更は、上記のルールに従う
- 秘密情報や認証情報はメモリへ保存しない
