/**
 * ask_multi ツール: 複数選択。
 *
 * スペースでトグル、a で全選択/全解除、Enter で確定。
 * 何も選ばずに Enter しても空選択として確定できる。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, Text, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { OptionSchema } from "./schema.ts";

export interface AskMultiDetails {
	question: string;
	options: string[];
	selected: string[] | null;
}

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

				function render(width: number): string[] {
					if (cache) return cache;
					const w = Math.max(1, width);
					const lines: string[] = [];

					const addWithPrefix = (prefix: string, text: string) => {
						const pw = visibleWidth(prefix);
						if (pw >= w) {
							lines.push(...wrapTextWithAnsi(prefix + text, w));
							return;
						}
						const wrapped = wrapTextWithAnsi(text, w - pw);
						const cont = " ".repeat(pw);
						wrapped.forEach((line, i) => lines.push(`${i === 0 ? prefix : cont}${line}`));
					};

					lines.push(theme.fg("accent", "─".repeat(w)));
					addWithPrefix(" ", theme.fg("text", theme.bold(params.question)));
					lines.push("");

					params.options.forEach((opt, i) => {
						const selected = i === cursor;
						const marker = selected ? theme.fg("accent", "> ") : "  ";
						const box = checked.has(i) ? theme.fg("success", "[x] ") : theme.fg("dim", "[ ] ");
						addWithPrefix(marker + box, theme.fg(selected ? "accent" : "text", opt.label));
						if (opt.description) {
							addWithPrefix("       ", theme.fg("muted", opt.description));
						}
					});

					lines.push("");
					addWithPrefix(
						" ",
						theme.fg("dim", `↑↓ 移動 • space 選択 • a 全切替 • enter 確定 (${checked.size}件) • esc 中止`),
					);
					lines.push(theme.fg("accent", "─".repeat(w)));

					cache = lines;
					return lines;
				}

				return { render, invalidate: () => { cache = undefined; }, handleInput };
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
