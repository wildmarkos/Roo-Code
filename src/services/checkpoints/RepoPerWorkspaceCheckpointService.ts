import * as path from "path"
import crypto from "crypto"

import { CheckpointServiceOptions } from "./types"
import { ShadowCheckpointService } from "./ShadowCheckpointService"

export class RepoPerWorkspaceCheckpointService extends ShadowCheckpointService {
	private async checkoutTaskBranch() {
		if (!this.git) {
			throw new Error("Shadow git repo not initialized")
		}

		const startTime = Date.now()

		const branch = `roo-${this.taskId}`
		this.log(`[${this.constructor.name}#checkoutTaskBranch] searching branches for ${branch}`)
		const branches = await this.git.branchLocal()

		if (!branches.all.includes(branch)) {
			this.log(`[${this.constructor.name}#checkoutTaskBranch] creating ${branch}`)
			await this.git.checkoutLocalBranch(branch)
		} else {
			this.log(`[${this.constructor.name}#checkoutTaskBranch] checking out ${branch}`)
			await this.git.checkout(branch)
		}

		const result = await this.git.revparse(["--abbrev-ref", "HEAD"])

		const duration = Date.now() - startTime
		this.log(`[${this.constructor.name}#checkoutTaskBranch] checked out ${result} in ${duration}ms`)
	}

	override async initShadowGit() {
		await super.initShadowGit()
		await this.checkoutTaskBranch()
	}

	override async restoreCheckpoint(commitHash: string) {
		await this.checkoutTaskBranch()
		await super.restoreCheckpoint(commitHash)
	}

	public static create({ taskId, workspaceDir, shadowDir, log = console.log }: CheckpointServiceOptions) {
		const workspaceHash = crypto.createHash("sha256").update(workspaceDir).digest("hex").toString()

		return new RepoPerWorkspaceCheckpointService(
			taskId,
			path.join(shadowDir, "checkpoints", workspaceHash),
			workspaceDir,
			log,
		)
	}
}
