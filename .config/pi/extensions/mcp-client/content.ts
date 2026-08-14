/**
 * MCP の content ブロックを pi の content 形式へ変換する。
 *
 * pi のツール結果は (TextContent | ImageContent)[] を受けるので、
 * MCP の image ブロックはそのまま画像として渡せる。
 * モデルが扱えない形式だけテキストの説明に落とす。
 */

/** モデルに渡せる画像の MIME タイプ */
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

interface McpContentBlock {
	type: string;
	text?: string;
	data?: string;
	mimeType?: string;
	/** resource ブロックの中身 */
	resource?: { text?: string; blob?: string; mimeType?: string; uri?: string };
}

type PiContentBlock =
	| { type: "text"; text: string }
	| { type: "image"; data: string; mimeType: string };

/**
 * MCP の content ブロックを pi の content 形式に寄せる。
 *
 * image は pi の ImageContent と同じ形（base64 の data + mimeType）なので
 * そのまま渡す。モデルが扱えない形式はテキストに落とす。
 */
export function normalizeContent(blocks: McpContentBlock[]): PiContentBlock[] {
	const out: PiContentBlock[] = [];

	for (const block of blocks) {
		switch (block.type) {
			case "text":
				if (typeof block.text === "string") out.push({ type: "text", text: block.text });
				break;

			case "image":
				out.push(imageBlock(block.data, block.mimeType));
				break;

			case "resource": {
				// 埋め込みリソース。テキストか画像なら中身を取り出す
				const resource = block.resource;
				if (typeof resource?.text === "string") {
					out.push({ type: "text", text: resource.text });
				} else if (resource?.blob && isSupportedImage(resource.mimeType)) {
					out.push(imageBlock(resource.blob, resource.mimeType));
				} else {
					out.push({ type: "text", text: `[resource ${resource?.uri ?? resource?.mimeType ?? "unknown"}]` });
				}
				break;
			}

			default:
				out.push({ type: "text", text: `[${block.type}]` });
		}
	}

	if (out.length === 0) out.push({ type: "text", text: "(empty result)" });
	return out;
}

/**
 * 画像ブロックを作る。data が欠けているか未対応の形式なら
 * フォールバックしてテキストで知らせる。
 */
function imageBlock(data: string | undefined, mimeType: string | undefined): PiContentBlock {
	if (!data) return { type: "text", text: "[image: データなし]" };
	if (!isSupportedImage(mimeType)) {
		return { type: "text", text: `[image ${mimeType ?? "unknown"}: 未対応の形式 (${estimateBytes(data)})]` };
	}
	return { type: "image", data, mimeType: mimeType as string };
}

function isSupportedImage(mimeType: string | undefined): boolean {
	return mimeType !== undefined && SUPPORTED_IMAGE_TYPES.has(mimeType.toLowerCase());
}

/** base64 文字数から元のバイト数を見積もる */
export function estimateBytes(base64: string): string {
	const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
	const bytes = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
