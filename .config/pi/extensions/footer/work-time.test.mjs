import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWorkTime, formatDuration } from "./work-time.ts";

const T0 = Date.parse("2025-01-01T10:00:00.000Z");
const min = (n) => n * 60_000;
const at = (offsetMin) => ({ timestamp: new Date(T0 + min(offsetMin)).toISOString() });

test("エントリなしなら undefined", () => {
	assert.equal(computeWorkTime([]), undefined);
});

test("ギャップなしなら total と active が一致", () => {
	const r = computeWorkTime([at(0), at(5), at(10)], T0 + min(10));
	assert.equal(r.totalMs, min(10));
	assert.equal(r.activeMs, min(10));
});

test("15分超のギャップはアイドルとして引く", () => {
	// 0分 -> 5分 作業、5分 -> 65分 の60分は離席、65分 -> 70分 作業
	const r = computeWorkTime([at(0), at(5), at(65), at(70)], T0 + min(70));
	assert.equal(r.totalMs, min(70));
	assert.equal(r.activeMs, min(10));
});

test("ちょうど15分のギャップは引かない", () => {
	const r = computeWorkTime([at(0), at(15)], T0 + min(15));
	assert.equal(r.activeMs, min(15));
});

test("最後のエントリからの放置もアイドル", () => {
	const r = computeWorkTime([at(0), at(5)], T0 + min(90));
	assert.equal(r.totalMs, min(90));
	assert.equal(r.activeMs, min(5));
});

test("順序が乱れていてもソートして扱う", () => {
	const r = computeWorkTime([at(10), at(0), at(5)], T0 + min(10));
	assert.equal(r.totalMs, min(10));
	assert.equal(r.activeMs, min(10));
});

test("不正なタイムスタンプは無視する", () => {
	const r = computeWorkTime([{ timestamp: "nope" }, at(0), at(5)], T0 + min(5));
	assert.equal(r.totalMs, min(5));
});

test("全部不正なら undefined", () => {
	assert.equal(computeWorkTime([{ timestamp: "x" }]), undefined);
});

test("formatDuration", () => {
	assert.equal(formatDuration(45_000), "45s");
	assert.equal(formatDuration(min(9)), "9m");
	assert.equal(formatDuration(min(59)), "59m");
	assert.equal(formatDuration(min(60)), "1h00m");
	assert.equal(formatDuration(min(134)), "2h14m");
	assert.equal(formatDuration(min(1500)), "25h00m");
	assert.equal(formatDuration(0), "0s");
});
