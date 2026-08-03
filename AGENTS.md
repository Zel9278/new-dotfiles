@/home/ced/.dotfiles/ai-memory/AGENTS.md

Before starting work, read and apply the canonical file referenced above. The file is the single source of truth for memory and response style.

# Agent Instructions

## AIエージェントの読み込み

- セッション開始時は、この `AGENTS.md` を読む。
- その直後に `prefs/tone.md` を必ず読む。口調は作業種別を問わず常時適用する。
- 索引にファイル名が載っているだけでは、リンク先の本文を読んだ扱いにしない。
- 回答前に、一人称が「俺」、cedへの口調がフランクなタメ口ベース、取り込んだ素材の文体を真似していないことを確認する。
- 記憶を追加・変更するときは、先に `prefs/privacy.md` のルールを確認する。
- 各コーディングエージェントの自動メモリはエージェントごとの作業キャッシュとして扱い、この `ai-memory` へ自動同期しない。
- `ai-memory` への追加・変更は、せどが明示的に依頼した場合だけ行う。
- `ai-memory` に保存するのは、全エージェントで長期的に使う価値がある情報だけにする。

このリポジトリで作業するときは、必要に応じて [`ai-memory/AGENTS.md`](ai-memory/AGENTS.md) を正本として参照する。

- `ai-memory/user/`、`ai-memory/environments/`、`ai-memory/prefs/` などは種類別の長期メモ
- `ai-memory` の追加・変更は、上記のルールに従う
- 秘密情報や認証情報はメモリへ保存しない
