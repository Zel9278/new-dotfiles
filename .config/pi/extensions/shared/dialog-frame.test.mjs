import { test } from "node:test";
import assert from "node:assert/strict";
import { frame, padTo, wrapWithPrefix, measureInnerWidth, width } from "./dialog-frame.ts";

const theme = { fg: (_c, t) => t, bold: (t) => t };
// 幅の数え方は本体と揃える必要があるので width をそのまま使う
const vw = width;

test("全行が同じ表示幅になる", () => {
	const out = frame(["a", "longer line", ""], theme, { innerWidth: 20, color: "border" });
	const widths = new Set(out.map(vw));
	assert.equal(widths.size, 1, `幅が揃っていない: ${[...widths]}`);
	// 罫線2 + 余白2 + 内側20 = 24
	assert.equal([...widths][0], 24);
});

test("タイトル付きでも幅が揃う", () => {
	const out = frame(["x"], theme, { innerWidth: 30, color: "accent", title: "確認" });
	assert.equal(new Set(out.map(vw)).size, 1);
	assert.ok(out[0].includes("確認"));
});

test("ヒント付きでも幅が揃う", () => {
	const out = frame(["x"], theme, { innerWidth: 30, color: "border", hint: "esc 中止" });
	assert.equal(new Set(out.map(vw)).size, 1);
	assert.ok(out.at(-1).includes("esc 中止"));
});

test("タイトルとヒントの両方でも幅が揃う", () => {
	const out = frame(["x", "y"], theme, {
		innerWidth: 40, color: "border", title: "選択", hint: "↑↓ enter esc",
	});
	assert.equal(new Set(out.map(vw)).size, 1);
});

test("長すぎるタイトルは罫線だけにフォールバックする", () => {
	const out = frame(["x"], theme, { innerWidth: 5, color: "border", title: "とても長いタイトル" });
	assert.equal(new Set(out.map(vw)).size, 1);
	assert.ok(!out[0].includes("とても長い"));
});

test("全角文字を含む行でも幅が揃う", () => {
	const out = frame(["日本語のテキスト", "ascii"], theme, { innerWidth: 24, color: "border" });
	assert.equal(new Set(out.map(vw)).size, 1);
});

test("枠の角と縦線が正しい", () => {
	const out = frame(["x"], theme, { innerWidth: 10, color: "border" });
	assert.ok(out[0].startsWith("╭") && out[0].endsWith("╮"));
	assert.ok(out[1].startsWith("│") && out[1].endsWith("│"));
	assert.ok(out.at(-1).startsWith("╰") && out.at(-1).endsWith("╯"));
});

test("内容が空でも枠だけ返る", () => {
	const out = frame([], theme, { innerWidth: 10, color: "border" });
	assert.equal(out.length, 2);
});

test("padTo は幅を超えたら触らない", () => {
	assert.equal(padTo("abc", 5), "abc  ");
	assert.equal(padTo("abcdef", 3), "abcdef");
});

test("wrapWithPrefix は2行目以降を字下げする", () => {
	const out = wrapWithPrefix("> ", "aaa bbb ccc ddd", 8);
	assert.ok(out.length > 1);
	assert.ok(out[0].startsWith("> "));
	assert.ok(out[1].startsWith("  "));
});

test("measureInnerWidth は上限と下限で挟む", () => {
	assert.equal(measureInnerWidth(["short"], { min: 20, max: 60 }), 20);
	assert.equal(measureInnerWidth(["x".repeat(100)], { min: 20, max: 60 }), 60);
	assert.equal(measureInnerWidth(["x".repeat(40)], { min: 20, max: 60 }), 40);
});

test("frameComponent は幅の揃わない行を揃える", async () => {
	const { frameComponent } = await import("./dialog-frame.ts");
	const ragged = ["short", "a much longer line here", "", "mid"];
	const out = frameComponent(ragged, theme, { innerWidth: 30, color: "accent" });
	assert.equal(new Set(out.map(vw)).size, 1);
});

test("frameComponent は内側幅を超える行を切り詰める", async () => {
	const { frameComponent } = await import("./dialog-frame.ts");
	const out = frameComponent(["x".repeat(100)], theme, { innerWidth: 20, color: "border" });
	assert.equal(new Set(out.map(vw)).size, 1);
	assert.equal(vw(out[0]), 24);
});

test("dropTrailingHint で末尾の空行と英語ヒントを落とす", async () => {
	const { frameComponent } = await import("./dialog-frame.ts");
	const lines = ["item a", "item b", "", "  Enter/Space to change · Esc to cancel"];
	const kept = frameComponent(lines, theme, { innerWidth: 40, color: "border" });
	const dropped = frameComponent(lines, theme, {
		innerWidth: 40, color: "border", dropTrailingHint: true,
	});
	assert.equal(kept.length - dropped.length, 2);
	assert.ok(!dropped.some((l) => l.includes("Esc to cancel")));
});

test("frameWidth は枠の実際の幅と一致する", async () => {
	const { frameComponent, frameWidth } = await import("./dialog-frame.ts");
	for (const inner of [20, 34, 46, 72]) {
		const out = frameComponent(["x"], theme, { innerWidth: inner, color: "border" });
		assert.equal(vw(out[0]), frameWidth(inner), `inner=${inner}`);
	}
});
