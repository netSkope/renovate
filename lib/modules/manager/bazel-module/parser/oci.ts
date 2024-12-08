import { query as q } from 'good-enough-parser';
import { z } from 'zod';
import { DockerDatasource } from '../../../datasource/docker';
import type { PackageDependency } from '../../types';
import type { Ctx } from '../context';
import { RecordFragmentSchema, StringFragmentSchema } from '../fragments';
import { kvParams } from './common';

export const RuleToDockerPackageDep = RecordFragmentSchema.extend({
  children: z.object({
    rule: StringFragmentSchema.extend({
      value: z.literal('oci_pull'),
    }),
    name: StringFragmentSchema,
    image: StringFragmentSchema,
    tag: StringFragmentSchema.optional(),
    digest: StringFragmentSchema.optional(),
  }),
}).transform(
  ({ children: { rule, name, image, tag, digest } }): PackageDependency => ({
    datasource: DockerDatasource.id,
    depType: rule.value,
    depName: name.value,
    packageName: image.value,
    currentValue: tag?.value,
    currentDigest: digest?.value,
  }),
);

export const ociRules = q
  .sym<Ctx>('oci', (ctx, token) => {
    ctx.startRule('oci_pull');
    ctx.currentRecord.start = token.offset;
    return ctx;
  })
  .op('.')
  .sym('pull')
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kvParams,
      postHandler: (ctx, tree) => {
        const findLastToken = (node: any) => {
          if (node.children && node.children.length > 0) {
            return findLastToken(node.children[node.children.length - 1]);
          }
          return node;
        };

        const token = findLastToken(tree);
        ctx.currentRecord.end = token.offset + token.value.length + 1;
        ctx.endRule();
        return ctx;
      },
    }),
  );
