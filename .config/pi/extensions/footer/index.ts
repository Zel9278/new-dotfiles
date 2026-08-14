/**
 * Footer Extension
 *
 * フッターを powerline 風に差し替えて、作業中に見たい情報をまとめて出す。
 *
 *    ~/.dotfiles   pi/main  3   2h14m / 1h48m  ↑45.2k ↓12.1k  ▰▰▰▱▱ 62%   sonnet-4-5
 *
 * 表示項目は /footer で個別にトグルでき、~/.pi/agent/footer.json に永続化される。
 * 幅が足りないときは優先度の低いセルから落とす。
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type SettingItem, SettingsList } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { frameComponent, frameWidth } from "../shared/dialog-frame.ts";
import { type FooterConfig, loadConfig, saveConfig } from "./config.ts";
import { GitDirtyWatcher } from "./git-status.ts";
import { type PowerlineCell, type PowerlineTheme, renderPowerline } from "./powerline.ts";
import { buildCells } from "./segments.ts";

/** 設定UIの枠内幅。項目名と値が収まる程度に固定する */
const SETTINGS_INNER = 46;
const SETTINGS_HINT = "↑↓ 移動 • ←→ 切替 • esc 閉じる";

export default function footer(pi: ExtensionAPI) {
	let config = loadConfig();
	let dirtyWatcher: GitDirtyWatcher | undefined;

	pi.on("session_start", async (_event, ctx) => {
		config = loadConfig();
		apply(ctx);
	});

	pi.on("session_shutdown", async () => {
		dirtyWatcher?.dispose();
		dirtyWatcher = undefined;
	});

	function apply(ctx: ExtensionContext): void {
		if (ctx.mode !== "tui") return;

		if (!config.enabled) {
			ctx.ui.setFooter(undefined);
			dirtyWatcher?.dispose();
			dirtyWatcher = undefined;
			return;
		}

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsubBranch = footerData.onBranchChange(() => tui.requestRender());

			if (config.gitDirty) {
				dirtyWatcher?.dispose();
				dirtyWatcher = new GitDirtyWatcher(ctx.cwd, () => tui.requestRender());
				dirtyWatcher.start();
			}

			return {
				dispose() {
					unsubBranch();
					dirtyWatcher?.dispose();
					dirtyWatcher = undefined;
				},
				invalidate() {},
				render(width: number): string[] {
					const { left, right } = buildCells({
						config,
						ctx,
						branch: footerData.getGitBranch(),
						dirty: dirtyWatcher?.get(),
						statuses: footerData.getExtensionStatuses(),
						tokens: sumTokens(ctx),
						icons: config.nerdFont,
					});
					return [layout(left, right, width, theme as PowerlineTheme, config)];
				},
			};
		});
	}

	registerFooterCommand(
		pi,
		() => config,
		(next, ctx) => {
			config = next;
			saveConfig(next);
			apply(ctx);
		},
	);
}

/** セッション中の入出力トークンを合算する */
function sumTokens(ctx: ExtensionContext): { input: number; output: number } {
	let input = 0;
	let output = 0;
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type === "message" && entry.message.role === "assistant") {
			const message = entry.message as AssistantMessage;
			input += message.usage.input;
			output += message.usage.output;
		}
	}
	return { input, output };
}

/**
 * セルの見た目上の幅。前後の空白1文字ずつと区切り1文字を足す。
 * Nerd Font のアイコンは端末上で1桁幅なので stringWidth をそのまま使う。
 */
function cellWidth(cell: PowerlineCell): number {
	return visibleWidth(cell.text) + 3;
}

/**
 * 左右に寄せて1行に収める。
 *
 * 幅が足りないときは右の末尾（mcp, guard といった補助情報）から落とし、
 * それでも入らなければ左の末尾を削る。cwd は最後まで残す。
 */
function layout(
	left: PowerlineCell[],
	right: PowerlineCell[],
	width: number,
	theme: PowerlineTheme,
	config: FooterConfig,
): string {
	const leftCells = [...left];
	const rightCells = [...right];

	const total = () =>
		leftCells.reduce((sum, c) => sum + cellWidth(c), 0) +
		rightCells.reduce((sum, c) => sum + cellWidth(c), 0);

	while (total() > width && rightCells.length > 0) rightCells.pop();
	while (total() > width && leftCells.length > 1) leftCells.pop();

	const nerd = config.nerdFont;
	const leftText = renderPowerline(leftCells, theme, "right", nerd);
	const rightText = renderPowerline(rightCells, theme, "left", nerd);

	const used = visibleWidth(leftText) + visibleWidth(rightText);
	const pad = " ".repeat(Math.max(0, width - used));
	return truncateToWidth(leftText + pad + rightText, width);
}

/** /footer コマンド。表示項目をトグルする */
function registerFooterCommand(
	pi: ExtensionAPI,
	get: () => FooterConfig,
	set: (next: FooterConfig, ctx: ExtensionContext) => void,
) {
	pi.registerCommand("footer", {
		description: "フッターの表示項目を設定",
		handler: async (args, ctx) => {
			const trimmed = args.trim();

			if (trimmed === "off" || trimmed === "on") {
				set({ ...get(), enabled: trimmed === "on" }, ctx);
				ctx.ui.notify(
					`footer: ${trimmed === "on" ? "カスタム" : "既定"}にした`,
					"info",
				);
				return;
			}

			if (ctx.mode !== "tui") {
				ctx.ui.notify("/footer requires TUI mode", "error");
				return;
			}

			await ctx.ui.custom((tui, theme, _kb, done) => {
				const current = { ...get() };
				const onOff = (v: boolean) => (v ? "on" : "off");
				const toggle = (id: keyof FooterConfig, label: string): SettingItem => ({
					id,
					label,
					currentValue: onOff(current[id]),
					values: ["on", "off"],
				});

				const items: SettingItem[] = [
					toggle("enabled", "カスタムフッターを使う"),
					toggle("nerdFont", "Nerd Font のアイコン"),
					toggle("cwd", "作業ディレクトリ"),
					toggle("gitBranch", "git ブランチ"),
					toggle("gitDirty", "git の変更数"),
					toggle("workTime", "作業時間"),
					toggle("tokens", "トークン数"),
					toggle("context", "コンテキスト使用率"),
					toggle("model", "モデル名"),
					toggle("guard", "strict-guard の設定"),
					toggle("mcp", "MCP の接続状態"),
				];

				const list = new SettingsList(
					items,
					Math.min(items.length + 2, 15),
					getSettingsListTheme(),
					(id, value) => {
						if (id in current) {
							(current as unknown as Record<string, boolean>)[id] = value === "on";
							set({ ...current }, ctx);
						}
					},
					() => done(undefined),
				);

				return {
					// SettingsList は幅いっぱいまで埋めないので、枠に入れて幅を揃える
					render: () => frameComponent(list.render(SETTINGS_INNER), theme, {
						innerWidth: SETTINGS_INNER,
						color: "accent",
						title: "Footer",
						hint: SETTINGS_HINT,
						dropTrailingHint: true,
					}),
					invalidate: () => list.invalidate(),
					handleInput: (data: string) => {
						list.handleInput?.(data);
						tui.requestRender();
					},
				};
			}, {
				overlay: true,
				overlayOptions: {
					anchor: "center",
					width: frameWidth(SETTINGS_INNER),
					margin: 2,
				},
			});
		},
	});
}
