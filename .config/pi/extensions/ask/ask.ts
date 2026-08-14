/**
 * ask ツール: 単一選択 + 自由入力。
 *
 * 選択肢を上下で選び、Enter で決定。最後の「自分で書く」を選ぶと
 * インラインエディタが開いて任意のテキストを返せる。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey, Text } from "@earendil-works/pi-tui";
import { frame, frameWidth, measureInnerWidth, wrapWithPrefix } from "../shared/dialog-frame.ts";
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

			const HINT_SELECT = "↑↓ 選択 • enter 決定 • esc 中止";
			const HINT_EDIT = "enter 送信 • esc 戻る";

			// 枠の幅は開いている間ずっと変えない。編集に入ってヒントが短くなっても
			// 箱が縮むと表示が跳ねるので、長い方に合わせて先に決めておく。
			const inner = measureInnerWidth(
				[
					params.question,
					...all.map((o, i) => `  ${i + 1}. ${o.label}`),
					...all.map((o) => (o.description ? `     ${o.description}` : "")),
				],
				{ min: 34, max: 72, title: "選択", hint: HINT_SELECT },
			);

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

					/** 幅は inner で固定。全行を同じ表示幅に揃えないと枠が崩れる */
					function render(_width: number): string[] {
						if (cache) return cache;

						const body: string[] = [];
						body.push(...wrapWithPrefix("", theme.fg("text", theme.bold(params.question)), inner));
						body.push("");

						all.forEach((opt, i) => {
							const selected = i === cursor;
							const marker = selected ? theme.fg("accent", "❯ ") : "  ";
							const suffix = opt.isFree && editing ? " ✎" : "";
							const color = selected || (opt.isFree && editing) ? "accent" : "text";
							body.push(
								...wrapWithPrefix(marker, theme.fg(color, `${i + 1}. ${opt.label}${suffix}`), inner),
							);
							if (opt.description) {
								body.push(...wrapWithPrefix("     ", theme.fg("muted", opt.description), inner));
							}
						});

						if (editing) {
							body.push("");
							// エディタは枠の内側にさらに1文字下げて置く
							for (const line of editor.render(Math.max(1, inner - 2))) body.push(` ${line}`);
						}

						cache = frame(body, theme, {
							innerWidth: inner,
							color: "accent",
							title: "選択",
							hint: editing ? HINT_EDIT : HINT_SELECT,
						});
						return cache;
					}

					return { render, invalidate: () => { cache = undefined; }, handleInput };
				},
				// 箱の幅を枠と一致させる。指定しないと既定の80桁になり右側に余白が残る
				{
					overlay: true,
					overlayOptions: { anchor: "center", width: frameWidth(inner), margin: 2 },
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
