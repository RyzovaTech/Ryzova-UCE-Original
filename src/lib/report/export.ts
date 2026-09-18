import type { AnalysisResult } from '../analyzer/types';
import { formatFileSize } from '@/lib/utils';
import { collectWorkspaceFindings } from './workspace';

export function exportJson(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}

export function exportSarif(result: AnalysisResult): string {
  const findings = collectWorkspaceFindings(result);
  const rules = new Map<string, { id: string; name: string; shortDescription: { text: string }; help: { text: string } }>();
  for (const finding of findings) {
    const id = finding.ruleId ?? `${finding.module}.${slug(finding.title)}`;
    if (!rules.has(id)) rules.set(id, { id, name: finding.title, shortDescription: { text: finding.description }, help: { text: finding.recommendation } });
  }
  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'Ryzova UCE', informationUri: 'https://uce.ryzova.com/', version: result.analysisVersion, rules: [...rules.values()] } },
      automationDetails: { id: result.id },
      properties: { project: result.summary.name, localOnly: result.trust?.localOnly ?? true, knowledgePacks: result.trust?.knowledgePacks ?? [] },
      results: findings.map((finding) => ({
        ruleId: finding.ruleId ?? `${finding.module}.${slug(finding.title)}`,
        level: finding.severity === 'critical' ? 'error' : finding.severity === 'warning' ? 'warning' : 'note',
        message: { text: `${finding.description} Recommendation: ${finding.recommendation}` },
        locations: finding.file === 'Project-wide' ? [] : [{ physicalLocation: { artifactLocation: { uri: finding.file.replace(/\\/g, '/') }, region: finding.line ? { startLine: finding.line } : undefined } }],
        properties: { module: finding.module, confidence: finding.confidence, evidence: finding.evidence },
      })),
    }],
  };
  return JSON.stringify(sarif, null, 2);
}

export function exportMarkdown(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push(`# UCE Compatibility Report`);
  lines.push('');
  lines.push(`**Project:** ${result.summary.name}`);
  lines.push(`**Analysis ID:** ${result.id}`);
  lines.push(`**Created:** ${new Date(result.createdAt).toLocaleString()}`);
  lines.push(`**Engine version:** ${result.analysisVersion}`);
  if (result.classification) {
    lines.push(`**Project Type:** ${result.classification.type}`);
  }
  lines.push('');
  if (result.classification && !result.classification.isSoftware) {
    lines.push('## Project Classification');
    lines.push('');
    lines.push(`**Type:** ${result.classification.type}`);
    lines.push('');
    lines.push(`UCE detected this is not a software engineering project. Compatibility analysis requires source code and engineering files.`);
    lines.push('');
    if (result.classification.reason) {
      lines.push(`**Classification reason:** ${result.classification.reason}`);
      lines.push('');
    }
    lines.push('## Project Overview');
    lines.push('');
    lines.push(`- Language: ${result.stack.language}`);
    lines.push(`- Framework: ${result.stack.framework}`);
    lines.push(`- Runtime: ${result.stack.runtime}`);
    lines.push(`- Package Manager: ${result.stack.packageManager}`);
    lines.push(`- Build Tool: ${result.stack.buildTool}`);
    lines.push(`- Files scanned: ${result.summary.filesScanned}`);
    lines.push(`- Folders scanned: ${result.summary.foldersScanned}`);
    if (result.summary.scanStats) {
      lines.push(`- Project size: ${formatFileSize(result.summary.scanStats.projectSize)}`);
      lines.push(`- Files found: ${result.summary.scanStats.filesFound.toLocaleString()}`);
      lines.push(`- Files analyzed: ${result.summary.scanStats.filesAnalyzed.toLocaleString()}`);
      lines.push(`- Files ignored: ${result.summary.scanStats.filesIgnored.toLocaleString()}`);
    }
    lines.push('');
    lines.push('## Recommendations');
    lines.push('');
    for (const note of result.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('_Analysis completed by UCE Engine. Results are generated using deterministic classification rules._');
    return lines.join('\n');
  }
  lines.push('## Overall Compatibility Score');
  lines.push('');
  lines.push(`**${result.score.overall} / 100**`);
  lines.push('');
  lines.push('| Category | Score |');
  lines.push('| --- | --- |');
  for (const cat of result.categories) {
    lines.push(`| ${cat.label} | ${cat.score} |`);
  }
  lines.push('');
  lines.push('## Project Overview');
  lines.push('');
  lines.push(`- Language: ${result.stack.language}`);
  lines.push(`- Framework: ${result.stack.framework}`);
  lines.push(`- Runtime: ${result.stack.runtime}`);
  lines.push(`- Package Manager: ${result.stack.packageManager}`);
  lines.push(`- Build Tool: ${result.stack.buildTool}`);
  lines.push(`- Files scanned: ${result.summary.filesScanned}`);
  lines.push(`- Folders scanned: ${result.summary.foldersScanned}`);
  if (result.summary.scanStats) {
    lines.push(`- Project size: ${formatFileSize(result.summary.scanStats.projectSize)}`);
    lines.push(`- Files found: ${result.summary.scanStats.filesFound.toLocaleString()}`);
    lines.push(`- Files analyzed: ${result.summary.scanStats.filesAnalyzed.toLocaleString()}`);
    lines.push(`- Files ignored: ${result.summary.scanStats.filesIgnored.toLocaleString()}`);
    if (result.summary.scanStats.ignoredCategories.length > 0) {
      lines.push(`- Ignored categories: ${result.summary.scanStats.ignoredCategories.join(', ')}`);
    }
  }
  lines.push('');
  lines.push('## Detected Files');
  lines.push('');
  for (const f of result.detectedFiles) {
    lines.push(`- \`${f.path}\` — ${f.purpose}`);
  }
  lines.push('');
  lines.push('## Issues');
  lines.push('');
  if (result.issues.length === 0) {
    lines.push('_No issues detected._');
  } else {
    for (const issue of result.issues) {
      lines.push(`### [${issue.severity.toUpperCase()}] ${issue.title}`);
      lines.push('');
      lines.push(`- **Category:** ${issue.category}`);
      lines.push(`- **Affected file:** \`${issue.affectedFile}\``);
      lines.push(`- **Description:** ${issue.description}`);
      lines.push(`- **Why it matters:** ${issue.reason}`);
      lines.push(`- **Recommendation:** ${issue.recommendation}`);
      if (issue.detected) lines.push(`- **Detected:** ${issue.detected}`);
      if (issue.expected) lines.push(`- **Expected:** ${issue.expected}`);
      if (issue.impact) lines.push(`- **Impact:** ${issue.impact}`);
      if (issue.suggestedAction) lines.push(`- **Suggested action:** ${issue.suggestedAction}`);
      lines.push('');
    }
  }
  lines.push('## Recommendations');
  lines.push('');
  for (const note of result.notes) {
    lines.push(`- ${note}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('_Analysis completed by UCE Engine. Results are generated using deterministic compatibility rules._');
  return lines.join('\n');
}

export function downloadFile(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
