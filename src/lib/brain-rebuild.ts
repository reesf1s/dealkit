import { rebuildWorkspaceBrain } from './workspace-brain'

/**
 * Single entry point for ALL brain rebuilds.
 * Nothing else in the codebase should call rebuildWorkspaceBrain() directly.
 */
export async function requestBrainRebuild(
  workspaceId: string,
  reason: string
): Promise<void> {
  console.log(`[brain] Rebuild requested: ${reason} (workspace: ${workspaceId})`)
  try {
    await rebuildWorkspaceBrain(workspaceId, reason)
    console.log(`[brain] Rebuild complete: ${reason} (workspace: ${workspaceId})`)
  } catch (err) {
    console.error(`[brain] Rebuild failed: ${reason} (workspace: ${workspaceId})`, err)
    // Non-fatal — brain will rebuild on next access
  }
}
