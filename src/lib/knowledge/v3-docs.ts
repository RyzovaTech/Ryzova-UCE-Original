import type { V3RulePack } from './v3-types';

export function generateV3RuleDocumentation(pack: V3RulePack): string {
  const lines = [`# ${pack.name}`, '', `${pack.description}`, '', `- Pack: \`${pack.id}@${pack.version}\``, `- Publisher: ${pack.publisher}`, `- Schema: v${pack.schemaVersion}`, `- Rules: ${pack.rules.length}`, '', '## Rules', ''];
  for (const rule of [...pack.rules].sort((a, b) => a.id.localeCompare(b.id))) {
    lines.push(`### ${rule.title}`, '', `- ID: \`${rule.id}\``, `- Module: \`${rule.module}\``, `- Severity: \`${rule.severity}\``, `- Confidence: \`${rule.confidence}\``, `- Technologies: ${rule.technologies.map((item) => `\`${item}\``).join(', ')}`, `- Scope: ${rule.scope.map((item) => `\`${item}\``).join(', ')}`, '', rule.description, '', `**Recommendation:** ${rule.recommendation}`, '');
    if (rule.falsePositiveNotes.length) lines.push('**False-positive notes:**', ...rule.falsePositiveNotes.map((item) => `- ${item}`), '');
    if (rule.references.length) lines.push('**References:**', ...rule.references.map((item) => `- ${item}`), '');
  }
  return `${lines.join('\n').trim()}\n`;
}
