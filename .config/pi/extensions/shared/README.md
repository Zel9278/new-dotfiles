# shared

複数の pi 拡張から使う共通ヘルパ。拡張そのものではないので `index.ts` は持たない。

## dialog-frame.ts

オーバーレイのダイアログ枠を描く。

```
╭─ 選択 ──────────────────────────────────╮
│ どっちの方式で実装する?                 │
│                                         │
│ ❯ 1. 正規表現で判定                     │
│      依存なし。実装は軽いが誤検知が出る │
│   2. シェルをパースして判定             │
╰─────── ↑↓ 選択 • enter 決定 • esc 中止 ─╯
```

タイトルを上枠、キー操作のヒントを下枠に埋め込む。

### なぜ必要か

`ctx.ui.custom(..., { overlay: true })` はコンポーネントをターミナル中央のフローティングウィンドウとして合成する。このとき2つ落とし穴がある。

**1. 全行が同じ表示幅でないと枠が崩れる**

`compositeTuiLine` は行ごとに合成するので、短い行があるとその行だけ枠の右端が欠ける。`frame()` は内容を必ず内側幅までパディングしてから罫線を付ける。

**2. `overlayOptions.width` を指定しないと箱が80桁になる**

pi-tui の `resolveOverlayLayout` は `width` 未指定時に `Math.min(80, availWidth)` を使う。枠が43桁でも箱は80桁確保され、差分の37桁が背景の余白として右側に残る。

これを避けるため、枠の内側幅を `ui.custom` を呼ぶ前に確定し、`frameWidth(inner)` を `width` として渡す。

```typescript
const inner = measureInnerWidth([...texts], { min: 34, max: 72, title, hint });

await ctx.ui.custom(
  (tui, theme, _kb, done) => ({
    render: () => frame(body, theme, { innerWidth: inner, color: "accent", title, hint }),
    // ...
  }),
  { overlay: true, overlayOptions: { anchor: "center", width: frameWidth(inner), margin: 2 } },
);
```

内側幅を render の中で計算すると、内容が変わったときに箱の幅とずれる。開いている間は固定するのが前提。

### API

| 関数 | 用途 |
|---|---|
| `frame(lines, theme, options)` | 行を枠で囲む。各行は内側幅に収まっている前提 |
| `frameComponent(lines, theme, options)` | 既存コンポーネントの出力を枠に入れる。長すぎる行は切り詰める |
| `frameWidth(inner)` | 内側幅から `overlayOptions.width` に渡す値を求める |
| `measureInnerWidth(texts, opts)` | 内容とタイトル・ヒントから内側幅を決める |
| `wrapWithPrefix(prefix, text, target)` | マーカー付きで折り返す。2行目以降を字下げ |
| `padTo(text, target)` | 表示幅を揃える |
| `width(text)` | ANSI を除いた表示幅。全角は2桁 |

`measureInnerWidth` にタイトルとヒントを渡すのを忘れると、枠に入りきらず罫線だけにフォールバックしてヒントが消える。

`frameComponent` の `dropTrailingHint: true` は末尾の空行と `Enter/Space to change · Esc to cancel` を落とす。`SettingsList` が自前で付けるヒントが、下枠の日本語ヒントと重複するため。

### 幅の数え方

`pi-tui` の `visibleWidth` を import せず自前で数えている。このファイルを拡張ホストなしでテストできるようにするため。東アジアの幅広文字と主要な絵文字範囲を2桁として扱う。Nerd Font のアイコンは端末上1桁なので1桁。

主要な記号について `pi-tui` の `visibleWidth` と一致することは確認済み。

### テスト

```bash
node --experimental-strip-types --test dialog-frame.test.mjs
```

枠の全行が同じ幅になること、`frameWidth` が実際の枠幅と一致すること、タイトルやヒントが長すぎる場合のフォールバックを検証している。

## 配置

`install.sh` が `~/.pi/agent/extensions/shared` として symlink する。`../shared/...` の相対 import は symlink を解決した先ではなく `~/.pi/agent/extensions` 配下で解決されるため、この symlink がないと各拡張のロードが失敗する。

`pi_extensions` の配列には入れていない。pi はその配列に挙げたディレクトリだけを読み込み、`shared` にはエントリポイントとなる `index.ts` がないので拡張としては扱われない。
