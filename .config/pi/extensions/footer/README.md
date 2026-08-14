# footer

pi のフッターを powerline 風に差し替えて、作業中に見たい情報をまとめて出す拡張。

```
 ~/.dotfiles   pi/main  3      2h14m / 1h48m  ↑45.2k ↓12.1k  ▰▰▰▱▱ 62%   sonnet-4-5  guard:bwf  mcp:10
```

各項目が背景色のブロックになり、境界は Nerd Font の `` で繋がる。

## 表示項目

左側は「今どこで作業しているか」、右側は「セッションの状態」。

| 項目 | 例 | 内容 |
|---|---|---|
| cwd |  `~/.dotfiles` | 作業ディレクトリ。一番明るい背景 + accent + bold で強調 |
| gitBranch |  `pi/main` | 現在のブランチ。切り替えを検知して自動更新 |
| gitDirty |  `3` | 未コミットの変更数。0件なら非表示 |
| workTime |  `2h14m / 1h48m` | 総経過 / アイドルを除いた実作業時間 |
| tokens | `↑45.2k ↓12.1k` | セッション累計の入力/出力トークン |
| context | `▰▰▰▱▱ 62%` | コンテキスト使用率。5マスのゲージ付き |
| model |  `sonnet-4-5` | provider 接頭辞と日付サフィックスを落とした名前 |
| guard | `guard:bwf` | strict-guard の有効項目 |
| mcp | `mcp:10` | MCP で登録できたツール数 |

`guard` の記号は `b`=bash `w`=write `e`=edit `f`=web_fetch。大文字が `always`、小文字が `risky`、`off` は出ない。

他の拡張が `ctx.ui.setStatus()` で出した内容も右端にブロックとして並ぶ。

## 色の設計

背景色はテーマの `bg` から取るので、テーマを変えれば追従する。

隣接ブロックの背景が同じだと境目が消えるため、`userMessageBg`（やや明るい）と `toolPendingBg`（暗い）を交互に割り当てている。それでも同色が隣接した場合は細線 `│` で区切る。

状態を持つブロックだけは専用の背景色を使い、交互配色から除外する。

| 状態 | 背景 | 前景 |
|---|---|---|
| コンテキスト 65%未満 | `toolSuccessBg`（緑寄り） | `success` |
| コンテキスト 65〜84% | `toolPendingBg` | `warning` |
| コンテキスト 85%以上 | `toolErrorBg`（赤寄り） | `error` + bold |
| MCP に接続失敗あり | `toolErrorBg` | `error` |
| cwd | `selectedBg`（最も明るい） | `accent` + bold |

平常時は落ち着いた濃淡で、コンテキストが切迫したときだけブロックごと赤くなる。

## 繋ぎ目の仕組み

powerline のセパレータは「前景色に手前のブロックの背景色、背景色に次のブロックの背景色」を指定すると滑らかに繋がる。

```
┌ bg=A ┐┌ bg=B ┐
│ text ││ text │
└──────┘└──────┘
       ↑ この文字は fg=A, bg=B
```

`getBgAnsi()` が返す `48;5;N` を `38;5;N` に読み替えて前景色として使っている。truecolor テーマ（`48;2;R;G;B`）でも同じ置換で動く。

## Nerd Font がない場合

`/footer` で `Nerd Font のアイコン` を off にすると、セパレータが半角ブロック `▌` `▐` に、アイコンは省略される。半ブロックにも同じ配色ルールが効くのでブロック境界は保たれ、表示幅も変わらない。

## 幅が足りないとき

優先度の低いブロックから自動で落ちる。

```
w=100   ~/.dotfiles   pi/main  3    2h14m / 6m  ↑45.2k ↓12.1k  ▰▰▰▱▱ 62%   sonnet-4-5
w=80    ~/.dotfiles   pi/main  3    2h14m / 6m  ↑45.2k ↓12.1k  ▰▰▰▱▱ 62%
w=60    ~/.dotfiles   pi/main  3    2h14m / 6m
```

右側の末尾（mcp, guard）から先に落とし、それでも入らなければ左側の末尾を削る。cwd は最後まで残る。どの幅でも1行にぴったり収まる。

## 作業時間の計り方

`2h14m / 1h48m` の左が総経過時間、右がアイドルを除いた実作業時間。

総経過はセッション最初のエントリから現在まで。実作業はエントリ間の間隔が15分を超えた区間を離席とみなして差し引く。最後のエントリから現在までが15分以上開いていれば、それも引く。

一度も離席していなければ1つだけ表示する。

長時間かかった1回のツール実行は、エントリのタイムスタンプ差ではなく実行そのものなので離席扱いにならない。

## 設定

```bash
> /footer          # トグルUIを開く
> /footer off      # pi 既定のフッターに戻す
> /footer on       # カスタムフッターに戻す
```

設定は `~/.pi/agent/footer.json` に保存される。

```json
{
  "enabled": true,
  "nerdFont": true,
  "cwd": true,
  "gitBranch": true,
  "gitDirty": true,
  "workTime": true,
  "tokens": true,
  "context": true,
  "model": true,
  "guard": true,
  "mcp": true
}
```

## 構成

```
footer/
├── index.ts             # setFooter とレイアウト、/footer コマンド
├── powerline.ts         # セルの連結と繋ぎ目の配色
├── segments.ts          # 各ブロックの内容と色の決定
├── git-status.ts        # git status の非同期取得とキャッシュ
├── work-time.ts         # 作業時間の計算
├── powerline.test.mjs   # 描画とフォーマットのテスト
└── config.ts            # 設定の読み書き
```

テストの実行:

```bash
node --experimental-strip-types --test work-time.test.mjs powerline.test.mjs
```

## 実装メモ

フッターの `render` は同期なので、`git status` の結果は `GitDirtyWatcher` が3秒間隔で先に取ってキャッシュしておく。変更があったときだけ `tui.requestRender()` を呼ぶ。タイマーは `unref()` してあるのでプロセス終了を妨げない。

ブランチ名は pi 側の `footerData.getGitBranch()` を使う。pi が `.git/HEAD` を監視しているので切り替えが即反映される。

コンテキスト使用率は `ctx.getContextUsage().percent` を使う。コンパクション直後は `null` になるので、その間はブロックを出さない。

## 制限

- TUI モードのみ。print/json モードでは何もしない
- `git status` を3秒ごとに実行するので、巨大なリポジトリでは負荷になる。気になるなら `gitDirty` を off にする
- `guard` と `mcp` の表示は strict-guard / mcp-client 拡張が `setStatus` を出していることが前提。片方だけ入れている場合はその項目が出ないだけ
- 背景色はテーマの `bg` 6色しかないので、ブロック数が多いと濃淡の繰り返しになる
- 作業時間は再描画のタイミングで更新される。無操作の間は分表示が止まって見え、次の入力やツール実行で追いつく
