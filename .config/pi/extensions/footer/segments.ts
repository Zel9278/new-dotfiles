/**
 * フッターに並べるセグメントを powerline のセルとして組み立てる。
 *
 * 左側は「今どこで作業しているか」、右側は「セッションの状態」。
 * 隣接セルの背景色が同じだとブロックの境目が消えるので、
 * 並び順に応じて濃淡が交互になるよう bg を割り当てている。
 *
 * dark テーマの背景色の明るさ:
 *   toolPendingBg #282832 < customMessageBg #2d2838
 *   < userMessageBg #343541 < selectedBg #3a3a4a
 * toolSuccessBg / toolErrorBg は色味つき（緑/赤）で状態表示に使う。
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { FooterConfig } from "./config.ts";
import type { DirtyCounts } from "./git-status.ts";
import type { PowerlineCell } from "./powerline.ts";
import { computeWorkTime, formatDuration } from "./work-time.ts";

export interface SegmentInput {
	config: FooterConfig;
	ctx: ExtensionContext;
	branch: string | null;
	dirty: DirtyCounts | undefined;
	statuses: ReadonlyMap<string, string>;
	tokens: { input: number; output: number };
	/** Nerd Font のアイコンを使うか */
	icons: boolean;
}

/** アイコン。Nerd Font 無効時は空文字にして詰める */
function icon(input: SegmentInput, glyph: string): string {
	return input.icons ? `${glyph} ` : "";
}

export function buildCells(input: SegmentInput): {
	left: PowerlineCell[];
	right: PowerlineCell[];
} {
	const { config } = input;

	const left = compact([
		config.cwd ? cwdCell(input) : undefined,
		config.gitBranch ? branchCell(input) : undefined,
		config.gitDirty ? dirtyCell(input) : undefined,
	]);

	const right = compact([
		config.workTime ? workTimeCell(input) : undefined,
		config.tokens ? tokensCell(input) : undefined,
		config.context ? contextCell(input) : undefined,
		config.model ? modelCell(input) : undefined,
		config.guard ? statusCell(input, "strict-guard") : undefined,
		config.mcp ? statusCell(input, "mcp") : undefined,
	]);

	// 他の拡張が setStatus した内容も右端に足す
	for (const [key, text] of input.statuses) {
		if (key === "strict-guard" || key === "mcp") continue;
		right.push({ text, bg: "toolPendingBg", fg: "muted" });
	}

	return { left: alternate(left), right: alternate(right) };
}

function compact(cells: (PowerlineCell | undefined)[]): PowerlineCell[] {
	return cells.filter((c): c is PowerlineCell => c !== undefined);
}

/**
 * 隣接セルの背景が同じにならないよう濃淡を振り直す。
 * 状態色（toolSuccessBg / toolErrorBg）を持つセルはそのまま残す。
 */
function alternate(cells: PowerlineCell[]): PowerlineCell[] {
	const shades: PowerlineCell["bg"][] = ["userMessageBg", "toolPendingBg"];
	let turn = 0;
	return cells.map((cell) => {
		if (cell.bg === "toolSuccessBg" || cell.bg === "toolErrorBg" || cell.bg === "selectedBg") {
			return cell;
		}
		const bg = shades[turn % shades.length];
		turn += 1;
		return { ...cell, bg };
	});
}

function cwdCell(input: SegmentInput): PowerlineCell {
	// 一番左は明るい背景 + accent + bold で「今ここ」を強調する
	return {
		text: icon(input, "\uf07b") + shortenPath(input.ctx.cwd),
		bg: "selectedBg",
		fg: "accent",
		bold: true,
	};
}

function branchCell(input: SegmentInput): PowerlineCell | undefined {
	if (!input.branch) return undefined;
	return {
		text: icon(input, "\ue725") + input.branch,
		bg: "userMessageBg",
		fg: "accent",
	};
}

function dirtyCell(input: SegmentInput): PowerlineCell | undefined {
	const changed = input.dirty?.changed ?? 0;
	if (changed === 0) return undefined;
	return {
		text: `${icon(input, "\uf44d")}${changed}`,
		bg: "toolPendingBg",
		fg: "warning",
	};
}

function workTimeCell(input: SegmentInput): PowerlineCell | undefined {
	const work = computeWorkTime(input.ctx.sessionManager.getBranch());
	if (!work) return undefined;

	const total = formatDuration(work.totalMs);
	const active = formatDuration(work.activeMs);
	// 離席が無ければ1つだけ出す
	const text = total === active ? total : `${total} / ${active}`;
	return { text: icon(input, "\uf017") + text, bg: "toolPendingBg", fg: "muted" };
}

function tokensCell(input: SegmentInput): PowerlineCell | undefined {
	const { input: inTok, output: outTok } = input.tokens;
	if (inTok === 0 && outTok === 0) return undefined;
	return {
		text: `\u2191${formatCount(inTok)} \u2193${formatCount(outTok)}`,
		bg: "userMessageBg",
		fg: "muted",
	};
}

function contextCell(input: SegmentInput): PowerlineCell | undefined {
	const usage = input.ctx.getContextUsage();
	// コンパクション直後は percent が null
	if (!usage || usage.percent === null) return undefined;

	const percent = Math.round(usage.percent);
	// 使用率で背景ごと変えて、切迫していることを一目で分かるようにする
	if (percent >= 85) {
		return { text: `${bar(percent)} ${percent}%`, bg: "toolErrorBg", fg: "error", bold: true };
	}
	if (percent >= 65) {
		return { text: `${bar(percent)} ${percent}%`, bg: "toolPendingBg", fg: "warning" };
	}
	return { text: `${bar(percent)} ${percent}%`, bg: "toolSuccessBg", fg: "success" };
}

function modelCell(input: SegmentInput): PowerlineCell | undefined {
	const id = input.ctx.model?.id;
	if (!id) return undefined;
	return { text: icon(input, "\uf085") + shortenModel(id), bg: "userMessageBg", fg: "text" };
}

function statusCell(input: SegmentInput, key: string): PowerlineCell | undefined {
	const text = input.statuses.get(key);
	if (!text) return undefined;
	// mcp:10!1 のように失敗があるときは赤くする
	const failed = text.includes("!");
	return {
		text,
		bg: failed ? "toolErrorBg" : "toolPendingBg",
		fg: failed ? "error" : "dim",
	};
}

/** 5マスのゲージ。▰▰▰▱▱ */
export function bar(percent: number, width = 5): string {
	const filled = Math.min(width, Math.max(0, Math.round((percent / 100) * width)));
	return "\u25b0".repeat(filled) + "\u25b1".repeat(width - filled);
}

/** $HOME を ~ にして、深いパスは末尾2階層だけ残す */
export function shortenPath(cwd: string): string {
	const home = process.env.HOME;
	let path = home && cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
	const parts = path.split("/");
	if (parts.length > 4) {
		path = `\u2026/${parts.slice(-2).join("/")}`;
	}
	return path;
}

/** provider/model-name-with-date から読みやすい部分だけ取る */
export function shortenModel(id: string): string {
	const tail = id.includes("/") ? (id.split("/").pop() ?? id) : id;
	return tail.replace(/-\d{6,8}$/, "").replace(/^(claude|gpt|gemini)-/, "");
}

/** 1234 -> 1.2k */
export function formatCount(n: number): string {
	if (n < 1000) return `${n}`;
	if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
	return `${(n / 1_000_000).toFixed(1)}M`;
}
