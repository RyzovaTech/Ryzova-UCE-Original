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
