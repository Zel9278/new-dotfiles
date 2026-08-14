/**
 * powerline 風のセグメント描画。
 *
 * 各セグメントは背景色を持ち、境界は  (U+E0B0) で繋ぐ。
 * 隣接セグメントの背景色が異なるとき、区切り文字は
 * 「前の背景色を前景色、次の背景色を背景色」にすると繋ぎ目が滑らかになる。
 *
 *   ┌ bg=A ┐┌ bg=B ┐
 *   │ text ││ text │
 *   └──────┘└──────┘
 *          ↑ この文字は fg=A, bg=B
 *
 * Nerd Font が無い環境では ASCII の区切りに落とす。
 */

/** Nerd Font のセパレータ */
export const SEP_RIGHT = "\ue0b0";
export const SEP_LEFT = "\ue0b2";
/** Nerd Font がないときの代替。背景色を隣接させないために細い線を入れる */
export const SEP_RIGHT_ASCII = "\u258c";
export const SEP_LEFT_ASCII = "\u2590";

export interface PowerlineCell {
	/** 表示テキスト（ANSI を含まない素の文字列） */
	text: string;
	/** 背景色。theme.bg に渡せる名前 */
	bg: ThemeBgName;
	/** 前景色。theme.fg に渡せる名前 */
	fg: ThemeFgName;
	/** 太字にする */
	bold?: boolean;
}

export type ThemeBgName =
	| "selectedBg"
	| "userMessageBg"
	| "customMessageBg"
	| "toolPendingBg"
	| "toolSuccessBg"
	| "toolErrorBg";

export type ThemeFgName =
	| "accent"
	| "success"
	| "error"
	| "warning"
	| "muted"
	| "dim"
	| "text"
	| "toolTitle";

/** theme の必要な部分だけ */
export interface PowerlineTheme {
	fg(color: string, text: string): string;
	bg(color: string, text: string): string;
	bold(text: string): string;
	getFgAnsi(color: string): string;
	getBgAnsi(color: string): string;
}

const RESET = "\u001b[0m";

/**
 * セルを powerline 風に連結する。
 *
 * @param cells 左から順に並べるセル
 * @param direction "right" なら右向きの矢印（左寄せブロック用）、
 *                  "left" なら左向き（右寄せブロック用）
 * @param useNerdFont false なら ASCII 区切りにする
 */
export function renderPowerline(
	cells: readonly PowerlineCell[],
	theme: PowerlineTheme,
	direction: "right" | "left",
	useNerdFont: boolean,
): string {
	if (cells.length === 0) return "";

	const sep = useNerdFont
		? direction === "right"
			? SEP_RIGHT
			: SEP_LEFT
		: direction === "right"
			? SEP_RIGHT_ASCII
			: SEP_LEFT_ASCII;

	const parts: string[] = [];

	if (direction === "right") {
		cells.forEach((cell, i) => {
			parts.push(paint(cell, theme));
			const next = cells[i + 1];
			// 最後のセルの後ろは背景なし側へ抜ける
			parts.push(
				next
					? transition(cell.bg, next.bg, theme, sep)
					: tail(cell.bg, theme, sep),
			);
		});
	} else {
		// 右寄せ: 先頭のセルの手前に「背景なし → 先頭の背景」の区切りを置く
		cells.forEach((cell, i) => {
			const prev = cells[i - 1];
			parts.push(
				prev
					? transition(cell.bg, prev.bg, theme, sep)
					: head(cell.bg, theme, sep),
			);
			parts.push(paint(cell, theme));
		});
	}

	return parts.join("");
}

/** セル本体を背景色付きで描く */
function paint(cell: PowerlineCell, theme: PowerlineTheme): string {
	const body = ` ${cell.text} `;
	const fgAnsi = theme.getFgAnsi(cell.fg);
	const bgAnsi = theme.getBgAnsi(cell.bg);
	const bold = cell.bold ? "\u001b[1m" : "";
	return `${bgAnsi}${fgAnsi}${bold}${body}${RESET}`;
}

/**
 * 隣接セグメントの境界。
 * 区切り文字の前景色に手前の背景色、背景色に次の背景色を使う。
 */
function transition(
	fromBg: ThemeBgName,
	toBg: ThemeBgName,
	theme: PowerlineTheme,
	sep: string,
): string {
	// 同じ背景色同士なら区切りを薄い線にして、ブロックが融合しないようにする
	if (fromBg === toBg) {
		return `${theme.getBgAnsi(toBg)}${theme.getFgAnsi("dim")}│${RESET}`;
	}
	return `${theme.getBgAnsi(toBg)}${bgAsFg(fromBg, theme)}${sep}${RESET}`;
}

/** 左寄せブロックの末尾。背景なしへ抜ける */
function tail(fromBg: ThemeBgName, theme: PowerlineTheme, sep: string): string {
	return `${bgAsFg(fromBg, theme)}${sep}${RESET}`;
}

/** 右寄せブロックの先頭。背景なしから入る */
function head(toBg: ThemeBgName, theme: PowerlineTheme, sep: string): string {
	return `${bgAsFg(toBg, theme)}${sep}${RESET}`;
}

/**
 * 背景色のANSIを前景色のANSIに読み替える。
 * 48;5;N -> 38;5;N / 48;2;R;G;B -> 38;2;R;G;B
 */
function bgAsFg(bg: ThemeBgName, theme: PowerlineTheme): string {
	return theme.getBgAnsi(bg).replace(/\u001b\[48;/g, "\u001b[38;");
}
