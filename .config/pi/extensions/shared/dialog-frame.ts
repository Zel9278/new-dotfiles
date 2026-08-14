/**
 * オーバーレイのダイアログ枠を描くユーティリティ。
 *
 * ctx.ui.custom(..., { overlay: true }) はコンポーネントを
 * ターミナル中央のフローティングウィンドウとして合成する。
 * このとき render の戻り行はすべて同じ表示幅でなければ枠が崩れるので、
 * 内容を必ず内側幅までパディングしてから左右の罫線を付ける。
 *
 * 各拡張（ask / ask_multi / strict-guard）から共通で使う。
 */

/**
 * 表示幅を数える。ANSI エスケープを除い、全角文字を2桁として扱う。
 *
 * pi-tui の visibleWidth と同じ目的だが、このファイルを
 * 拡張ホストなしでテストできるよう自存させている。
 */
export function width(text: string): number {
	const plain = text.replace(/\u001b\[[0-9;]*m/g, "");
	let w = 0;
	for (const ch of plain) {
		const code = ch.codePointAt(0) ?? 0;
		w += isWide(code) ? 2 : 1;
	}
	return w;
}

/** 東アジアの幅広文字と絵文字の主要範囲 */
function isWide(code: number): boolean {
	return (
		(code >= 0x1100 && code <= 0x115f) ||
		(code >= 0x2e80 && code <= 0xa4cf) ||
		(code >= 0xac00 && code <= 0xd7a3) ||
		(code >= 0xf900 && code <= 0xfaff) ||
		(code >= 0xfe30 && code <= 0xfe6f) ||
		(code >= 0xff00 && code <= 0xff60) ||
		(code >= 0xffe0 && code <= 0xffe6) ||
		(code >= 0x1f300 && code <= 0x1f64f) ||
		(code >= 0x1f900 && code <= 0x1f9ff)
	);
}

/** 幅を超えないように行を分割する。ANSI は行頭で途切れない前提 */
function wrap(text: string, max: number): string[] {
	if (max <= 0) return [text];
	if (width(text) <= max) return [text];

	const words = text.split(" ");
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (width(candidate) <= max) {
			current = candidate;
			continue;
		}
		if (current) lines.push(current);
		// 単語単体で入らないなら文字単位で切る
		if (width(word) <= max) {
			current = word;
		} else {
			let chunk = "";
			for (const ch of word) {
				if (width(chunk + ch) > max) {
					lines.push(chunk);
					chunk = ch;
				} else {
					chunk += ch;
				}
			}
			current = chunk;
		}
	}
	if (current) lines.push(current);
	return lines.length > 0 ? lines : [""];
}

/** 枠線に使う色。テーマの色名 */
export type FrameColor = "border" | "borderAccent" | "borderMuted" | "accent" | "error" | "warning";

/** theme の必要な部分だけ */
export interface FrameTheme {
	fg(color: string, text: string): string;
	bold(text: string): string;
}

export interface FrameOptions {
	/** 枠の内側の幅（罫線とその内側の余白を除いた文字数） */
	innerWidth: number;
	/** 枠線の色 */
	color: FrameColor;
	/** 上枠に埋め込むタイトル */
	title?: string;
	/** 下枠に埋め込むヒント（キー操作の説明など） */
	hint?: string;
}

/**
 * 行の集まりを枠で囲む。
 *
 * 内容の各行は innerWidth に収まっている前提。長い行は呼び出し側で
 * wrapToWidth() を通しておく。ここでは足りない分を空白で埋めるだけ。
 */
export function frame(lines: readonly string[], theme: FrameTheme, options: FrameOptions): string[] {
	const { innerWidth, color, title, hint } = options;
	const paint = (text: string) => theme.fg(color, text);
	const out: string[] = [];

	out.push(paint(topBorder(innerWidth, title, theme, color)));
	for (const line of lines) {
		out.push(`${paint("│")} ${padTo(line, innerWidth)} ${paint("│")}`);
	}
	out.push(paint(bottomBorder(innerWidth, hint, theme, color)));

	return out;
}

/**
 * ╭─ Title ──────────╮
 * タイトルが長すぎる場合は入る分だけ切る。
 */
function topBorder(
	innerWidth: number,
	title: string | undefined,
	theme: FrameTheme,
	color: FrameColor,
): string {
	// 罫線の総内側は innerWidth + 2（両脇の余白）
	const span = innerWidth + 2;
	if (!title) return `╭${"─".repeat(span)}╮`;

	const label = ` ${title} `;
	// "╭─" + label + 残りの─ + "╮"
	if (width(label) + 3 > span) return `╭${"─".repeat(span)}╮`;
	const rest = span - 1 - width(label);
	return `╭─${theme.fg(color, theme.bold(label))}${theme.fg(color, "─".repeat(rest))}╮`;
}

