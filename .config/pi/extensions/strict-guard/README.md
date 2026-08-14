# strict-guard

コマンド実行 (`bash`) とファイル編集 (`write`, `edit`) の前に確認ダイアログを挟むpi拡張。

## 機能

- **bash コマンドの確認** — 危険パターン（`rm -rf`, `sudo`, `git push --force` など）を検出
- **ファイル書き込みの確認** — `.env`, `.git/config`, 秘密鍵などの保護パス
- **web_fetch の確認** — `render_js=true`（Playwright でJS実行）のとき確認
- **ブラウザ自動化の検出** — bash 経由の Playwright / Puppeteer / リモートデバッグ
- **3段階のレベル** — `off` / `risky` (危険時のみ) / `always`
- **セッション内記憶** — 一度許可したら同じセッション中は聞かない（設定可能）
- **UI無し環境でのブロック** — print/jsonモードで確認できないときは実行を止める（設定可能）

## 設定

グローバル: `~/.pi/agent/strict-guard.json`

```json
{
  "bash": "risky",
  "write": "risky",
  "edit": "off",
  "webFetch": "risky",
  "alwaysConfirmDelete": true,
  "alwaysConfirmGitDestructive": true,
  "alwaysConfirmBrowserRender": true,
  "showDetails": true,
  "blockWhenNoUI": true,
  "rememberPerSession": true,
  "protectedPaths": [".env", ".git/config", "id_rsa", ".ssh/", "credentials"]
}
```

### レベル

- `off` — 確認しない
- `risky` — 危険パターンに当たったときだけ確認（既定）
- `always` — 毎回確認

### オプション

- `alwaysConfirmDelete` — 削除系コマンド（`rm -rf`, `find -delete` など）は bash レベルに関わらず常に確認
- `alwaysConfirmGitDestructive` — git 履歴破壊系（`push --force`, `reset --hard` など）は常に確認
- `alwaysConfirmBrowserRender` — `web_fetch` の `render_js=true` は webFetch レベルに関わらず常に確認
- `showDetails` — 確認ダイアログでコマンド全文を表示（false なら先頭80文字のみ）
- `blockWhenNoUI` — print/json モードで確認できない場合はブロックする
- `rememberPerSession` — 一度許可したコマンド/パスを同じセッション中は記憶して再度聞かない
- `protectedPaths` — 追加で保護するパス（部分一致）

## 使い方

### インタラクティブ設定

```bash
pi
> /guard
```

SettingsList UI が開く。← → で値を変更、Esc で閉じる。変更は即座に保存される。

### コマンド引数

```bash
# 現在の設定を表示
> /guard status

# セッション内の許可済みキャッシュをクリア
> /guard reset
```

### 確認ダイアログ

危険なコマンドや保護パスへの書き込みが検出されると、ターミナル中央にダイアログが出る。

```
╭─ 危険なコマンド: rm ─────────────────────────────╮
│ $ rm -rf /tmp/guard-demo2 && echo "削除した"     │
│                                                  │
│ 検出: rm -rf (再帰・強制), 対象: 1件             │
│                                                  │
│ ❯ 許可  今回だけ                                 │
│   このセッションでは常に許可  次から確認しない   │
│   拒否  実行せず理由を返す                       │
╰──────────────── ↑↓ 選択 • enter 決定 • esc 拒否 ─╯
```

見出しには主コマンド名が入る。`sudo` や `env`、`FOO=1` のような前置き、`/bin/rm` のようなパス付きも剥がして実際に走るものを出す。

検出ラベルには実際のフラグを添える。`-rf` なら `rm -rf (再帰・強制)`、`-r` だけなら `rm -r (再帰)`。どのフラグが危険判定を招いたかが分かる。

`rm` のときは対象の件数も出す。シェル展開前の数なので目安で、ワイルドカードを含む場合は `対象: 1件の指定 (展開で増える)` と付記する。

キー操作は `↑↓` または `j`/`k` で移動、`enter` で決定、数字キーで直接選択、`esc` で拒否。

