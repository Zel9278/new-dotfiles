import assert from "node:assert/strict";
import { test } from "node:test";
import { detectCommandRisks, normalizeCommandForMatching } from "./rules.ts";

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
