# mcp-client

MCP サーバに接続して、公開されている tools を pi のツールとして登録する拡張。

## 設定

`~/.pi/agent/mcp-servers.json` にサーバを書く。

```json
{
  "local": {
    "url": "http://127.0.0.1:10205/sse"
  }
}
```

複数書けば全部に接続する。

| キー | 型 | 内容 |
|---|---|---|
| `url` | string | サーバの URL。必須 |
| `enabled` | boolean | `false` で読み飛ばす。既定 `true` |
| `headers` | object | 追加のリクエストヘッダ。認証トークンなど |
| `prefix` | string | ツール名の接頭辞。名前衝突を避けたいとき |
| `only` | string[] | 登録するツール名を絞る。未指定なら全部 |

`only` と `prefix` の例:

```json
{
  "local": {
    "url": "http://127.0.0.1:10205/sse",
    "only": ["web_search", "get_weather"],
    "prefix": "local_"
  }
}
```

## 接続方式

Streamable HTTP を先に試し、失敗したら SSE にフォールバックする。サーバがどちらの方式かを気にせず書ける。

## コマンド

```bash
> /mcp           # 接続状態とツール一覧
> /mcp reload     # 接続状態をリセット（再接続は次のセッション開始時）
```

`/mcp` は接続しているサーバ、登録できたツール、登録をスキップしたツールとその理由を一覧する。

設定を書き換えたときは `/mcp reload` のあと `/reload` するのが確実。

## フッター連携

`ctx.ui.setStatus("mcp", ...)` で登録できたツール数を出す。footer 拡張が入っていれば `mcp:10` として表示される。接続に失敗したサーバがあれば `mcp:10!1` になり、赤く表示される。

## 構成

```
mcp-client/
├── index.ts       # session_start での接続、registerTool、/mcp コマンド
├── client.ts      # StreamableHTTP → SSE フォールバック
├── config.ts      # mcp-servers.json の読み込み
└── package.json   # @modelcontextprotocol/sdk
```

依存は install.sh が `npm install` で入れる。`node_modules` はコミットしない。

## 挙動

接続は `session_start` で行う。起動時にサーバが落ちていても pi は普通に立ち上がり、警告を通知するだけで止まらない。

MCP のツールスキーマがそのまま pi のツール定義に変換できない場合、そのツールだけ登録をスキップして `/mcp` に理由を残す。他のツールの登録は続行する。

## 制限

- ツールの登録は接続時に一度だけ。サーバ側でツールが増えてもセッション中は反映されない
- MCP の prompts / resources には対応していない。tools のみ
- 画像を返すツールの結果は現在テキスト表現（`[image image/png: N bytes base64]`）になる
