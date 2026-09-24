import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const nativeRequire = createRequire(import.meta.url);
function loadRulePacks() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'uce-rule-docs-'));
  try {
    fs.writeFileSync(path.join(temporary, 'package.json'), '{"type":"commonjs"}');
    const entries = ['v3-phase2-packs.ts', 'v3-phase3-packs.ts', 'v3-phase4-packs.ts', 'v3-phase5-packs.ts'].map(name => path.join(root, 'src/lib/knowledge', name));
    const program = ts.createProgram(entries, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, moduleResolution: ts.ModuleResolutionKind.Node10, rootDir: root, outDir: temporary, esModuleInterop: true, skipLibCheck: true });
    const emit = program.emit();
    if (emit.emitSkipped) throw new Error('Unable to compile the trusted Phase 2 rule catalog for documentation.');
    return { ...nativeRequire(path.join(temporary, 'src/lib/knowledge/v3-phase2-packs.js')),
      ...nativeRequire(path.join(temporary, 'src/lib/knowledge/v3-phase3-packs.js')),
      ...nativeRequire(path.join(temporary, 'src/lib/knowledge/v3-phase4-packs.js')),
      ...nativeRequire(path.join(temporary, 'src/lib/knowledge/v3-phase5-packs.js')) };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

const pack = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/knowledge/packs/v3-core.json'), 'utf8'));
const lines = [`# ${pack.name}`, '', pack.description, '', `- Pack: \`${pack.id}@${pack.version}\``, `- Publisher: ${pack.publisher}`, `- Schema: v${pack.schemaVersion}`, `- Rules: ${pack.rules.length}`, '', '## Rules', ''];
for (const rule of [...pack.rules].sort((left, right) => left.id.localeCompare(right.id))) {
  lines.push(`### ${rule.title}`, '', `- ID: \`${rule.id}\``, `- Module: \`${rule.module}\``, `- Severity: \`${rule.severity}\``, `- Confidence: \`${rule.confidence}\``, `- Technologies: ${rule.technologies.map((item) => `\`${item}\``).join(', ')}`, `- Scope: ${rule.scope.map((item) => `\`${item}\``).join(', ')}`, '', rule.description, '', `**Recommendation:** ${rule.recommendation}`, '');
  if (rule.falsePositiveNotes.length) lines.push('**False-positive notes:**', ...rule.falsePositiveNotes.map((item) => `- ${item}`), '');
  if (rule.references.length) lines.push('**References:**', ...rule.references.map((item) => `- ${item}`), '');
}
const output = path.join(root, 'docs', 'generated', 'V3_CORE_RULES.md'); fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${lines.join('\n').trim()}\n`);

const { V3_PHASE2_RULE_PACKS, V3_PHASE2_RULE_COUNT, V3_TOTAL_CORE_RULE_TARGET, V3_PHASE3_RULE_PACKS, V3_PHASE3_RULE_COUNT, V3_PHASE3_TOTAL_TARGET, V3_PHASE4_RULE_PACKS, V3_PHASE4_RULE_COUNT, V3_PHASE4_TOTAL_TARGET, V3_PHASE5_RULE_PACKS, V3_PHASE5_RULE_COUNT, V3_PHASE5_TOTAL_TARGET } = loadRulePacks();
const phase2Lines = [
  '# UCE V3 Phase 2 Rule Catalog', '',
  'Generated index for the first 3,000 validated V3 core rules. Runtime packs are compiled from versioned, reviewable knowledge definitions; this document is an index rather than executable input.', '',
  `- Phase 2 rules: ${V3_PHASE2_RULE_COUNT.toLocaleString('en-US')}`,
  `- Bootstrap rules: ${pack.rules.length.toLocaleString('en-US')}`,
  `- Total core inventory: ${V3_TOTAL_CORE_RULE_TARGET.toLocaleString('en-US')}`,
  `- Packs: ${V3_PHASE2_RULE_PACKS.length + 1}`, '',
  '## Pack allocation', '', '| Pack | Rules | Modules | Technology labels |', '| --- | ---: | --- | ---: |',
];
for (const item of V3_PHASE2_RULE_PACKS) phase2Lines.push(`| \`${item.id}\` | ${item.rules.length} | ${item.modules.join(', ')} | ${item.technologies.length} |`);
phase2Lines.push('', '## Rule index', '', '| Rule ID | Pack | Module | Severity | Confidence |', '| --- | --- | --- | --- | --- |');
for (const item of V3_PHASE2_RULE_PACKS) for (const rule of [...item.rules].sort((left, right) => left.id.localeCompare(right.id))) phase2Lines.push(`| \`${rule.id}\` | \`${item.id}\` | ${rule.module} | ${rule.severity} | ${rule.confidence} |`);
const phase2Output = path.join(root, 'docs', 'generated', 'V3_PHASE2_RULES.md');
fs.writeFileSync(phase2Output, `${phase2Lines.join('\n').trim()}\n`);
const phase3Lines = [
  '# UCE V3 Phase 3 Rule Catalog', '',
  'Generated from the executable deep ecosystem packs. A rule is a bounded static check, not a certified vulnerability or a promise of runtime compatibility.', '',
  `- Phase 3 rules: ${V3_PHASE3_RULE_COUNT.toLocaleString('en-US')}`,
  `- Total V3 inventory: ${V3_PHASE3_TOTAL_TARGET.toLocaleString('en-US')}`,
  `- Phase 3 packs: ${V3_PHASE3_RULE_PACKS.length}`, '',
  '| Pack | Rules | Modules |', '| --- | ---: | --- |',
];
for (const pack of V3_PHASE3_RULE_PACKS) phase3Lines.push(`| \`${pack.id}\` | ${pack.rules.length} | ${pack.modules.join(', ')} |`);
phase3Lines.push('', '## Rule index', '', '| Rule ID | Pack | Module | Severity | Confidence |', '| --- | --- | --- | --- | --- |');
for (const pack of V3_PHASE3_RULE_PACKS) for (const rule of [...pack.rules].sort((a, b) => a.id.localeCompare(b.id)))
  phase3Lines.push(`| \`${rule.id}\` | \`${pack.id}\` | ${rule.module} | ${rule.severity} | ${rule.confidence} |`);
