/**
 * 危険なコマンド/パスの判定ルール。
 */

export interface RiskHit {
	/** ルール名。UI 表示用 */
	label: string;
	/** delete / git / general のどれか。設定の「常に確認」に対応 */
	category: "delete" | "git" | "general";
}

/**
 * ルールの表示名。固定文字列か、マッチ結果から作る関数。
 * 後者は実際に使われたフラグを見せるために使う。
 */
type RiskLabel = string | ((match: RegExpMatchArray) => string);

const DELETE_PATTERNS: Array<[RegExp, RiskLabel]> = [
	[
		/\brm\s+((?:-[a-z]*[rRf][a-z]*|--recursive|--force|--)\s*)+/i,
		(m) => `rm ${describeRmFlags(m[0])}`,
	],
	[/\brm\s+.*\*/, "rm でのワイルドカード削除"],
	[/\bfind\b[^|;]*-delete\b/i, "find -delete"],
	[/\bfind\b[^|;]*-exec\s+rm\b/i, "find -exec rm"],
	[/\bshred\b/i, "shred"],
	[/\btruncate\s+-s\s*0\b/i, "truncate でのファイル空化"],
	[/>\s*\/dev\/(sd|nvme|disk)/i, "ブロックデバイスへの書き込み"],
	[/\bmkfs(\.|\s)/i, "mkfs"],
	[/\bdd\b[^|;]*\bof=/i, "dd の書き込み"],
];

const GIT_PATTERNS: Array<[RegExp, RiskLabel]> = [
	[/\bgit\s+push\b[^|;]*(--force|-f\b)/i, "git push --force"],
	[/\bgit\s+reset\b[^|;]*--hard/i, "git reset --hard"],
	[/\bgit\s+clean\b[^|;]*-[a-z]*f/i, "git clean -f"],
	[/\bgit\s+checkout\b[^|;]*\s--\s/i, "git checkout -- (変更破棄)"],
	[/\bgit\s+branch\b[^|;]*\s-D\b/, "git branch -D"],
	[/\bgit\s+rebase\b/i, "git rebase"],
	[/\bgit\s+commit\b[^|;]*--amend/i, "git commit --amend"],
	[/\bgit\s+filter-(branch|repo)\b/i, "git 履歴の書き換え"],
	[/\bgit\s+(restore|stash\s+drop|stash\s+clear)\b/i, "git による変更破棄"],
];

const BROWSER_AUTOMATION_PATTERNS: Array<[RegExp, RiskLabel]> = [
	[/\bplaywright\b/i, "Playwright ブラウザ自動化"],
	[/\bpuppeteer\b/i, "Puppeteer ブラウザ自動化"],
	[/\bselenium-webdriver\b/i, "Selenium ブラウザ自動化"],
	[/\bchromium\.launch\(|firefox\.launch\(|webkit\.launch\(/i, "ブラウザ起動"],
	[/--remote-debugging-port/i, "Chrome リモートデバッグ有効化"],
	[/--disable-web-security/i, "Web セキュリティの無効化"],
];

const GENERAL_PATTERNS: Array<[RegExp, RiskLabel]> = [
	[/\bsudo\b/i, "sudo"],
	[/\bdoas\b/i, "doas"],
	[/\b(chmod|chown)\b[^|;]*(-R|--recursive)/i, "再帰的な権限変更"],
	[/\b(chmod)\b[^|;]*777/i, "chmod 777"],
	[/\b(systemctl|service)\s+(stop|restart|disable|mask)\b/i, "サービス停止/無効化"],
	[/\b(kill|pkill|killall)\b[^|;]*(-9|-KILL)/i, "強制 kill"],
	[/\bcurl\b[^|;]*\|\s*(ba)?sh/i, "curl | sh"],
	[/\bwget\b[^|;]*\|\s*(ba)?sh/i, "wget | sh"],
	[/\b(npm|pnpm|yarn)\s+publish\b/i, "パッケージの publish"],
	[/\b(docker|podman)\s+(rm|rmi|system\s+prune|volume\s+rm)\b/i, "コンテナ/イメージの削除"],
	[/\b(kubectl)\s+(delete|drain)\b/i, "kubectl delete/drain"],
	[/\bterraform\s+(apply|destroy)\b/i, "terraform apply/destroy"],
	[/\b(aws|gcloud|az)\b[^|;]*\bdelete\b/i, "クラウドリソース削除"],
	[/\bdrop\s+(table|database)\b/i, "SQL DROP"],
	[/\bhistory\s+-c\b/, "シェル履歴の消去"],
	[/\bcrontab\s+-r\b/, "crontab の全削除"],
	[/:\(\)\s*\{.*\|\s*:\s*&\s*\}\s*;\s*:/, "fork bomb"],
];

/**
 * パターン判定の前にコマンド文字列を清める。
 *
 * 1. ヒアドキュメント本体を落とす。ファイルに書き込む内容は
 *    そのターンで実行されないので、中に rm -rf 等があっても危険でない。
 *    ただし書いたスクリプトを別ターンで実行する抜け道は残る。
 * 2. `--` 以降のトークンを落とす。POSIX ではオプションの終わりなので
 *    `rm -- -f` の -f はファイル名。オプションとして誤検知しない。
 */
export function normalizeCommandForMatching(command: string): string {
	return stripTrailingOperands(stripHeredocBodies(command));
}

/** <<EOF / <<'EOF' / <<-EOF の本体を除去し、リダイレクト行だけ残す */
function stripHeredocBodies(command: string): string {
	const lines = command.split("\n");
	const out: string[] = [];
	let pendingDelimiters: string[] = [];
	let activeDelimiter: string | undefined;

	for (const line of lines) {
		if (activeDelimiter !== undefined) {
			// 本体中。終端行に到達したら押し出しを再開する
			if (line.trim() === activeDelimiter) {
				activeDelimiter = pendingDelimiters.shift();
			}
			continue;
		}

		out.push(line);

		const delimiters = [...line.matchAll(/<<-?\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_][\w]*))/g)]
			.map((m) => m[1] ?? m[2] ?? m[3])
			.filter((d): d is string => d !== undefined);

		if (delimiters.length > 0) {
			activeDelimiter = delimiters[0];
			pendingDelimiters = delimiters.slice(1);
		}
	}

	return out.join("\n");
}

