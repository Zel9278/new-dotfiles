/**
 * strict-guard の設定の読み書き。
 *
 * 設定は ~/.pi/agent/strict-guard.json に保存する。
 * セッションではなくマシン全体で効かせたいので、session entry ではなくファイルに置く。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type GuardLevel = "off" | "risky" | "always";

export interface GuardConfig {
	/** bash コマンドの確認レベル */
	bash: GuardLevel;
	/** write(新規作成・全上書き) の確認レベル */
	write: GuardLevel;
	/** edit(部分置換) の確認レベル */
	edit: GuardLevel;
	/** web_fetch ツールの確認レベル */
	webFetch: GuardLevel;
	/** ファイル削除系コマンドは常に確認する(bash が off でも効く) */
	alwaysConfirmDelete: boolean;
	/** git の履歴を壊す系コマンドは常に確認する */
	alwaysConfirmGitDestructive: boolean;
	/** web_fetch で render_js=true のときは常に確認する */
	alwaysConfirmBrowserRender: boolean;
	/** 確認ダイアログでコマンド全文/差分の要約を表示する */
	showDetails: boolean;
	/** UI が無いとき(print/json モード)は確認できないのでブロックする */
	blockWhenNoUI: boolean;
	/** 一度許可したコマンドはセッション中もう聞かない */
	rememberPerSession: boolean;
	/** 追加で保護するパス(部分一致)。ここへの write/edit は常に確認 */
	protectedPaths: string[];
}

export const DEFAULT_CONFIG: GuardConfig = {
	bash: "risky",
	write: "risky",
	edit: "off",
	webFetch: "risky",
	alwaysConfirmDelete: true,
	alwaysConfirmGitDestructive: true,
	alwaysConfirmBrowserRender: true,
	showDetails: true,
	blockWhenNoUI: true,
	rememberPerSession: true,
	protectedPaths: [".env", ".git/config", "id_rsa", ".ssh/", "credentials"],
};

export const CONFIG_PATH = join(homedir(), ".pi", "agent", "strict-guard.json");

export function loadConfig(): GuardConfig {
	try {
		const raw = readFileSync(CONFIG_PATH, "utf8");
		const parsed = JSON.parse(raw) as Partial<GuardConfig>;
		return normalize(parsed);
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

export function saveConfig(config: GuardConfig): void {
	mkdirSync(dirname(CONFIG_PATH), { recursive: true });
	writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function normalize(input: Partial<GuardConfig>): GuardConfig {
	const level = (value: unknown, fallback: GuardLevel): GuardLevel =>
		value === "off" || value === "risky" || value === "always" ? value : fallback;
	const bool = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);

	return {
		bash: level(input.bash, DEFAULT_CONFIG.bash),
		write: level(input.write, DEFAULT_CONFIG.write),
		edit: level(input.edit, DEFAULT_CONFIG.edit),
		webFetch: level(input.webFetch, DEFAULT_CONFIG.webFetch),
		alwaysConfirmDelete: bool(input.alwaysConfirmDelete, DEFAULT_CONFIG.alwaysConfirmDelete),
		alwaysConfirmGitDestructive: bool(input.alwaysConfirmGitDestructive, DEFAULT_CONFIG.alwaysConfirmGitDestructive),
		alwaysConfirmBrowserRender: bool(input.alwaysConfirmBrowserRender, DEFAULT_CONFIG.alwaysConfirmBrowserRender),
		showDetails: bool(input.showDetails, DEFAULT_CONFIG.showDetails),
		blockWhenNoUI: bool(input.blockWhenNoUI, DEFAULT_CONFIG.blockWhenNoUI),
		rememberPerSession: bool(input.rememberPerSession, DEFAULT_CONFIG.rememberPerSession),
		protectedPaths: Array.isArray(input.protectedPaths)
			? input.protectedPaths.filter((p): p is string => typeof p === "string")
			: [...DEFAULT_CONFIG.protectedPaths],
	};
}
