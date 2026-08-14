/**
 * セッションの作業時間を計算する。
 *
 * - total : 最初のエントリから今までの実時間
 * - active: エントリ間のギャップが IDLE_THRESHOLD_MS を超えた分を除いた時間
 *
 * active は「席を外していた時間」を差し引いた実作業時間の目安。
 * ギャップ判定はエントリのタイムスタンプ差だけを見るので、
 * 長時間かかった1回のツール実行はアイドル扱いされない。
 */

/** これを超えるエントリ間の空白はアイドルとみなす */
export const IDLE_THRESHOLD_MS = 15 * 60 * 1000;

export interface WorkTime {
	totalMs: number;
	activeMs: number;
}

interface TimestampedEntry {
	timestamp: string;
}

/**
 * @param entries セッションのエントリ列（時系列順）
 * @param now 現在時刻。テスト用に差し替えられる
 */
export function computeWorkTime(
	entries: readonly TimestampedEntry[],
	now: number = Date.now(),
): WorkTime | undefined {
	const times: number[] = [];
	for (const entry of entries) {
		const ms = Date.parse(entry.timestamp);
		if (!Number.isNaN(ms)) times.push(ms);
	}
	if (times.length === 0) return undefined;

	// 念のため昇順にする（分岐やコンパクションで順序が乱れる場合に備える）
	times.sort((a, b) => a - b);

	const start = times[0];
	const totalMs = Math.max(0, now - start);

	// 各区間を見て、閾値を超えたギャップを積み上げる
	let idleMs = 0;
	for (let i = 1; i < times.length; i += 1) {
		const gap = times[i] - times[i - 1];
		if (gap > IDLE_THRESHOLD_MS) idleMs += gap;
	}
	// 最後のエントリから現在までも、開きすぎていればアイドル
	const trailing = now - times[times.length - 1];
	if (trailing > IDLE_THRESHOLD_MS) idleMs += trailing;

	return { totalMs, activeMs: Math.max(0, totalMs - idleMs) };
}

/** 8100000 -> "2h15m" / 540000 -> "9m" / 45000 -> "45s" */
export function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	if (totalSeconds < 60) return `${totalSeconds}s`;

	const totalMinutes = Math.floor(totalSeconds / 60);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (hours === 0) return `${minutes}m`;
	return `${hours}h${String(minutes).padStart(2, "0")}m`;
}
