# AI Memory

Codex、Claude Code、pi で共有する長期メモリです。ルールの正本は [AGENTS.md](AGENTS.md) で、索引はローカルの `MEMORY-INDEX.md` に生成します。

## 使い方

1. 作業に必要なカテゴリのメモだけ読む。
2. 長期的に再利用する価値がある確定情報を、1ファイル1トピックで追加する。
3. 追加・変更前に、プロジェクトルートの `prefs/privacy.md` を確認する。
4. Linux/macOSでは `tools/*.sh`、Windowsでは `tools/*.ps1` を使う。

## メモの分類

| フォルダ | 内容 |
|---|---|
| `user/` | プロフィールや呼び方 |
| `environments/` | OS・機材・開発環境 |
| `prefs/` | 作業上の好み・ルール |
| `projects/` | プロジェクトのメモ |
| `reference/` | API・外部資料 |
| `trivia/` | 用語・雑学 |
| `paths/` | インストール先 |
| `archive/` | 不要になったメモ |
| `anarchy/` | エージェントの失敗談・改善案 |
| `scratch/` | 作業中の下書き(長期保存しない) |

個人メモと生成索引はGit管理外です。索引の更新・検証方法は [tools/README.md](tools/README.md) を参照。
