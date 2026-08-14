/**
 * 確認ダイアログ。枠付きでコマンド全文とリスク内容を見せる。
 *
 * TUI では DynamicBorder + SelectList のカスタムコンポーネント、
 * それ以外(RPC など)では ctx.ui.select にフォールバックする。
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type SelectItem, SelectList } from "@earendil-works/pi-tui";
import {
	type FrameColor,
	frame,
	frameWidth,
	measureInnerWidth,
	wrapWithPrefix,
} from "../shared/dialog-frame.ts";

export type GuardChoice = "allow" | "allowSession" | "deny";

export interface GuardPrompt {
	/** ダイアログ見出し */
	title: string;
	/** 危険と判定された場合の見出し強調 */
	danger: boolean;
	/** `$ cmd` や `write: path` などの本体 */
	subject: string;
	/** 検出したリスクのラベル。無ければ空 */
	risks: string[];
	/** 「このセッションでは常に許可」を出すか */
	allowSession: boolean;
}

/** 下枠に出すキー操作の説明。幅計算と描画で同じ文字列を使う */
const HINT = "↑↓ 選択 • enter 決定 • esc 拒否";

const CHOICE_ITEMS: Record<GuardChoice, SelectItem> = {
	allow: { value: "allow", label: "許可", description: "今回だけ実行する" },
	allowSession: {
		value: "allowSession",
		label: "このセッションでは常に許可",
		description: "同じ内容は次から確認しない",
	},
	deny: { value: "deny", label: "拒否", description: "実行せずモデルに理由を返す" },
};

export async function askGuard(ctx: ExtensionContext, prompt: GuardPrompt): Promise<GuardChoice> {
	const choices: GuardChoice[] = prompt.allowSession
		? ["allow", "allowSession", "deny"]
		: ["allow", "deny"];

	if (ctx.mode !== "tui") {
		return askViaSelect(ctx, prompt, choices);
	}

	const subjectLines = prompt.subject.split("\n");
	const choiceItems = choices.map((c) => CHOICE_ITEMS[c]);

	// 箱の幅と枠の幅を一致させるため、開く前に内側幅を確定する
	const inner = measureInnerWidth(
		[
			prompt.title,
			...subjectLines,
			...choiceItems.map((i) => `  ${i.label}  ${i.description ?? ""}`),
			...(prompt.risks.length > 0 ? [`検出: ${prompt.risks.join(", ")}`] : []),
		],
		{ min: 40, max: 76, title: prompt.title, hint: HINT },
	);

	const result = await ctx.ui.custom<GuardChoice | null>(
		(tui, theme, _kb, done) => {
			const accent: FrameColor = prompt.danger ? "error" : "accent";
			const items = choiceItems;

			const list = new SelectList(items, items.length, {
				selectedPrefix: (t) => theme.fg(accent, t),
				selectedText: (t) => theme.fg(accent, t),
				description: (t) => theme.fg("muted", t),
				scrollInfo: (t) => theme.fg("dim", t),
				noMatch: (t) => theme.fg("warning", t),
			});
			list.onSelect = (item) => done(item.value as GuardChoice);
			list.onCancel = () => done("deny");

			let cache: string[] | undefined;

			/** オーバーレイなので内容から幅を決め、全行を枠の内側幅に揃える */
			function render(_width: number): string[] {
				if (cache) return cache;

				const body: string[] = [];
				for (const line of subjectLines) {
					body.push(...wrapWithPrefix("", theme.fg("muted", line), inner));
				}
				if (prompt.risks.length > 0) {
					body.push("");
					body.push(
						...wrapWithPrefix(
							"",
							theme.fg("warning", `検出: ${prompt.risks.join(", ")}`),
							inner,
						),
					);
				}
				body.push("");
				// SelectList は自前で幅を使うので内側幅を渡す
				body.push(...list.render(inner));

				cache = frame(body, theme, {
					innerWidth: inner,
					color: accent,
					title: prompt.title,
					hint: HINT,
				});
				return cache;
			}

			return {
				render,
				invalidate: () => {
					cache = undefined;
					list.invalidate();
				},
				handleInput: (data: string) => {
					list.handleInput(data);
					cache = undefined;
					tui.requestRender();
				},
			};
		},
		// 確認は必ず目に入ってほしいので中央に出す。
		// width を枠に合わせないと箱が既定の80桁になり右側に余白が残る。
		{
			overlay: true,
			overlayOptions: { anchor: "center", width: frameWidth(inner), margin: 2 },
		},
	);

	return result ?? "deny";
}

/** TUI 以外向け。ラベル文字列で選ばせる */
async function askViaSelect(
	ctx: ExtensionContext,
	prompt: GuardPrompt,
	choices: GuardChoice[],
): Promise<GuardChoice> {
	const body = [prompt.subject, prompt.risks.length > 0 ? `検出: ${prompt.risks.join(", ")}` : ""]
		.filter(Boolean)
		.join("\n\n");
	const labels = choices.map((c) => CHOICE_ITEMS[c].label);
	const picked = await ctx.ui.select(`${prompt.title}\n\n${body}\n\n実行する?`, labels);
	const found = choices.find((c) => CHOICE_ITEMS[c].label === picked);
	return found ?? "deny";
}
