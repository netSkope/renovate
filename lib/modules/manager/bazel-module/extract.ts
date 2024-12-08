import { dirname } from 'upath';
import { logger } from '../../../logger';
import { isNotNullOrUndefined } from '../../../util/array';
import { LooseArray } from '../../../util/schema-utils';
import type { PackageDependency, PackageFileContent } from '../types';
import * as bazelrc from './bazelrc';
import type { RecordFragment } from './fragments';
import { parse } from './parser';
import { RuleToMavenPackageDep, fillRegistryUrls } from './parser/maven';
import { RuleToDockerPackageDep } from './parser/oci';
import { RuleToBazelModulePackageDep } from './rules';
import * as rules from './rules';

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  try {
    const records = parse(content);
    const pfc = await extractBazelPfc(records, packageFile);
    const mavenDeps = extractMavenDeps(records);
    const dockerDeps = extractDockerDeps(records, content);

    if (mavenDeps.length) {
      pfc.deps.push(...mavenDeps);
    }

    if (dockerDeps.length) {
      pfc.deps.push(...dockerDeps);
    }

    return pfc.deps.length ? pfc : null;
  } catch (err) {
    logger.debug({ err, packageFile }, 'Failed to parse bazel module file.');
    return null;
  }
}

async function extractBazelPfc(
  records: RecordFragment[],
  packageFile: string,
): Promise<PackageFileContent> {
  const pfc: PackageFileContent = LooseArray(RuleToBazelModulePackageDep)
    .transform(rules.toPackageDependencies)
    .transform((deps) => ({ deps }))
    .parse(records);

  const registryUrls = (await bazelrc.read(dirname(packageFile)))
    // Ignore any entries for custom configurations
    .filter((ce) => ce.config === undefined)
    .map((ce) => ce.getOption('registry')?.value)
    .filter(isNotNullOrUndefined);
  if (registryUrls.length && pfc.deps) {
    pfc.deps.forEach((dep) => {
      if (dep.depType === 'bazel_dep') {
        dep.registryUrls = registryUrls;
      }
    });
  }

  return pfc;
}

function extractMavenDeps(records: RecordFragment[]): PackageDependency[] {
  return LooseArray(RuleToMavenPackageDep)
    .transform(fillRegistryUrls)
    .parse(records);
}

function extractDockerDeps(
  records: RecordFragment[],
  content: string,
): PackageDependency[] {
  let parsedRecords: PackageDependency[] = [];
  for (let i = 0; i < records.length; i++) {
    const parsedItem = LooseArray(RuleToDockerPackageDep).parse([records[i]]);
    if (parsedItem.length == 1) {
      parsedItem[0].replaceString = content.slice(
        records[i].start,
        records[i].end,
      );
    }
    parsedRecords = parsedRecords.concat(parsedItem);
  }
  return parsedRecords;
}
