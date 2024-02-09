import { git, platform } from '../../../../test/util';
import type { UpdateType } from '../../../config/types';
import type { Pr } from '../../../modules/platform';
import { sortBranches } from './sort';

jest.mock('../../../util/git');

git.branchExists = jest.fn();

jest.mock('../../../modules/platform');

platform.getBranchPr = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
});

describe('workers/repository/process/sort', () => {
  describe('sortBranches()', () => {
    it('sorts based on updateType and prTitle', async () => {
      const branches = [
        {
          updateType: 'major' as UpdateType,
          prTitle: 'some major update',
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some pin',
        },
        {
          updateType: 'minor' as UpdateType,
          prTitle: 'a minor update',
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some other other pin',
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some other pin',
        },
      ];
      await sortBranches(branches);
      expect(branches).toEqual([
        { prTitle: 'some other other pin', updateType: 'pin' },
        { prTitle: 'some other pin', updateType: 'pin' },
        { prTitle: 'some pin', updateType: 'pin' },
        { prTitle: 'a minor update', updateType: 'minor' },
        { prTitle: 'some major update', updateType: 'major' },
      ]);
    });

    it('sorts based on prPriority', async () => {
      const branches = [
        {
          updateType: 'major' as UpdateType,
          prTitle: 'some major update',
          prPriority: 1,
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some pin',
          prPriority: -1,
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some other pin',
          prPriority: 0,
        },
        {
          updateType: 'minor' as UpdateType,
          prTitle: 'a minor update',
          prPriority: -1,
        },
      ];
      await sortBranches(branches);
      expect(branches).toEqual([
        { prPriority: 1, prTitle: 'some major update', updateType: 'major' },
        { prPriority: 0, prTitle: 'some other pin', updateType: 'pin' },
        { prPriority: -1, prTitle: 'some pin', updateType: 'pin' },
        { prPriority: -1, prTitle: 'a minor update', updateType: 'minor' },
      ]);
    });

    it('sorts based on isVulnerabilityAlert', async () => {
      const branches = [
        {
          updateType: 'major' as UpdateType,
          prTitle: 'some major update',
          prPriority: 1,
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some pin',
          prPriority: -1,
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some other pin',
          prPriority: 0,
        },
        {
          updateType: 'minor' as UpdateType,
          prTitle: 'a minor update',
          prPriority: -1,
          isVulnerabilityAlert: true,
        },
      ];
      await sortBranches(branches);
      expect(branches).toEqual([
        {
          isVulnerabilityAlert: true,
          prPriority: -1,
          prTitle: 'a minor update',
          updateType: 'minor',
        },
        { prPriority: 1, prTitle: 'some major update', updateType: 'major' },
        { prPriority: 0, prTitle: 'some other pin', updateType: 'pin' },
        { prPriority: -1, prTitle: 'some pin', updateType: 'pin' },
      ]);
    });

    it('sorts based on isVulnerabilityAlert symmetric', async () => {
      const branches = [
        {
          updateType: 'minor' as UpdateType,
          prTitle: 'a minor update',
          prPriority: -1,
          isVulnerabilityAlert: true,
        },
        {
          updateType: 'major' as UpdateType,
          prTitle: 'some major update',
          prPriority: 1,
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some pin',
          prPriority: -1,
        },
        {
          updateType: 'pin' as UpdateType,
          prTitle: 'some other pin',
          prPriority: 0,
        },
      ];
      await sortBranches(branches);
      expect(branches).toEqual([
        {
          isVulnerabilityAlert: true,
          prPriority: -1,
          prTitle: 'a minor update',
          updateType: 'minor',
        },
        { prPriority: 1, prTitle: 'some major update', updateType: 'major' },
        { prPriority: 0, prTitle: 'some other pin', updateType: 'pin' },
        { prPriority: -1, prTitle: 'some pin', updateType: 'pin' },
      ]);
    });

    it('sorts based on existing branch and pr', async () => {
      git.branchExists.mockImplementation((name) => {
        return (
          name === 'closed' || name === 'a' || name === 'd' || name === 'e'
        );
      });

      platform.getBranchPr.mockImplementation(
        (branchName: string): Promise<Pr | null> => {
          if (branchName === 'closed') {
            return Promise.resolve({
              sourceBranch: branchName,
              state: 'closed',
            } as never);
          }

          return branchName === 'd' || branchName === 'e'
            ? Promise.resolve({
                sourceBranch: branchName,
                state: 'open',
              } as never)
            : Promise.resolve(null);
        }
      );

      const branches = [
        {
          branchName: 'closed',
          prPriority: 1,
        },
        {
          branchName: 'a',
          prPriority: 1,
        },
        {
          branchName: 'b',
          prPriority: 1,
        },
        {
          branchName: 'c',
          prPriority: 1,
        },
        {
          branchName: 'd',
          prPriority: 1,
        },
        {
          branchName: 'e',
          prPriority: 1,
        },
        {
          branchName: 'f',
          prPriority: 10,
        },
      ];
      await sortBranches(branches);
      expect(branches).toEqual([
        { branchName: 'f', prPriority: 10 },
        { branchName: 'd', prPriority: 1 },
        { branchName: 'e', prPriority: 1 },
        { branchName: 'a', prPriority: 1 },
        { branchName: 'b', prPriority: 1 },
        { branchName: 'c', prPriority: 1 },
        { branchName: 'closed', prPriority: 1 },
      ]);
    });
  });
});
