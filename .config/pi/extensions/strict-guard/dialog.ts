/**
 * 確認ダイアログ。枠付きでコマンド全文とリスク内容を見せる。
 *
 * TUI では DynamicBorder + SelectList のカスタムコンポーネント、
 * それ以外(RPC など)では ctx.ui.select にフォールバックする。
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey } from "@earendil-works/pi-tui";
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

/**
 * 選択肢の文面。
 *
 * SelectList は description をラベル列の幅に揃えて右に離して置くので、
 * 一番長いラベルに引きずられて視線が飛ぶ。説明をラベルの直後に
 * 寄せたいので、リストは自前で描く。
 *
 * SelectList の label に ANSI を混べる方法も試したが、内部の
 * truncateToWidth が幅超過時に色を途切ってリセット列を露出させる。
 */
const CHOICE_TEXT: Record<GuardChoice, { label: string; note: string }> = {
	allow: { label: "許可", note: "今回だけ" },
	allowSession: { label: "このセッションでは常に許可", note: "次から確認しない" },
	deny: { label: "拒否", note: "実行せず理由を返す" },
};

/** 幅計算用。色を付けない素の文字列 */
function plainItemText(c: GuardChoice): string {
	const { label, note } = CHOICE_TEXT[c];
	return `  ${label}  ${note}`;
}

export async function askGuard(ctx: ExtensionContext, prompt: GuardPrompt): Promise<GuardChoice> {
	const choices: GuardChoice[] = prompt.allowSession
		? ["allow", "allowSession", "deny"]
		: ["allow", "deny"];

	if (ctx.mode !== "tui") {
		return askViaSelect(ctx, prompt, choices);
	}

	const subjectLines = prompt.subject.split("\n");

	// 箱の幅と枠の幅を一致させるため、開く前に内側幅を確定する
	const inner = measureInnerWidth(
		[
			prompt.title,
			...subjectLines,
			...choices.map(plainItemText),
			...(prompt.risks.length > 0 ? [`検出: ${prompt.risks.join(", ")}`] : []),
		],
		{ min: 40, max: 76, title: prompt.title, hint: HINT },
	);

	const result = await ctx.ui.custom<GuardChoice | null>(
		(tui, theme, _kb, done) => {
			const accent: FrameColor = prompt.danger ? "error" : "accent";
			let cursor = 0;
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
				choices.forEach((choice, i) => {
					const { label, note } = CHOICE_TEXT[choice];
					const selected = i === cursor;
					const marker = selected ? theme.fg(accent, "❯ ") : "  ";
					const shown = selected ? theme.fg(accent, label) : label;
					// 説明はラベルの直後に置く。幅が足りなければ折り返して字下げされる
					body.push(
						...wrapWithPrefix(marker, `${shown}  ${theme.fg("muted", note)}`, inner),
					);
				});

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
				},
				handleInput: (data: string) => {
					if (matchesKey(data, Key.up) || data === "k") {
						cursor = (cursor - 1 + choices.length) % choices.length;
					} else if (matchesKey(data, Key.down) || data === "j") {
						cursor = (cursor + 1) % choices.length;
					} else if (matchesKey(data, Key.enter)) {
						done(choices[cursor] ?? "deny");
						return;
					} else if (matchesKey(data, Key.escape)) {
						done("deny");
						return;
					} else {
						// 数字キーで直接選ぶ
						const n = Number.parseInt(data, 10);
						if (Number.isInteger(n) && n >= 1 && n <= choices.length) {
							done(choices[n - 1] ?? "deny");
							return;
						}
						return;
					}
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
	const labels = choices.map((c) => CHOICE_TEXT[c].label);
	const picked = await ctx.ui.select(`${prompt.title}\n\n${body}\n\n実行する?`, labels);
	const found = choices.find((c) => CHOICE_TEXT[c].label === picked);
	return found ?? "deny";
}
