/**
 * ask ツール: 単一選択 + 自由入力。
 *
 * 選択肢を上下で選び、Enter で決定。最後の「自分で書く」を選ぶと
 * インラインエディタが開いて任意のテキストを返せる。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	Editor,
	type EditorTheme,
	Key,
	matchesKey,
	Text,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { OptionSchema } from "./schema.ts";

interface DisplayOption {
	label: string;
	description?: string;
	isFree?: boolean;
}

export interface AskDetails {
	question: string;
	options: string[];
	answer: string | null;
	wasCustom?: boolean;
}

const AskParams = Type.Object({
	question: Type.String({ description: "The question to ask the user" }),
	options: Type.Array(OptionSchema, {
		description: "Options to choose from. Keep labels short; put detail in description.",
	}),
});

export function registerAsk(pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask",
		label: "Ask",
		description:
			"Ask the user to pick one option via an interactive dialog. Use this instead of asking in prose when the user must choose between concrete alternatives before you can proceed. The user can also type a free-form answer.",
		promptSnippet: "Ask the user to choose one option in a dialog",
		promptGuidelines: [
			"Use ask when a decision is needed from the user and the alternatives are known, rather than listing choices in prose and waiting for a reply.",
		],
		parameters: AskParams,
		executionMode: "sequential",

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const labels = params.options.map((o) => o.label);

			if (params.options.length === 0) {
				throw new Error("ask requires at least one option");
			}
			if (ctx.mode !== "tui") {
				return {
					content: [{ type: "text", text: "UI not available; ask was skipped." }],
					details: { question: params.question, options: labels, answer: null } as AskDetails,
				};
			}

			const all: DisplayOption[] = [...params.options, { label: "自分で書く", isFree: true }];

			const result = await ctx.ui.custom<{ answer: string; wasCustom: boolean; index?: number } | null>(
				(tui, theme, _kb, done) => {
					let cursor = 0;
					let editing = false;
					let cache: string[] | undefined;

					const editorTheme: EditorTheme = {
						borderColor: (s) => theme.fg("accent", s),
						selectList: {
							selectedPrefix: (t) => theme.fg("accent", t),
							selectedText: (t) => theme.fg("accent", t),
							description: (t) => theme.fg("muted", t),
							scrollInfo: (t) => theme.fg("dim", t),
							noMatch: (t) => theme.fg("warning", t),
						},
					};
					const editor = new Editor(tui, editorTheme);

					const refresh = () => {
						cache = undefined;
						tui.requestRender();
					};

					editor.onSubmit = (value) => {
						const trimmed = value.trim();
						if (trimmed) {
							done({ answer: trimmed, wasCustom: true });
							return;
						}
						editing = false;
						editor.setText("");
						refresh();
					};

					function handleInput(data: string) {
						if (editing) {
							if (matchesKey(data, Key.escape)) {
								editing = false;
								editor.setText("");
								refresh();
								return;
							}
							editor.handleInput(data);
							refresh();
							return;
						}

						if (matchesKey(data, Key.up)) {
							cursor = Math.max(0, cursor - 1);
							refresh();
							return;
						}
						if (matchesKey(data, Key.down)) {
							cursor = Math.min(all.length - 1, cursor + 1);
							refresh();
							return;
						}
						if (matchesKey(data, Key.enter)) {
							const picked = all[cursor];
							if (picked.isFree) {
								editing = true;
								refresh();
								return;
							}
							done({ answer: picked.label, wasCustom: false, index: cursor + 1 });
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

						all.forEach((opt, i) => {
							const selected = i === cursor;
							const marker = selected ? theme.fg("accent", "> ") : "  ";
							const suffix = opt.isFree && editing ? " ✎" : "";
							const color = selected || (opt.isFree && editing) ? "accent" : "text";
							addWithPrefix(marker, theme.fg(color, `${i + 1}. ${opt.label}${suffix}`));
							if (opt.description) {
								addWithPrefix("     ", theme.fg("muted", opt.description));
							}
						});

						if (editing) {
							lines.push("");
							addWithPrefix(" ", theme.fg("muted", "自由入力:"));
							for (const line of editor.render(Math.max(1, w - 2))) lines.push(` ${line}`);
						}

						lines.push("");
						addWithPrefix(
							" ",
							theme.fg(
								"dim",
								editing ? "enter 送信 • esc 戻る" : "↑↓ 選択 • enter 決定 • esc キャンセル",
							),
						);
						lines.push(theme.fg("accent", "─".repeat(w)));

						cache = lines;
						return lines;
					}

					return { render, invalidate: () => { cache = undefined; }, handleInput };
				},
			);

			if (!result) {
				return {
					content: [{ type: "text", text: "User cancelled without choosing." }],
					details: { question: params.question, options: labels, answer: null } as AskDetails,
				};
			}
			if (result.wasCustom) {
				return {
					content: [{ type: "text", text: `User wrote: ${result.answer}` }],
					details: {
						question: params.question,
						options: labels,
						answer: result.answer,
						wasCustom: true,
					} as AskDetails,
				};
			}
			return {
				content: [{ type: "text", text: `User selected: ${result.index}. ${result.answer}` }],
				details: {
					question: params.question,
					options: labels,
					answer: result.answer,
					wasCustom: false,
				} as AskDetails,
			};
		},

		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("ask ")) + theme.fg("muted", String(args.question ?? ""));
			const opts = Array.isArray(args.options) ? args.options : [];
			if (opts.length > 0) {
				const labels = opts.map((o: { label: string }) => o.label);
				text += `\n${theme.fg("dim", `  ${labels.join(" / ")}`)}`;
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as AskDetails | undefined;
			if (!details) {
				const first = result.content[0];
				return new Text(first?.type === "text" ? first.text : "", 0, 0);
			}
			if (details.answer === null) {
				return new Text(theme.fg("warning", "キャンセル"), 0, 0);
			}
			if (details.wasCustom) {
				return new Text(
					theme.fg("success", "✓ ") + theme.fg("muted", "(入力) ") + theme.fg("accent", details.answer),
					0,
					0,
				);
			}
			const idx = details.options.indexOf(details.answer) + 1;
			const shown = idx > 0 ? `${idx}. ${details.answer}` : details.answer;
			return new Text(theme.fg("success", "✓ ") + theme.fg("accent", shown), 0, 0);
		},
	});
}
