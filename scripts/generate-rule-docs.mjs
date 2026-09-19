import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pack = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/knowledge/packs/v3-core.json'), 'utf8'));
const lines = [`# ${pack.name}`, '', pack.description, '', `- Pack: \`${pack.id}@${pack.version}\``, `- Publisher: ${pack.publisher}`, `- Schema: v${pack.schemaVersion}`, `- Rules: ${pack.rules.length}`, '', '## Rules', ''];
for (const rule of [...pack.rules].sort((left, right) => left.id.localeCompare(right.id))) {
  lines.push(`### ${rule.title}`, '', `- ID: \`${rule.id}\``, `- Module: \`${rule.module}\``, `- Severity: \`${rule.severity}\``, `- Confidence: \`${rule.confidence}\``, `- Technologies: ${rule.technologies.map((item) => `\`${item}\``).join(', ')}`, `- Scope: ${rule.scope.map((item) => `\`${item}\``).join(', ')}`, '', rule.description, '', `**Recommendation:** ${rule.recommendation}`, '');
  if (rule.falsePositiveNotes.length) lines.push('**False-positive notes:**', ...rule.falsePositiveNotes.map((item) => `- ${item}`), '');
  if (rule.references.length) lines.push('**References:**', ...rule.references.map((item) => `- ${item}`), '');
}
const output = path.join(root, 'docs', 'generated', 'V3_CORE_RULES.md'); fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${lines.join('\n').trim()}\n`);
console.log(JSON.stringify({ output: path.relative(root, output), rules: pack.rules.length }));
