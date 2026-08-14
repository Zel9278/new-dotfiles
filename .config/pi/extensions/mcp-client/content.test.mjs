import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeContent, estimateBytes } from "./content.ts";

const PNG = "iVBORw0KGgoAAAANSUhEUg==";

test("text ブロックはそのまま通る", () => {
	assert.deepEqual(normalizeContent([{ type: "text", text: "hello" }]), [
		{ type: "text", text: "hello" },
	]);
});

test("image は ImageContent として渡す", () => {
	assert.deepEqual(normalizeContent([{ type: "image", data: PNG, mimeType: "image/png" }]), [
		{ type: "image", data: PNG, mimeType: "image/png" },
	]);
});

test("mimeType の大文字小文字は問わない", () => {
	const out = normalizeContent([{ type: "image", data: PNG, mimeType: "IMAGE/PNG" }]);
	assert.equal(out[0].type, "image");
});

test("未対応の画像形式はテキストに落とす", () => {
	const out = normalizeContent([{ type: "image", data: PNG, mimeType: "image/tiff" }]);
	assert.equal(out[0].type, "text");
	assert.match(out[0].text, /image\/tiff/);
	assert.match(out[0].text, /未対応/);
});

test("data 欠落の image はテキストに落とす", () => {
	const out = normalizeContent([{ type: "image", mimeType: "image/png" }]);
	assert.deepEqual(out, [{ type: "text", text: "[image: データなし]" }]);
});

test("mimeType 欠落の image もテキストに落とす", () => {
	const out = normalizeContent([{ type: "image", data: PNG }]);
	assert.equal(out[0].type, "text");
});

test("resource のテキストを取り出す", () => {
	const out = normalizeContent([
		{ type: "resource", resource: { text: "file body", uri: "file:///a.txt" } },
	]);
	assert.deepEqual(out, [{ type: "text", text: "file body" }]);
});

test("resource の画像 blob も画像として渡す", () => {
	const out = normalizeContent([
		{ type: "resource", resource: { blob: PNG, mimeType: "image/png", uri: "file:///a.png" } },
	]);
	assert.deepEqual(out, [{ type: "image", data: PNG, mimeType: "image/png" }]);
});

test("中身を取り出せない resource は uri を出す", () => {
	const out = normalizeContent([
		{ type: "resource", resource: { blob: "x", mimeType: "application/zip", uri: "file:///a.zip" } },
	]);
	assert.deepEqual(out, [{ type: "text", text: "[resource file:///a.zip]" }]);
});

test("未知のブロックは種別だけ出す", () => {
	assert.deepEqual(normalizeContent([{ type: "audio" }]), [{ type: "text", text: "[audio]" }]);
});

test("空配列でも必ず1ブロック返す", () => {
	assert.deepEqual(normalizeContent([]), [{ type: "text", text: "(empty result)" }]);
});

test("text と image の混在を順序どおり返す", () => {
	const out = normalizeContent([
		{ type: "text", text: "before" },
		{ type: "image", data: PNG, mimeType: "image/png" },
		{ type: "text", text: "after" },
	]);
	assert.equal(out.length, 3);
	assert.deepEqual(out.map((b) => b.type), ["text", "image", "text"]);
});

test("estimateBytes", () => {
	assert.equal(estimateBytes("AAAA"), "3 B");
	assert.equal(estimateBytes("AAA="), "2 B");
	assert.equal(estimateBytes("AA=="), "1 B");
	assert.equal(estimateBytes("A".repeat(4096)), "3.0 KB");
	assert.equal(estimateBytes("A".repeat(4 * 1024 * 1024)), "3.0 MB");
});