const phase3Output = path.join(root, 'docs', 'generated', 'V3_PHASE3_RULES.md');
fs.writeFileSync(phase3Output, `${phase3Lines.join('\n').trim()}\n`);
const phase4Lines = [
  '# UCE V3 Phase 4 Correlation Rule Catalog', '',
  'Generated from executable evidence-linked packs. Static correlations are review signals, not proven vulnerabilities or complete data flow.', '',
  '- Phase 4 rules: ' + V3_PHASE4_RULE_COUNT.toLocaleString('en-US'),
  '- Total V3 inventory: ' + V3_PHASE4_TOTAL_TARGET.toLocaleString('en-US'),
  '- Phase 4 packs: ' + V3_PHASE4_RULE_PACKS.length, '',
  '| Pack | Rules | Modules |', '| --- | ---: | --- |',
];
for (const item of V3_PHASE4_RULE_PACKS) phase4Lines.push('| ' + item.id + ' | ' + item.rules.length + ' | ' + item.modules.join(', ') + ' |');
phase4Lines.push('', '## Rule index', '', '| Rule ID | Module | Evidence mode |', '| --- | --- | --- |');
for (const item of V3_PHASE4_RULE_PACKS) for (const entry of [...item.rules].sort((a, b) => a.id.localeCompare(b.id)))
  phase4Lines.push('| ' + entry.id + ' | ' + entry.module + ' | ' + entry.detectors[0].kind + ' |');
const phase4Output = path.join(root, 'docs/generated/V3_PHASE4_RULES.md');
fs.writeFileSync(phase4Output, phase4Lines.join('\n').trim() + '\n');
const phase5Lines = [
  '# UCE V3 Phase 5 Rule Catalog', '',
  'Executable static version-declaration review rules. An entry does not establish a vulnerability or breakage.', '',
  '- Phase 5 rules: ' + V3_PHASE5_RULE_COUNT.toLocaleString('en-US'),
  '- Total V3 inventory: ' + V3_PHASE5_TOTAL_TARGET.toLocaleString('en-US'),
  '- Phase 5 packs: ' + V3_PHASE5_RULE_PACKS.length, '',
  '| Rule ID | Pack | Policy |', '| --- | --- | --- |',
];
for (const item of V3_PHASE5_RULE_PACKS) for (const entry of [...item.rules].sort((a, b) => a.id.localeCompare(b.id)))
  phase5Lines.push('| ' + entry.id + ' | ' + item.id + ' | ' + (entry.tags?.at(-1) ?? 'review') + ' |');
const phase5Output = path.join(root, 'docs/generated/V3_PHASE5_RULES.md');
fs.writeFileSync(phase5Output, phase5Lines.join('\n').trim() + '\n');
console.log(JSON.stringify({ outputs: [path.relative(root, output), path.relative(root, phase2Output), path.relative(root, phase3Output), path.relative(root, phase4Output)],
  rules: V3_PHASE5_TOTAL_TARGET, phase5Packs: V3_PHASE5_RULE_PACKS.length, phase5Output: path.relative(root, phase5Output) }));