/** ╰────── hint ──╯ ヒントは右寄せ */
function bottomBorder(
	innerWidth: number,
	hint: string | undefined,
	theme: FrameTheme,
	color: FrameColor,
): string {
	const span = innerWidth + 2;
	if (!hint) return `╰${"─".repeat(span)}╯`;

	const label = ` ${hint} `;
	if (width(label) + 3 > span) return `╰${"─".repeat(span)}╯`;
	const rest = span - 1 - width(label);
	return `╰${theme.fg(color, "─".repeat(rest))}${label}─╯`;
}

/** 表示幅を target に揃える。長い場合はそのまま返す（呼び出し側で折り返す） */
export function padTo(text: string, target: number): string {
	const w = width(text);
	return w >= target ? text : text + " ".repeat(target - w);
}

/**
 * 先頭にマーカーを付けて折り返す。2行目以降はマーカー幅だけ字下げする。
 *
 *   > 1. 長い選択肢のラベルがここで
 *        折り返される
 */
export function wrapWithPrefix(prefix: string, text: string, target: number): string[] {
	const pw = width(prefix);
	if (pw >= target) return wrap(prefix + text, target);

	const wrapped = wrap(text, target - pw);
	const indent = " ".repeat(pw);
	return wrapped.map((line, i) => `${i === 0 ? prefix : indent}${line}`);
}

/**
 * 既存コンポーネントの出力を枠に入れる。
 *
 * SettingsList など pi-tui のコンポーネントは truncateToWidth で
 * 上限を切るだけで、幅いっぱいまで埋めない。そのままオーバーレイに
 * 渡すと短い行の右側に背景の余白が残るので、ここで揃える。
 *
 * @param lines コンポーネントが innerWidth で render した行
 * @param options.dropTrailingHint 末尾の空行と英語ヒント行を落とす。
 *   SettingsList は "Enter/Space to change · Esc to cancel" を自前で付けるので、
 *   下枠に日本語のヒントを出す場合は重複する。
 */
export function frameComponent(
	lines: readonly string[],
	theme: FrameTheme,
	options: FrameOptions & { dropTrailingHint?: boolean },
): string[] {
	let body = [...lines];

	if (options.dropTrailingHint) {
		// 末尾の「空行 + ヒント行」を落とす
		while (body.length > 0) {
			const last = body[body.length - 1];
			const plain = last.replace(/\u001b\[[0-9;]*m/g, "").trim();
			if (plain === "" || /Esc to cancel$/.test(plain)) {
				body.pop();
				continue;
			}
			break;
		}
	}

	// 長すぎる行は枠を壊すので切り詰める
	body = body.map((line) =>
		width(line) > options.innerWidth ? clipTo(line, options.innerWidth) : line,
	);
	return frame(body, theme, options);
}

/**
 * 表示幅で切り詰める。ANSI は途中で途切れないよう末尾でリセットする。
 */
function clipTo(text: string, target: number): string {
	let out = "";
	let w = 0;
	let i = 0;
	let sawAnsi = false;

	while (i < text.length) {
		const esc = text.startsWith("\u001b[", i) ? text.indexOf("m", i) : -1;
		if (esc !== -1) {
			out += text.slice(i, esc + 1);
			sawAnsi = true;
			i = esc + 1;
			continue;
		}
		const ch = String.fromCodePoint(text.codePointAt(i) as number);
		const cw = width(ch);
		if (w + cw > target) break;
		out += ch;
		w += cw;
		i += ch.length;
	}

	return sawAnsi ? `${out}\u001b[0m` : out;
}

/** 枠の罪線と左右の余白が占める幅。“│ ” + “ │” = 4 */
export const FRAME_CHROME = 4;

/**
 * 内側幅からオーバーレイの箱に渡す幅を求める。
 *
 * overlayOptions.width を指定しないと箱の幅が既定の 80 桁になり、
 * 枠より広い分が背景の余白として右側に残る。枠と箱の幅を
 * 一致させるためにこれを width として渡す。
 */
export function frameWidth(innerWidth: number): number {
	return innerWidth + FRAME_CHROME;
}

/**
 * 枠内の幅を決める。
 *
 * 内容の最長行と、上下の枠に埋め込むタイトル・ヒントの長さを
 * あわせて見て、上限と下限で挟む。タイトルとヒントを含めないと
 * 枠に入りきらず罪線だけにフォールバックしてしまう。
 */
export function measureInnerWidth(
	texts: readonly string[],
	{
		min = 30,
		max = 76,
		title,
		hint,
	}: { min?: number; max?: number; title?: string; hint?: string } = {},
): number {
	let longest = texts.reduce((acc, t) => Math.max(acc, width(t)), 0);

	// 枠に埋めるラベルは "╰─" + " label " + "─╯" の分を見る。
	// span = inner + 2 なので、label 幅 + 3 <= inner + 2 を満たす必要がある。
	for (const label of [title, hint]) {
		if (!label) continue;
		longest = Math.max(longest, width(` ${label} `) + 1);
	}

	return Math.min(max, Math.max(min, longest));
}