- 危険判定時は枠と見出しが `error` 色、それ以外は `accent` 色
- Esc とキャンセルは拒否扱い
- `rememberPerSession: false` のときは「常に許可」が出ない
- 選択肢の説明はラベルの直後に置く。`SelectList` の `description` は列を揃えて右に離すため使っていない
- TUI 以外（RPC など）では `ctx.ui.select` の単純な選択肢に落ちる
- UI がない（print/json）ときは `blockWhenNoUI` に従う

## 判定前の正規化

パターンマッチの前にコマンド文字列を清める。誤検知を減らすため。

### ヒアドキュメント本体を除外

`<<EOF`, `<<'EOF'`, `<<-EOF` の本体は判定対象外。ファイルに書き込む内容はそのターンで実行されないので、中に `rm -rf` があっても危険ではない。

```bash
# 確認されない（本体は対象外）
cat > test.mjs <<'EOF'
const re = /rm -rf/;
EOF

# 確認される（ヒアドキュメントの外）
cat > a.txt <<'EOF'
harmless
EOF
rm -rf /tmp/x
```

抜け道は残る。スクリプトを書いて別ターンで `bash script.sh` すれば判定を通る。その場合は write ガードと bash ガードの二段で見ることになる。

### `--` 以降を除外

POSIX では `--` がオプションの終わりなので、以降はファイル名扱いにする。

```bash
rm -- -f          # 確認されない（-f はファイル名）
rm -rf -- file    # 確認される（-rf は -- の前）
```

除外はコマンド区切り（`;` `&&` `||` `|` 改行）を越えないので、`git diff -- f.txt && sudo reboot` の `sudo` は検出される。

## 検出パターン

### 削除系

- `rm -rf`, `rm` + ワイルドカード
- `find -delete`, `find -exec rm`
- `shred`, `truncate -s 0`
- ブロックデバイスへの直接書き込み
- `mkfs`, `dd of=`

### git 破壊系

- `git push --force`
- `git reset --hard`
- `git clean -f`
- `git checkout --` (変更破棄)
- `git branch -D`
- `git rebase`, `git commit --amend`
- `git filter-branch/filter-repo`
- `git restore/stash drop/stash clear`

### ブラウザ自動化

- `playwright`, `puppeteer`, `selenium-webdriver`
- `chromium.launch()`, `firefox.launch()`, `webkit.launch()`
- `--remote-debugging-port`（Chrome リモートデバッグ）
- `--disable-web-security`

### 一般危険

- `sudo`, `doas`
- 再帰的な `chmod`/`chown`
- `chmod 777`
- `systemctl stop/restart/disable`
- `kill -9`
- `curl | sh`, `wget | sh`
- `npm publish`
- `docker rm`, `docker system prune`
- `kubectl delete`
- `terraform apply/destroy`
- クラウド CLI の `delete`
- `DROP TABLE/DATABASE`
- `history -c`, `crontab -r`
- fork bomb

```
strict-guard/
├── index.ts        # tool_call フックと /guard コマンド
├── dialog.ts       # 確認ダイアログ（TUI / フォールバック）
├── rules.ts        # 危険パターンと判定前の正規化
├── config.ts       # 設定の読み書き
└── rules.test.mjs  # 正規化のテスト
```

テストの実行:

```bash
node --experimental-strip-types --test rules.test.mjs
```

## インストール

```bash
# グローバルに自動ロード
cp -r strict-guard ~/.pi/agent/extensions/

# プロジェクトローカル（trust後に読まれる）
cp -r strict-guard .pi/extensions/

# お試し（-e フラグ）
pi -e ~/.pi/agent/extensions/strict-guard/index.ts
```

## 制限

- 確認をバイパスしたければ設定を `off` にするか、別の書き方（`unlink` など）を使う
- ヒアドキュメントでスクリプトを書いて別ターンで実行すれば判定を通る
- クォートされた文字列リテラルは判定対象のまま（`echo "rm -rf"` は検出される）
- シェルのエイリアスや関数で `rm` をラップしている場合、パターンマッチが効かないことがある
- `bash` の入力パラメータをチェックするので、tool内での間接呼び出しは見えない
- 保護パスは部分一致なので、`/home/user/.env` と `.env.example` が両方マッチする可能性がある
