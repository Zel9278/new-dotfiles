/**
 * ask_multi ツール: 複数選択。
 *
 * スペースでトグル、a で全選択/全解除、Enter で確定。
 * 何も選ばずに Enter しても空選択として確定できる。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, Text } from "@earendil-works/pi-tui";
import { frame, frameWidth, measureInnerWidth, wrapWithPrefix } from "../shared/dialog-frame.ts";
import { Type } from "typebox";
import { OptionSchema } from "./schema.ts";

export interface AskMultiDetails {
	question: string;
	options: string[];
	selected: string[] | null;
}

/** 下枠に出すキー操作の説明。幅計算と描画で同じ文字列を使う */
const HINT = "space 選択 • a 全切替 • enter 確定 • esc 中止";

const AskMultiParams = Type.Object({
	question: Type.String({ description: "The question to ask the user" }),
	options: Type.Array(OptionSchema, { description: "Options the user can toggle" }),
});

export function registerAskMulti(pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask_multi",
		label: "Ask (multi)",
		description:
			"Ask the user to pick any number of options via an interactive dialog. Use when several choices can apply at once, for example picking which files to change or which features to include.",
		promptSnippet: "Ask the user to select multiple options in a dialog",
		parameters: AskMultiParams,
		executionMode: "sequential",

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const labels = params.options.map((o) => o.label);

			if (params.options.length === 0) {
				throw new Error("ask_multi requires at least one option");
			}
			if (ctx.mode !== "tui") {
				return {
					content: [{ type: "text", text: "UI not available; ask_multi was skipped." }],
					details: { question: params.question, options: labels, selected: null } as AskMultiDetails,
				};
			}

			// 幅は開いている間固定する。タイトルの件数表示は桁数が変わるので、
			// いちばん長くなる (n/n) の形で測っておく。
			const total = params.options.length;
			const inner = measureInnerWidth(
				[
					params.question,
					...params.options.map((o) => `  ◉ ${o.label}`),
					...params.options.map((o) => (o.description ? `      ${o.description}` : "")),
				],
				{ min: 34, max: 72, title: `複数選択 (${total}/${total})`, hint: HINT },
			);

			const result = await ctx.ui.custom<string[] | null>((tui, theme, _kb, done) => {
				let cursor = 0;
				const checked = new Set<number>();
				let cache: string[] | undefined;

				const refresh = () => {
					cache = undefined;
					tui.requestRender();
				};

				function handleInput(data: string) {
					if (matchesKey(data, Key.up)) {
						cursor = Math.max(0, cursor - 1);
						refresh();
						return;
					}
					if (matchesKey(data, Key.down)) {
						cursor = Math.min(params.options.length - 1, cursor + 1);
						refresh();
						return;
					}
					if (data === " ") {
						if (checked.has(cursor)) checked.delete(cursor);
						else checked.add(cursor);
						refresh();
						return;
					}
					if (data === "a") {
						if (checked.size === params.options.length) checked.clear();
						else params.options.forEach((_, i) => checked.add(i));
						refresh();
						return;
					}
					if (matchesKey(data, Key.enter)) {
						done([...checked].sort((a, b) => a - b).map((i) => params.options[i].label));
						return;
					}
					if (matchesKey(data, Key.escape)) {
						done(null);
					}
				}

				function render(_width: number): string[] {
					if (cache) return cache;

					const body: string[] = [];
					body.push(...wrapWithPrefix("", theme.fg("text", theme.bold(params.question)), inner));
					body.push("");

					params.options.forEach((opt, i) => {
						const selected = i === cursor;
						const marker = selected ? theme.fg("accent", "❯ ") : "  ";
						const box = checked.has(i) ? theme.fg("success", "◉ ") : theme.fg("dim", "○ ");
						body.push(
							...wrapWithPrefix(marker + box, theme.fg(selected ? "accent" : "text", opt.label), inner),
						);
						if (opt.description) {
							body.push(...wrapWithPrefix("      ", theme.fg("muted", opt.description), inner));
						}
					});

					cache = frame(body, theme, {
						innerWidth: inner,
						color: "accent",
						title: `複数選択 (${checked.size}/${params.options.length})`,
						hint: HINT,
					});
					return cache;
				}

				return { render, invalidate: () => { cache = undefined; }, handleInput };
			}, {
				overlay: true,
				overlayOptions: { anchor: "center", width: frameWidth(inner), margin: 2 },
			});

			if (result === null) {
				return {
					content: [{ type: "text", text: "User cancelled without choosing." }],
					details: { question: params.question, options: labels, selected: null } as AskMultiDetails,
				};
			}
			return {
				content: [
					{
						type: "text",
						text:
							result.length === 0
								? "User selected nothing."
								: `User selected: ${result.map((r) => `- ${r}`).join("\n")}`,
					},
				],
				details: { question: params.question, options: labels, selected: result } as AskMultiDetails,
			};
		},

		renderCall(args, theme, _context) {
			let text =
				theme.fg("toolTitle", theme.bold("ask_multi ")) + theme.fg("muted", String(args.question ?? ""));
			const opts = Array.isArray(args.options) ? args.options : [];
			if (opts.length > 0) {
				text += `\n${theme.fg("dim", `  ${opts.map((o: { label: string }) => o.label).join(" / ")}`)}`;
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as AskMultiDetails | undefined;
			if (!details) {
				const first = result.content[0];
				return new Text(first?.type === "text" ? first.text : "", 0, 0);
			}
			if (details.selected === null) {
				return new Text(theme.fg("warning", "キャンセル"), 0, 0);
			}
			if (details.selected.length === 0) {
				return new Text(theme.fg("muted", "選択なし"), 0, 0);
			}
			return new Text(
				theme.fg("success", "✓ ") + theme.fg("accent", details.selected.join(", ")),
				0,
				0,
			);
		},
	});
}
