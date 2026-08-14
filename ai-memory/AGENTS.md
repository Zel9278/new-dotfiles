@/home/ced/.dotfiles/ai-memory/AGENTS.md

Before starting work, read and apply the canonical file referenced above. The file is the single source of truth for memory and response style.

# AI Memory

Codex、Claude Code、Cursor、ChatGPT などから読める、ツール非依存の共有メモリ。ここを正本とする。

## ルール

- 1ファイル1トピックにする。
- ファイル名は `kebab-case.md` にする。
- 各メモは YAML frontmatter を先頭に置く。
- メモ同士のリンクは `[[file-name]]` を使う。
- `archive/`、`anarchy/`、`scratch/` は通常の索引・検証の対象外。
- 個人メモと生成された `MEMORY-INDEX.md` はGit管理外にする。
- `MEMORY-INDEX.md` は `tools/` の更新スクリプトで生成し、手動編集しない。
- 秘密情報、認証情報、APIキー、トークン、パスワード、不要な個人情報は保存しない。

## AIエージェントの読み込み

- セッション開始時は、グローバル入口の `AGENTS.md` / `CLAUDE.md` を優先して読む。
- このファイルを読んだ直後に、dotfilesリポジトリルートの `prefs/tone.md` を読む。このファイルから見て `../prefs/tone.md` 。
- 索引にファイル名が載っているだけでは、リンク先の本文を読んだ扱いにしない。
- 記憶を追加・変更するときは、先にdotfilesリポジトリルートの `prefs/privacy.md`(`../prefs/privacy.md`) を確認する。
- 各コーディングエージェントの自動メモリはエージェントごとの作業キャッシュとして扱い、この `ai-memory` へ自動同期しない。
- `ai-memory` への追加・変更は、せどが明示的に依頼した場合だけ行う。
- `ai-memory` に保存するのは、全エージェントで長期的に使う価値がある情報だけにする。

## フォーマット

```markdown
---
title: 短いタイトル
type: user | environments | prefs | projects | reference | trivia | paths
tags: [任意, タグ]
updated: 2026-08-01
---

本文。確認済みの事実を、必要な範囲だけ書く。
```

## 種類

- `user/`: 呼び方、役割、長期的なプロフィール
- `environments/`: OS、ハードウェア、開発環境
- `prefs/`: AIへの指示、好み、作業方針
- `projects/`: 進行中の作業、目標、制約
- `reference/`: 外部リンク、API、仕様のメモ
- `trivia/`: 作業に直接関係しない用語や雑学
- `paths/`: インストール済みプログラムのパス
- `scratch/`: 作業中の下書き。長期保存しない

## エージェント入口

グローバル入口はリポジトリ側で管理し、`install.sh` が各エージェントの場所へ配置する。テンプレート内の `{{DOTPATH}}` は実際のパスに展開される。

| エージェント | 入口 | 配置先 |
|---|---|---|
| Codex | `AGENTS.md` | `~/.codex/AGENTS.md` |
| Claude Code | `CLAUDE.md` | `~/.claude/CLAUDE.md` |
| pi | `PI.md` | `~/.pi/agent/AGENTS.md` |

リポジトリ外に同名構造の古いコピー(`~/Downloads/ai-memory/` など)があっても読まない。正本はdotfilesリポジトリ内のこのツリーだけ。

## 索引

索引は別ファイルの [`MEMORY-INDEX.md`](MEMORY-INDEX.md) に生成する。個人メモのファイル名やタイトルがGitの履歴に残らないよう、このファイルもGit管理外にする。

## アーカイブと掲示板と下書き

不要になったメモは削除せず `archive/` に移動する。

`anarchy/` はエージェントごとの失敗談や改善案を自由に書く場所。通常のメモと混ぜず、個人情報や秘密情報は書かない。

`scratch/` は作業中の下書き置き場。frontmatterは必須にしない。残す価値が出たら種類別フォルダへ移す。
