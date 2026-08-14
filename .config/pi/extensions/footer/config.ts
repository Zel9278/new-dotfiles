/**
 * フッターの表示設定。~/.pi/agent/footer.json に保存する。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface FooterConfig {
	/** false なら pi 既定のフッターに戻す */
	enabled: boolean;
	/** Nerd Font のアイコンとセパレータを使う */
	nerdFont: boolean;
	cwd: boolean;
	gitBranch: boolean;
	gitDirty: boolean;
	workTime: boolean;
	tokens: boolean;
	context: boolean;
	model: boolean;
	guard: boolean;
	mcp: boolean;
}

export const DEFAULT_CONFIG: FooterConfig = {
	enabled: true,
	nerdFont: true,
	cwd: true,
	gitBranch: true,
	gitDirty: true,
	workTime: true,
	tokens: true,
	context: true,
	model: true,
	guard: true,
	mcp: true,
};

export const CONFIG_PATH = join(homedir(), ".pi", "agent", "footer.json");

export function loadConfig(): FooterConfig {
	try {
		const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<FooterConfig>;
		const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
		return {
			enabled: bool(parsed.enabled, DEFAULT_CONFIG.enabled),
			nerdFont: bool(parsed.nerdFont, DEFAULT_CONFIG.nerdFont),
			cwd: bool(parsed.cwd, DEFAULT_CONFIG.cwd),
			gitBranch: bool(parsed.gitBranch, DEFAULT_CONFIG.gitBranch),
			gitDirty: bool(parsed.gitDirty, DEFAULT_CONFIG.gitDirty),
			workTime: bool(parsed.workTime, DEFAULT_CONFIG.workTime),
			tokens: bool(parsed.tokens, DEFAULT_CONFIG.tokens),
			context: bool(parsed.context, DEFAULT_CONFIG.context),
			model: bool(parsed.model, DEFAULT_CONFIG.model),
			guard: bool(parsed.guard, DEFAULT_CONFIG.guard),
			mcp: bool(parsed.mcp, DEFAULT_CONFIG.mcp),
		};
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

export function saveConfig(config: FooterConfig): void {
	mkdirSync(dirname(CONFIG_PATH), { recursive: true });
	writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
