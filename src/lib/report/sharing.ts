export interface ShareableReport {
  id: string;
  createdAt: string;
  analysisVersion: string;
  projectName: string;
  projectType: string;
  isSoftware: boolean;
  overallScore: number;
  issueCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  source: string;
  projectSize: number;
  filesFound: number;
  filesAnalyzed: number;
  filesIgnored: number;
}

export interface PortableReportSummary extends ShareableReport { schemaVersion: 1; trust: { localOnly: boolean; networkAccessUsed: boolean; limitations: string[] }; }

export function createPortableReportSummary(report: import('../analyzer/types').AnalysisResult): PortableReportSummary {
  const findings = report.issues;
  return {
    schemaVersion: 1,
    id: report.id,
    createdAt: report.createdAt,
    analysisVersion: report.analysisVersion,
    projectName: report.summary.name,
    projectType: report.classification.type,
    isSoftware: report.classification.isSoftware,
    overallScore: report.score.overall,
    issueCount: findings.length,
    criticalCount: findings.filter((item) => item.severity === 'critical').length,
    warningCount: findings.filter((item) => item.severity === 'warning').length,
    infoCount: findings.filter((item) => item.severity === 'info').length,
    source: report.source,
    projectSize: report.summary.scanStats.projectSize,
    filesFound: report.summary.scanStats.filesFound,
    filesAnalyzed: report.summary.scanStats.filesAnalyzed,
    filesIgnored: report.summary.scanStats.filesIgnored,
    trust: { localOnly: report.trust?.localOnly ?? true, networkAccessUsed: report.trust?.networkAccessUsed ?? false, limitations: report.trust?.limitations ?? [] },
  };
}

/** Creates a source-free, URL-fragment-safe summary. No server upload occurs. */
export function encodePortableReport(report: import('../analyzer/types').AnalysisResult): string {
  const bytes = new TextEncoder().encode(JSON.stringify(createPortableReportSummary(report)));
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodePortableReport(value: string): PortableReportSummary {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<PortableReportSummary>;
  if (parsed.schemaVersion !== 1 || !parsed.id || !parsed.projectName || typeof parsed.overallScore !== 'number') throw new Error('Invalid portable UCE report summary.');
  return parsed as PortableReportSummary;
}
