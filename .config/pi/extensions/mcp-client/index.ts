/**
 * MCP Client Extension
 *
 * ~/.pi/agent/mcp-servers.json に書いた MCP サーバへ繋ぎ、
 * 公開されている tools を pi のツールとして登録する。
 *
 * 接続は session_start 時に行い、/mcp コマンドで状態確認と再接続ができる。
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";
import { McpConnection, type McpTool } from "./client.ts";
import { loadConfig } from "./config.ts";

interface ConnectedServer {
	connection: McpConnection;
	tools: McpTool[];
	/** 登録に失敗したツール名 -> 理由 */
	skipped: Map<string, string>;
	error?: string;
}

export default function mcpClient(pi: ExtensionAPI) {
	const servers = new Map<string, ConnectedServer>();
	/** 既に registerTool 済みの名前。重複登録を避ける */
	const registered = new Set<string>();
	let connecting: Promise<void> | undefined;

	pi.on("session_start", async (_event, ctx) => {
		connecting ??= connectAll(ctx);
		await connecting;
	});

	pi.on("session_shutdown", async () => {
		for (const { connection } of servers.values()) await connection.close();
		servers.clear();
	});

	async function connectAll(ctx: ExtensionContext): Promise<void> {
		const config = loadConfig();
		const entries = Object.entries(config.servers).filter(([, s]) => s.enabled);

		await Promise.all(
			entries.map(async ([name, serverConfig]) => {
				const connection = new McpConnection(name, serverConfig);
				try {
					await connection.connect();
					const all = await connection.listTools();
					const only = serverConfig.only;
					const tools = only && only.length > 0 ? all.filter((t) => only.includes(t.name)) : all;
					servers.set(name, { connection, tools, skipped: new Map() });
					for (const tool of tools) registerMcpTool(name, serverConfig.prefix, connection, tool);
				} catch (err) {
					servers.set(name, { connection, tools: [], skipped: new Map(), error: describeError(err) });
					if (ctx.hasUI) {
						ctx.ui.notify(`MCP "${name}" 接続失敗: ${describeError(err)}`, "warning");
					}
				}
			}),
		);

		publishStatus(ctx);
	}

	/** フッターに登録できたツール数を出す */
	function publishStatus(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;

		let ok = 0;
		let failed = 0;
		for (const state of servers.values()) {
			if (state.error) failed += 1;
			else ok += state.tools.length - state.skipped.size;
		}

		if (ok === 0 && failed === 0) {
			ctx.ui.setStatus("mcp", undefined);
			return;
		}
		ctx.ui.setStatus("mcp", failed > 0 ? `mcp:${ok}!${failed}` : `mcp:${ok}`);
	}

	function registerMcpTool(
		serverName: string,
		prefix: string | undefined,
		connection: McpConnection,
		tool: McpTool,
	): void {
		const toolName = prefix ? `${prefix}${tool.name}` : tool.name;
		if (registered.has(toolName)) return;
		registered.add(toolName);

		try {
			registerOne(toolName);
		} catch (err) {
			registered.delete(toolName);
			const state = servers.get(serverName);
			if (state) state.skipped.set(tool.name, describeError(err));
			return;
		}

		function registerOne(name: string) {
			pi.registerTool({
				name,
				label: name,
				description: tool.description ?? `MCP tool ${tool.name} on ${serverName}`,
				// MCP の inputSchema は JSON Schema。pi は TypeBox を期待するが
				// 実体はどちらも JSON Schema なのでそのまま渡す。
				parameters: tool.inputSchema as unknown as TSchema,
				async execute(_toolCallId, params, signal) {
					const result = await connection.callTool(
						tool.name,
						(params ?? {}) as Record<string, unknown>,
						signal,
					);
					if (result.isError) {
						throw new Error(textOf(result.content) || `MCP tool ${tool.name} failed`);
					}
					return {
						content: normalizeContent(result.content),
						details: { server: serverName, tool: tool.name },
					};
				},
			});
		}
	}

	registerMcpCommand(pi, servers, () => {
		connecting = undefined;
	});
}

/** MCP の content ブロックを pi の content 形式に寄せる */
function normalizeContent(blocks: Array<{ type: string; text?: string; data?: string; mimeType?: string }>) {
	const out: Array<{ type: "text"; text: string }> = [];
	for (const block of blocks) {
		if (block.type === "text" && typeof block.text === "string") {
			out.push({ type: "text", text: block.text });
		} else if (block.type === "image") {
			out.push({ type: "text", text: `[image ${block.mimeType ?? "unknown"}: ${block.data?.length ?? 0} bytes base64]` });
		} else {
			out.push({ type: "text", text: `[${block.type}]` });
		}
	}
	if (out.length === 0) out.push({ type: "text", text: "(empty result)" });
	return out;
}

function textOf(blocks: Array<{ type: string; text?: string }>): string {
	return blocks
		.filter((b) => b.type === "text" && typeof b.text === "string")
		.map((b) => b.text)
		.join("\n");
}

function describeError(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** /mcp コマンド。接続状態とツール一覧を見る。 */
function registerMcpCommand(
	pi: ExtensionAPI,
	servers: Map<string, ConnectedServer>,
	resetConnecting: () => void,
) {
	pi.registerCommand("mcp", {
		description: "MCP サーバの接続状態とツール一覧を表示",
		handler: async (args, ctx) => {
			if (args.trim() === "reload") {
				resetConnecting();
				ctx.ui.notify("MCP: 次のセッション開始で再接続する (/reload 推奨)", "info");
				return;
			}

			if (servers.size === 0) {
				ctx.ui.notify("MCP: 接続されているサーバはない", "info");
				return;
			}

			const lines: string[] = [];
			for (const [name, state] of servers) {
				if (state.error) {
					lines.push(`${name}: ✗ ${state.error}`);
					continue;
				}
				lines.push(`${name}: ✓ ${state.tools.length - state.skipped.size} tools`);
				for (const tool of state.tools) {
					const reason = state.skipped.get(tool.name);
					lines.push(reason ? `  - ${tool.name} ✗ ${reason}` : `  - ${tool.name}`);
				}
			}
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