/** 各コマンドの `--` 以降を落とす */
function stripTrailingOperands(command: string): string {
	// コマンド区切り(; && || | 改行)ごとに見て、区切りの中の ` -- ` 以降を除去
	return command
		.split(/(\n|;|&&|\|\||\|)/)
		.map((segment) => segment.replace(/\s--\s.*$/, ""))
		.join("");
}

/**
 * コマンド列の先頭にある主コマンド名を拾う。タイトルに使う。
 *
 * env 代入と sudo / doas / コマンドランチャは跨いで、実際に走るものを返す。
 *
 * @example mainCommandName('sudo rm -rf /x && echo ok') → "rm"
 */
export function mainCommandName(command: string): string | undefined {
	const first = command
		.split(/\n|&&|\|\||[;|]/)[0]
		?.trim()
		.replace(/^[({]\s*/, "");
	if (!first) return undefined;

	// コマンド名の前に付くものを順に剥がす
	const skip = /^(?:[A-Za-z_][A-Za-z0-9_]*=\S*|sudo|doas|env|command|time|nohup|exec|xargs)$/;
	for (const token of first.split(/\s+/)) {
		if (token.length === 0 || token.startsWith("-")) continue;
		if (skip.test(token)) continue;
		// パス付きなら末尾の要素だけを使う
		return token.split("/").pop() || token;
	}
	return undefined;
}

/**
 * rm の削除対象を数える。フラグとリダイレクトを除いた引数の件数。
 *
 * シェルの展開前なので、ワイルドカードは 1 件として数える。
 * 実際に消える件数とは一致しないので、あくまで目安として使う。
 */
export function countRmTargets(command: string): string[] {
	const segment = command.split(/\n|&&|\|\||[;|]/).find((s) => /\brm\b/.test(s));
	if (!segment) return [];

	const afterRm = segment.slice(segment.search(/\brm\b/) + 2);
	const targets: string[] = [];
	let optionsEnded = false;

	// クォートごとに拾う。空白入りのパスを 1 件として数えるため
	const tokens = afterRm.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
	for (const raw of tokens) {
		if (raw === "--") {
			optionsEnded = true;
			continue;
		}
		if (!optionsEnded && raw.startsWith("-")) continue;
		// リダイレクト先は削除対象でない
		if (/^[<>]/.test(raw)) break;
		targets.push(raw.replace(/^["']|["']$/g, ""));
	}
	return targets;
}

/**
 * rm のフラグ部分から、何が危ないのかを日本語で返す。
 * 実際に使われたフラグをそのまま添える。
 *
 * @example describeRmFlags("rm -rf ") → "-rf (再帰・強制)"
 */
function describeRmFlags(matched: string): string {
	// "rm" と空白を落としてフラグだけにする
	const flags = matched
		.replace(/^\s*rm\s+/i, "")
		.trim()
		.replace(/\s+/g, " ");

	const recursive = /(^|\s)-[a-z]*[rR]|--recursive/.test(flags);
	const force = /(^|\s)-[a-z]*f|--force/.test(flags);

	const kinds = [recursive ? "再帰" : "", force ? "強制" : ""].filter(Boolean);
	const suffix = kinds.length > 0 ? ` (${kinds.join("・")})` : "";
	return `${flags}${suffix}`;
}

/** コマンド文字列からリスクを列挙する */
export function detectCommandRisks(command: string): RiskHit[] {
	const target = normalizeCommandForMatching(command);
	const hits: RiskHit[] = [];
	const push = (patterns: Array<[RegExp, RiskLabel]>, category: RiskHit["category"]) => {
		for (const [pattern, label] of patterns) {
			const match = target.match(pattern);
			if (!match) continue;
			hits.push({ label: typeof label === "function" ? label(match) : label, category });
		}
	};
	push(BROWSER_AUTOMATION_PATTERNS, "general");
	push(DELETE_PATTERNS, "delete");
	push(GIT_PATTERNS, "git");
	push(GENERAL_PATTERNS, "general");
	return hits;
}

/** パスが保護対象に該当するか */
export function matchProtectedPath(path: string, protectedPaths: string[]): string | undefined {
	const normalized = path.replace(/\\/g, "/");
	return protectedPaths.find((p) => p.length > 0 && normalized.includes(p));
}
