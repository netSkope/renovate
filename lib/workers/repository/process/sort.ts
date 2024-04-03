import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { branchExists } from '../../../util/git';
import type { BranchConfig } from '../../types';

export async function sortBranches(
  branches: Partial<BranchConfig>[]
): Promise<void> {
  // Sort branches
  const sortOrder = [
    'pin',
    'digest',
    'patch',
    'minor',
    'major',
    'lockFileMaintenance',
  ];
  logger.trace({ branches }, 'branches');

  const existsSet = new Set<string>();

  for (const branch of branches) {
    if (branch.branchName && branchExists(branch.branchName)) {
      existsSet.add(branch.branchName);
    }
  }

  const prsOpenSet = new Set<string>();
  const prsClosedSet = new Set<string>();

  for (const name of existsSet) {
    const pr = await platform.getBranchPr(name);
    if (pr && pr.state === 'open') {
      prsOpenSet.add(name);
    } else if (pr && pr.state === 'closed') {
      prsClosedSet.add(name);
    }
  }

  branches.sort((a, b) => {
    if (a.isVulnerabilityAlert && !b.isVulnerabilityAlert) {
      return -1;
    }
    if (!a.isVulnerabilityAlert && b.isVulnerabilityAlert) {
      return 1;
    }

    // TODO #22198
    if (a.prPriority !== b.prPriority) {
      return b.prPriority! - a.prPriority!;
    }

    if (a.branchName && b.branchName) {
      const branchClosedPrA = prsClosedSet.has(a.branchName);
      const branchClosedPrB = prsClosedSet.has(b.branchName);

      if (branchClosedPrA && !branchClosedPrB) {
        return 1;
      }
      if (!branchClosedPrA && branchClosedPrB) {
        return -1;
      }

      const branchExistedA = existsSet.has(a.branchName);
      const branchExistedB = existsSet.has(b.branchName);

      if (branchExistedA && !branchExistedB) {
        return -1;
      }
      if (!branchExistedA && branchExistedB) {
        return 1;
      }

      const branchOpenPrA = prsOpenSet.has(a.branchName);
      const branchOpenPrB = prsOpenSet.has(b.branchName);

      if (branchOpenPrA && !branchOpenPrB) {
        return -1;
      }
      if (!branchOpenPrA && branchOpenPrB) {
        return 1;
      }
    }

    // TODO #7154
    const sortDiff =
      sortOrder.indexOf(a.updateType!) - sortOrder.indexOf(b.updateType!);
    if (sortDiff !== 0) {
      return sortDiff;
    }
    // TODO #22198
    // Sort by prTitle if updateType is the same
    return a.prTitle! < b.prTitle! ? -1 : 1;
  });
}
