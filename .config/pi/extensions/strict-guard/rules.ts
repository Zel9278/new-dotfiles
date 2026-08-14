/**
 * 危険なコマンド/パスの判定ルール。
 */

export interface RiskHit {
	/** ルール名。UI 表示用 */
	label: string;
	/** delete / git / general のどれか。設定の「常に確認」に対応 */
	category: "delete" | "git" | "general";
}

const DELETE_PATTERNS: Array<[RegExp, string]> = [
	[/\brm\s+(-[a-z]*[rRf][a-z]*|--recursive|--force)/i, "rm の再帰/強制削除"],
	[/\brm\s+.*\*/, "rm でのワイルドカード削除"],
	[/\bfind\b[^|;]*-delete\b/i, "find -delete"],
	[/\bfind\b[^|;]*-exec\s+rm\b/i, "find -exec rm"],
	[/\bshred\b/i, "shred"],
	[/\btruncate\s+-s\s*0\b/i, "truncate でのファイル空化"],
	[/>\s*\/dev\/(sd|nvme|disk)/i, "ブロックデバイスへの書き込み"],
	[/\bmkfs(\.|\s)/i, "mkfs"],
	[/\bdd\b[^|;]*\bof=/i, "dd の書き込み"],
];

const GIT_PATTERNS: Array<[RegExp, string]> = [
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

const BROWSER_AUTOMATION_PATTERNS: Array<[RegExp, string]> = [
	[/\bplaywright\b/i, "Playwright ブラウザ自動化"],
	[/\bpuppeteer\b/i, "Puppeteer ブラウザ自動化"],
	[/\bselenium-webdriver\b/i, "Selenium ブラウザ自動化"],
	[/\bchromium\.launch\(|firefox\.launch\(|webkit\.launch\(/i, "ブラウザ起動"],
	[/--remote-debugging-port/i, "Chrome リモートデバッグ有効化"],
	[/--disable-web-security/i, "Web セキュリティの無効化"],
];

const GENERAL_PATTERNS: Array<[RegExp, string]> = [
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

/** コマンド文字列からリスクを列挙する */
export function detectCommandRisks(command: string): RiskHit[] {
	const target = normalizeCommandForMatching(command);
	const hits: RiskHit[] = [];
	const push = (patterns: Array<[RegExp, string]>, category: RiskHit["category"]) => {
		for (const [pattern, label] of patterns) {
			if (pattern.test(target)) hits.push({ label, category });
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
