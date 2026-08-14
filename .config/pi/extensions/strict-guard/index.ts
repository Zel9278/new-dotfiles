/**
 * Strict Guard Extension
 *
 * コマンド実行(bash)とファイル編集(write/edit)の前に確認を挟む。
 * 厳しさは /guard コマンドで設定でき、~/.pi/agent/strict-guard.json に永続化される。
 *
 * 設定レベル:
 *   off    - 確認しない
 *   risky  - 危険パターンに当たったときだけ確認(既定)
 *   always - 毎回確認
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getSettingsListTheme, isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@earendil-works/pi-tui";
import { type GuardConfig, type GuardLevel, loadConfig, saveConfig } from "./config.ts";
import { askGuard, type GuardPrompt } from "./dialog.ts";
import { detectCommandRisks, matchProtectedPath, type RiskHit } from "./rules.ts";

const LEVELS: GuardLevel[] = ["off", "risky", "always"];

export default function strictGuard(pi: ExtensionAPI) {
	let config = loadConfig();
	/** このセッションで許可済みのキー。rememberPerSession が true のとき使う */
	const allowed = new Set<string>();

	pi.on("session_start", async (_event, ctx) => {
		config = loadConfig();
		allowed.clear();
		publishStatus(ctx);
	});

	/** フッターに現在の強度を出す。B=bash W=write E=edit F=web_fetch */
	function publishStatus(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;
		const mark = (level: GuardLevel, letter: string) =>
			level === "always" ? letter.toUpperCase() : level === "risky" ? letter.toLowerCase() : "";
		const active = [
			mark(config.bash, "b"),
			mark(config.write, "w"),
			mark(config.edit, "e"),
			mark(config.webFetch, "f"),
		]
			.filter(Boolean)
			.join("");
		ctx.ui.setStatus("strict-guard", active ? `guard:${active}` : undefined);
	}

	// ---- 確認フロー -------------------------------------------------------

	async function ask(
		ctx: ExtensionContext,
		key: string,
		prompt: Omit<GuardPrompt, "allowSession">,
	) {
		if (config.rememberPerSession && allowed.has(key)) return undefined;

		if (!ctx.hasUI) {
			if (!config.blockWhenNoUI) return undefined;
			return { block: true, reason: `strict-guard: 確認できないためブロック (${prompt.title})` };
		}

		const choice = await askGuard(ctx, { ...prompt, allowSession: config.rememberPerSession });

		if (choice === "allow") return undefined;
		if (choice === "allowSession") {
			allowed.add(key);
			return undefined;
		}
		return { block: true, reason: "strict-guard: ced が拒否した" };
	}

	function riskLabels(hits: RiskHit[]): string[] {
		return [...new Set(hits.map((h) => h.label))];
	}

	// ---- tool_call フック --------------------------------------------------

	pi.on("tool_call", async (event, ctx) => {
		if (isToolCallEventType("bash", event)) {
			return handleBash(ctx, event.input.command ?? "");
		}
		if (isToolCallEventType("write", event)) {
			return handleFile(ctx, "write", event.input.path ?? "", config.write);
		}
		if (isToolCallEventType("edit", event)) {
			return handleFile(ctx, "edit", event.input.path ?? "", config.edit);
		}
		if (event.toolName === "web_fetch") {
			return handleWebFetch(ctx, event.input);
		}
		return undefined;
	});

	async function handleBash(ctx: ExtensionContext, command: string) {
		const hits = detectCommandRisks(command);
		const forced =
			(config.alwaysConfirmDelete && hits.some((h) => h.category === "delete")) ||
			(config.alwaysConfirmGitDestructive && hits.some((h) => h.category === "git"));

		const needConfirm =
			config.bash === "always" || (config.bash === "risky" && hits.length > 0) || forced;
		if (!needConfirm) return undefined;

		const shown = config.showDetails ? command : truncate(command.split("\n")[0] ?? "", 80);
		return ask(ctx, `bash:${command}`, {
			title: hits.length > 0 ? "危険なコマンド" : "コマンド実行の確認",
			danger: hits.length > 0,
			subject: shown
				.split("\n")
				.map((line, i) => (i === 0 ? `$ ${line}` : `  ${line}`))
				.join("\n"),
			risks: riskLabels(hits),
		});
	}

	async function handleFile(
		ctx: ExtensionContext,
		tool: "write" | "edit",
		path: string,
		level: GuardLevel,
	) {
		const hit = matchProtectedPath(path, config.protectedPaths);
		const needConfirm = level === "always" || (level === "risky" && hit !== undefined) || hit !== undefined;
		if (!needConfirm) return undefined;

		const label = tool === "write" ? "ファイル書き込みの確認" : "ファイル編集の確認";
		return ask(ctx, `${tool}:${path}`, {
			title: hit ? `保護パスへの${tool}` : label,
			danger: hit !== undefined,
			subject: `${tool}: ${path}`,
			risks: hit ? [`保護パスに一致: ${hit}`] : [],
		});
	}

	async function handleWebFetch(ctx: ExtensionContext, input: Record<string, unknown>) {
		const renderJs = Boolean(input.render_js);
		const url = String(input.url ?? "");
		const forced = config.alwaysConfirmBrowserRender && renderJs;

		const needConfirm =
			config.webFetch === "always" || (config.webFetch === "risky" && renderJs) || forced;
		if (!needConfirm) return undefined;

		return ask(ctx, `web_fetch:${url}:${renderJs}`, {
			title: renderJs ? "ブラウザレンダリング" : "web_fetch 実行の確認",
			danger: renderJs,
			subject: [`web_fetch ${renderJs ? "render_js=true" : "静的取得"}`, `URL: ${url}`].join("\n"),
			risks: renderJs ? ["Playwright で JavaScript を実行"] : [],
		});
	}

	// ---- /guard コマンド ---------------------------------------------------

	registerGuardCommand(pi, () => config, (next, ctx) => {
		config = next;
		saveConfig(next);
		publishStatus(ctx);
	}, allowed);
}

