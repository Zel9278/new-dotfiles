/**
 * 確認ダイアログ。枠付きでコマンド全文とリスク内容を見せる。
 *
 * TUI では DynamicBorder + SelectList のカスタムコンポーネント、
 * それ以外(RPC など)では ctx.ui.select にフォールバックする。
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";

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

	const result = await ctx.ui.custom<GuardChoice | null>((tui, theme, _kb, done) => {
		const container = new Container();
		const accent = prompt.danger ? "error" : "accent";
		const frame = (s: string) => theme.fg(accent, s);

		container.addChild(new DynamicBorder(frame));
		container.addChild(new Text(theme.fg(accent, theme.bold(prompt.title)), 1, 1));

		const subjectLines = prompt.subject.split("\n");
		subjectLines.forEach((line, i) => {
			// 最後の行だけ下に隔を入れる
			const padY = i === subjectLines.length - 1 && prompt.risks.length === 0 ? 1 : 0;
			container.addChild(new Text(theme.fg("muted", line), 1, padY));
		});

		if (prompt.risks.length > 0) {
			container.addChild(new Text(theme.fg("warning", `検出: ${prompt.risks.join(", ")}`), 1, 1));
		}

		const items = choices.map((c) => CHOICE_ITEMS[c]);
		const list = new SelectList(items, items.length, {
			selectedPrefix: (t) => theme.fg(accent, t),
			selectedText: (t) => theme.fg(accent, t),
			description: (t) => theme.fg("muted", t),
			scrollInfo: (t) => theme.fg("dim", t),
			noMatch: (t) => theme.fg("warning", t),
		});
		list.onSelect = (item) => done(item.value as GuardChoice);
		list.onCancel = () => done("deny");
		container.addChild(list);

		container.addChild(new Text(theme.fg("dim", "↑↓ 選択 • enter 決定 • esc 拒否"), 1, 1));
		container.addChild(new DynamicBorder(frame));

		return {
			render: (width: number) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				list.handleInput(data);
				tui.requestRender();
			},
		};
	});

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
