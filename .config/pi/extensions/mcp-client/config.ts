/**
 * MCP サーバ接続の設定。
 *
 * ~/.pi/agent/mcp-servers.json に置く。形は Claude Desktop 風だが
 * ここでは Streamable HTTP / SSE の URL 接続だけを扱う。
 *
 * {
 *   "servers": {
 *     "local": { "url": "http://127.0.0.1:10205/sse", "enabled": true }
 *   }
 * }
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface McpServerConfig {
	/** Streamable HTTP / SSE のエンドポイント */
	url: string;
	/** false なら接続しない */
	enabled: boolean;
	/** 追加ヘッダ(認証トークンなど)。値は設定ファイル側で管理する */
	headers?: Record<string, string>;
	/** ツール名の接頭辞。省略時はサーバ名を使わず素の名前で登録する */
	prefix?: string;
	/** 登録するツールを絞る。空/未指定なら全部 */
	only?: string[];
}

export interface McpConfig {
	servers: Record<string, McpServerConfig>;
}

export const CONFIG_PATH = join(homedir(), ".pi", "agent", "mcp-servers.json");

export const DEFAULT_CONFIG: McpConfig = {
	servers: {
		local: { url: "http://127.0.0.1:10205/sse", enabled: true },
	},
};

export function loadConfig(): McpConfig {
	try {
		const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<McpConfig>;
		const servers: Record<string, McpServerConfig> = {};
		for (const [name, raw] of Object.entries(parsed.servers ?? {})) {
			if (!raw || typeof raw.url !== "string") continue;
			servers[name] = {
				url: raw.url,
				enabled: raw.enabled !== false,
				headers: isStringRecord(raw.headers) ? raw.headers : undefined,
				prefix: typeof raw.prefix === "string" ? raw.prefix : undefined,
				only: Array.isArray(raw.only) ? raw.only.filter((t): t is string => typeof t === "string") : undefined,
			};
		}
		return { servers };
	} catch {
		return structuredClone(DEFAULT_CONFIG);
	}
}

export function saveConfig(config: McpConfig): void {
	mkdirSync(dirname(CONFIG_PATH), { recursive: true });
	writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function isStringRecord(value: unknown): value is Record<string, string> {
	return (
		typeof value === "object" &&
		value !== null &&
		Object.values(value).every((v) => typeof v === "string")
	);
}
