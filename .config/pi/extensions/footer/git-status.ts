/**
 * git の dirty 状態を非同期で取得してキャッシュする。
 *
 * フッターの render は同期なので、ここで持っている最新値を返すだけにする。
 * 実際の git 呼び出しはデバウンスしたタイマーとブランチ変更通知で走らせる。
 */

import { execFile } from "node:child_process";

export interface DirtyCounts {
	/** 変更のあるファイル数(staged/unstaged/untracked の合計) */
	changed: number;
}

export class GitDirtyWatcher {
	private counts: DirtyCounts | undefined;
	private timer: NodeJS.Timeout | undefined;
	private inFlight = false;
	private disposed = false;

	constructor(
		private cwd: string,
		private readonly onChange: () => void,
		private readonly intervalMs = 3000,
	) {}

	/** 直近に取得した dirty 状態。まだ取れていなければ undefined */
	get(): DirtyCounts | undefined {
		return this.counts;
	}

	setCwd(cwd: string): void {
		if (cwd === this.cwd) return;
		this.cwd = cwd;
		this.counts = undefined;
		this.refresh();
	}

	start(): void {
		if (this.disposed || this.timer) return;
		this.refresh();
		this.timer = setInterval(() => this.refresh(), this.intervalMs);
		this.timer.unref?.();
	}

	dispose(): void {
		this.disposed = true;
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
	}

	refresh(): void {
		if (this.disposed || this.inFlight) return;
		this.inFlight = true;

		execFile(
			"git",
			["status", "--porcelain"],
			{ cwd: this.cwd, timeout: 2000, maxBuffer: 1024 * 1024 },
			(error, stdout) => {
				this.inFlight = false;
				if (this.disposed) return;

				const next: DirtyCounts | undefined = error
					? undefined
					: { changed: stdout.split("\n").filter((line) => line.trim().length > 0).length };

				const changed = next?.changed !== this.counts?.changed;
				this.counts = next;
				if (changed) this.onChange();
			},
		);
	}
}
