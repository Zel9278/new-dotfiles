import assert from "node:assert/strict";
import { test } from "node:test";
import { countRmTargets, detectCommandRisks, mainCommandName, normalizeCommandForMatching } from "./rules.ts";

const hits = (cmd) => detectCommandRisks(cmd).map((h) => h.label);

test("素の rm -rf は検出する", () => {
  assert.ok(hits("rm -rf /tmp/x").length > 0);
});

test("ヒアドキュメント本体の rm -rf は検出しない", () => {
  const cmd = ["cat > t.mjs <<'EOF'", "const re = /rm -rf/;", "EOF"].join("\n");
  assert.deepEqual(hits(cmd), []);
});

test("ヒアドキュメント外の rm -rf は検出する", () => {
  const cmd = ["cat > t.txt <<'EOF'", "harmless", "EOF", "rm -rf /tmp/x"].join("\n");
  assert.ok(hits(cmd).some((l) => l.includes("rm")));
});

test("クォート無し区切りのヒアドキュメントも本体を除外する", () => {
  const cmd = ["cat <<EOF", "sudo something", "EOF"].join("\n");
  assert.deepEqual(hits(cmd), []);
});

test("<<- 形式も本体を除外する", () => {
  const cmd = ["cat <<-END", "git push --force", "END"].join("\n");
  assert.deepEqual(hits(cmd), []);
});

test("rm -- -f はオプション扱いしない", () => {
  assert.deepEqual(hits("rm -- -f"), []);
});

test("-- の前のオプションは検出する", () => {
  assert.ok(hits("rm -rf -- somefile").length > 0);
});

test("-- 除去はコマンド区切りを越えない", () => {
  assert.ok(hits("git diff -- file.txt && sudo reboot").some((l) => l === "sudo"));
});

test("ヒアドキュメントが閉じた後の複数行を追跡する", () => {
  const cmd = ["cat <<A", "x", "A", "echo mid", "rm -rf /tmp/y"].join("\n");
  assert.ok(hits(cmd).length > 0);
});

test("正規化してもコマンド本体は残る", () => {
  const out = normalizeCommandForMatching("echo hi <<EOF\nbody\nEOF");
  assert.ok(out.includes("echo hi"));
  assert.ok(!out.includes("body"));
});

test("rm の検出ラベルに実際のフラグが出る", () => {
	const label = (cmd) => detectCommandRisks(cmd).map((h) => h.label);
	assert.deepEqual(label("rm -rf x"), ["rm -rf (再帰・強制)"]);
	assert.deepEqual(label("rm -r x"), ["rm -r (再帰)"]);
	assert.deepEqual(label("rm -f x"), ["rm -f (強制)"]);
	assert.deepEqual(label("rm --recursive x"), ["rm --recursive (再帰)"]);
});

test("mainCommandName は前置きを飛ばして実際のコマンドを返す", () => {
	assert.equal(mainCommandName("rm -rf x"), "rm");
	assert.equal(mainCommandName("sudo rm -rf /var/log"), "rm");
	assert.equal(mainCommandName("FOO=1 env rm -rf x"), "rm");
	assert.equal(mainCommandName("/bin/rm -rf x"), "rm");
	assert.equal(mainCommandName("git push --force"), "git");
	assert.equal(mainCommandName('rm -rf a && echo "done"'), "rm");
	assert.equal(mainCommandName(""), undefined);
	assert.equal(mainCommandName("  "), undefined);
});

test("countRmTargets はフラグを除いた削除対象を数える", () => {
	assert.deepEqual(countRmTargets("rm -rf a b c"), ["a", "b", "c"]);
	assert.deepEqual(countRmTargets("rm -rf /tmp/x"), ["/tmp/x"]);
	// クォート内の空白は 1 件として扱う
	assert.deepEqual(countRmTargets('rm -rf "/tmp/my dir"'), ["/tmp/my dir"]);
	// -- 以降はフラグに見えても対象
	assert.deepEqual(countRmTargets("rm -rf -- -weird"), ["-weird"]);
	// リダイレクト先は対象でない
	assert.deepEqual(countRmTargets("rm -rf a > log.txt"), ["a"]);
	// rm を含まなければ空
	assert.deepEqual(countRmTargets("git push --force"), []);
});
