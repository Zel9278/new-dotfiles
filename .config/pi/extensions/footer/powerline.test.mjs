import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPowerline, SEP_RIGHT, SEP_LEFT } from "./powerline.ts";
import { bar, shortenPath, shortenModel, formatCount } from "./segments.ts";

// pi-tui はこの階層から解決できないので、ANSI を除いた表示幅を自前で数える。
// ここで扱うのは半角文字と Nerd Font のアイコン（端末上1桁）だけなので単純な数え方で足りる。
const visibleWidth = (s) => [...s.replace(/\x1b\[[0-9;]*m/g, "")].length;

// 背景色を識別しやすい値にした簡易テーマ
const theme = {
	getFgAnsi: (c) => `\x1b[38;5;${{accent:1,text:2,muted:3,dim:4,success:5,error:6,warning:7,toolTitle:8}[c] ?? 9}m`,
	getBgAnsi: (c) => `\x1b[48;5;${{selectedBg:10,userMessageBg:11,toolPendingBg:12,toolSuccessBg:13,toolErrorBg:14,customMessageBg:15}[c] ?? 16}m`,
	fg: (_c, t) => t, bg: (_c, t) => t, bold: (t) => t,
};

const cell = (text, bg, fg = "text") => ({ text, bg, fg });

test("セル1つの幅は text + 前後の空白 + 区切り", () => {
	const out = renderPowerline([cell("ab", "selectedBg")], theme, "right", true);
	// " ab " = 4, 区切り 1 => 5
	assert.equal(visibleWidth(out), 5);
});

test("空配列は空文字", () => {
	assert.equal(renderPowerline([], theme, "right", true), "");
});

test("区切りの前景色は手前セルの背景色になる", () => {
	const out = renderPowerline(
		[cell("a", "selectedBg"), cell("b", "toolPendingBg")], theme, "right", true);
	// selectedBg=10 が 38;5;10 として区切りに現れる
	assert.ok(out.includes(`\x1b[48;5;12m\x1b[38;5;10m${SEP_RIGHT}`), out.replace(/\x1b/g,"E"));
});

test("右寄せは左向きの区切りを使う", () => {
	const out = renderPowerline([cell("a", "selectedBg")], theme, "left", true);
	assert.ok(out.includes(SEP_LEFT));
	assert.ok(!out.includes(SEP_RIGHT));
});

test("同じ背景色が隣接すると細線で区切る", () => {
	const out = renderPowerline(
		[cell("a", "toolPendingBg"), cell("b", "toolPendingBg")], theme, "right", true);
	assert.ok(out.includes("│"));
});

test("Nerd Font 無効でも境界が入り幅が保たれる", () => {
	const cells = [cell("a", "selectedBg"), cell("b", "toolPendingBg")];
	const nerd = renderPowerline(cells, theme, "right", true);
	const ascii = renderPowerline(cells, theme, "right", false);
	assert.equal(visibleWidth(ascii), visibleWidth(nerd));
	assert.ok(!ascii.includes(SEP_RIGHT));
});

test("bold 指定でボールドのエスケープが入る", () => {
	const out = renderPowerline([{ ...cell("a", "selectedBg"), bold: true }], theme, "right", true);
	assert.ok(out.includes("\x1b[1m"));
});

test("bar のマス数は常に5", () => {
	for (const p of [0, 1, 30, 62, 88, 100]) assert.equal(visibleWidth(bar(p)), 5);
	assert.equal(bar(0), "▱▱▱▱▱");
	assert.equal(bar(100), "▰▰▰▰▰");
	assert.equal(bar(62), "▰▰▰▱▱");
});

test("shortenPath", () => {
	const home = process.env.HOME;
	assert.equal(shortenPath(`${home}/.dotfiles`), "~/.dotfiles");
	assert.equal(shortenPath(`${home}/a/b/c/d`), "…/c/d");
	assert.equal(shortenPath("/etc"), "/etc");
});

test("shortenModel", () => {
	assert.equal(shortenModel("anthropic/claude-sonnet-4-5-20250929"), "sonnet-4-5");
	assert.equal(shortenModel("gpt-4o"), "4o");
	assert.equal(shortenModel("Claude:Opus5"), "Claude:Opus5");
});

test("formatCount", () => {
	assert.equal(formatCount(999), "999");
	assert.equal(formatCount(45200), "45.2k");
	assert.equal(formatCount(1250000), "1.3M");
});