function truncate(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** /guard コマンドを登録する。SettingsList でトグルし、変更即保存。 */
function registerGuardCommand(
	pi: ExtensionAPI,
	get: () => GuardConfig,
	set: (next: GuardConfig, ctx: ExtensionContext) => void,
	allowed: Set<string>,
) {
	pi.registerCommand("guard", {
		description: "コマンド実行/編集の確認レベルを設定",
		handler: async (args, ctx) => {
			const trimmed = args.trim();

			if (trimmed === "reset") {
				allowed.clear();
				ctx.ui.notify("strict-guard: セッション内の許可済みをクリアした", "info");
				return;
			}
			if (trimmed === "status" || ctx.mode !== "tui") {
				const c = get();
				ctx.ui.notify(
					`strict-guard bash=${c.bash} write=${c.write} edit=${c.edit} webFetch=${c.webFetch} delete=${c.alwaysConfirmDelete} git=${c.alwaysConfirmGitDestructive}`,
					"info",
				);
				return;
			}

			await ctx.ui.custom((tui, theme, _kb, done) => {
				const current = { ...get() };

				const items: SettingItem[] = [
					{ id: "bash", label: "bash コマンドの確認", currentValue: current.bash, values: LEVELS },
					{ id: "write", label: "write の確認", currentValue: current.write, values: LEVELS },
					{ id: "edit", label: "edit の確認", currentValue: current.edit, values: LEVELS },
					{ id: "webFetch", label: "web_fetch の確認", currentValue: current.webFetch, values: LEVELS },
					{
						id: "alwaysConfirmDelete",
						label: "削除系は常に確認",
						currentValue: onOff(current.alwaysConfirmDelete),
						values: ["on", "off"],
					},
					{
						id: "alwaysConfirmGitDestructive",
						label: "git 破壊系は常に確認",
						currentValue: onOff(current.alwaysConfirmGitDestructive),
						values: ["on", "off"],
					},
					{
						id: "alwaysConfirmBrowserRender",
						label: "ブラウザ render_js は常に確認",
						currentValue: onOff(current.alwaysConfirmBrowserRender),
						values: ["on", "off"],
					},
					{
						id: "showDetails",
						label: "確認時に全文を表示",
						currentValue: onOff(current.showDetails),
						values: ["on", "off"],
					},
					{
						id: "blockWhenNoUI",
						label: "UI 無しならブロック",
						currentValue: onOff(current.blockWhenNoUI),
						values: ["on", "off"],
					},
					{
						id: "rememberPerSession",
						label: "許可をセッション中記憶",
						currentValue: onOff(current.rememberPerSession),
						values: ["on", "off"],
					},
				];

				const container = new Container();
				container.addChild(new Text(theme.fg("accent", theme.bold("Strict Guard")), 1, 0));
				container.addChild(
					new Text(theme.fg("dim", "←→ で変更, Esc で閉じる  (off / risky / always)"), 0, 1),
				);

				const list = new SettingsList(
					items,
					Math.min(items.length + 2, 15),
					getSettingsListTheme(),
					(id, value) => {
						applySetting(current, id, value);
						set({ ...current }, ctx);
					},
					() => done(undefined),
				);
				container.addChild(list);

				return {
					render: (width: number) => container.render(width),
					invalidate: () => container.invalidate(),
					handleInput: (data: string) => {
						list.handleInput?.(data);
						tui.requestRender();
					},
				};
			});
		},
	});
}

function onOff(value: boolean): string {
	return value ? "on" : "off";
}

function applySetting(config: GuardConfig, id: string, value: string): void {
	if (id === "bash" || id === "write" || id === "edit" || id === "webFetch") {
		config[id] = value as GuardLevel;
		return;
	}
	if (
		id === "alwaysConfirmDelete" ||
		id === "alwaysConfirmGitDestructive" ||
		id === "alwaysConfirmBrowserRender" ||
		id === "showDetails" ||
		id === "blockWhenNoUI" ||
		id === "rememberPerSession"
	) {
		config[id] = value === "on";
	}
}
