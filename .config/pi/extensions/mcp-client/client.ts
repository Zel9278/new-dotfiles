/**
 * MCP サーバへの接続と tools/list, tools/call の薄いラッパ。
 *
 * Streamable HTTP を先に試し、失敗したら旧 SSE トランスポートに落とす。
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpServerConfig } from "./config.ts";

export interface McpTool {
	name: string;
	description?: string;
	inputSchema: Record<string, unknown>;
}

export interface McpContentBlock {
	type: string;
	text?: string;
	data?: string;
	mimeType?: string;
}

export interface McpCallResult {
	content: McpContentBlock[];
	isError: boolean;
}

export class McpConnection {
	private client: Client | undefined;

	constructor(
		readonly serverName: string,
		private readonly config: McpServerConfig,
	) {}

	async connect(): Promise<void> {
		const url = new URL(this.config.url);
		const requestInit = this.config.headers ? { headers: this.config.headers } : undefined;

		const client = new Client({ name: "pi-mcp-client", version: "0.1.0" });
		try {
			await client.connect(new StreamableHTTPClientTransport(url, { requestInit }));
		} catch {
			// 旧仕様のサーバ向けフォールバック
			await client.connect(new SSEClientTransport(url, { requestInit }));
		}
		this.client = client;
	}

	async listTools(): Promise<McpTool[]> {
		const client = this.requireClient();
		const { tools } = await client.listTools();
		return tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: (tool.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown>,
		}));
	}

	async callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<McpCallResult> {
		const client = this.requireClient();
		const result = await client.callTool({ name, arguments: args }, undefined, { signal });
		const content = Array.isArray(result.content) ? (result.content as McpContentBlock[]) : [];
		return { content, isError: result.isError === true };
	}

	async close(): Promise<void> {
		await this.client?.close().catch(() => {});
		this.client = undefined;
	}

	private requireClient(): Client {
		if (!this.client) throw new Error(`MCP server "${this.serverName}" is not connected`);
		return this.client;
	}
}
