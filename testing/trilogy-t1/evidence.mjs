/**
 * Trilogy T1: read-only, source-byte-level evidence adjudication.
 * This verifies a narrowly defined literal-source predicate, NOT a
 * security vulnerability, incompatibility, causality, runtime or patch.
 *
 * It never imports/executes scanned source or native solver binaries.
 */
import { createHash } from 'node:crypto';
import { canonicalEvidenceHash } from '../trilogy-t0/safety.mjs';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { describeReportReadiness } = load('src/lib/report/readiness.ts');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const HEX64 = /^[a-f0-9]{64}$/;
const SAFE_PATH = /^[a-zA-Z0-9_.@/-]{1,512}$/;
const MAX_FILES = 5000, MAX_ISSUES = 5000, MAX_ASSERTIONS = 5000;
const MAX_FILE_BYTES = 256 * 1024, MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_FRAGMENT = 160;
const STATES = ['source-referenced', 'independently-checked-in-scope', 'disputed', 'unknown'];
function validPath(path) {
  return typeof path === 'string' && SAFE_PATH.test(path) &&
    !path.startsWith('/') && path.split('/').every(s => s && s !== '.' && s !== '..');
}
function parsedLocation(value) {
  if (typeof value !== 'string') return null;
  const found = /(?::(\d+)|#L(\d+))$/.exec(value);
  const file = found ? value.slice(0, found.index) : value;
  if (!validPath(file)) return null;
  const line = found ? Number(found[1] ?? found[2]) : null;
  if (line !== null && (!Number.isSafeInteger(line) || line < 1 || line > 100000)) return null;
  return {file, line};
}
function validAssertion(a, id, path, line) {
  return a && typeof a === 'object' && !Array.isArray(a) &&
    a.findingId === id && a.predicate === 'literal-source-fragment-at-line' &&
    a.file === path && Number.isSafeInteger(a.line) && a.line >= 1 &&
    a.line <= 100000 && (line === null || a.line === line) &&
    typeof a.fragment === 'string' && a.fragment.length > 0 &&
    a.fragment.length <= MAX_FRAGMENT && !/[\r\n\x00-\x1f\x7f]/.test(a.fragment) &&
    typeof a.sourceSha256 === 'string' && HEX64.test(a.sourceSha256);
}
function failSafe(status, reason) {
  return {status, reason, checkedPredicate: null, automaticFixAllowed: false,
    compatibilityVerified: false, findingCorrectnessVerified: false};
}

/**
 * Content input MUST be the source snapshot used for the UCE scan. A caller
 * must authenticate/pin that snapshot separately; T1 does not do network I/O.
 * Evidence assertions are independently tested against bytes by this reader.
 */
export function adjudicateEvidence(report, sourceFiles, assertions = []) {
  const original = JSON.stringify(report);
  const projectHash = canonicalEvidenceHash(report);
  if (!Array.isArray(sourceFiles) || sourceFiles.length > MAX_FILES ||
      !Array.isArray(assertions) || assertions.length > MAX_ASSERTIONS ||
      report.issues.length > MAX_ISSUES) throw Error('T1 evidence resource budget exceeded or malformed');
  const files = new Map();
  let totalBytes = 0;
  for (const f of sourceFiles) {
    if (!f || !validPath(f.path) || files.has(f.path) || f.isDirectory === true)
      throw Error('T1 source inventory invalid or ambiguous');
    const readable = typeof f.content === 'string' && f.content.length <= MAX_FILE_BYTES;
    const bytes = readable ? Buffer.byteLength(f.content, 'utf8') : null;
    if (bytes !== null && bytes <= MAX_FILE_BYTES) {
      totalBytes += bytes;
      if (totalBytes > MAX_TOTAL_BYTES) throw Error('T1 source byte budget exceeded');
    }
    files.set(f.path, {content: bytes !== null && bytes <= MAX_FILE_BYTES ? f.content : null});
  }
  const evidenceById = new Map(), duplicateAssertions = new Set(), seen = new Set();
  for (const assertion of assertions) {
    const id = assertion?.findingId;
    if (typeof id !== 'string' || id.length < 1 || id.length > 256)
      throw Error('T1 assertion has invalid finding identity');
    if (evidenceById.has(id)) duplicateAssertions.add(id);
    else evidenceById.set(id, assertion);
  }
  const candidates = [...report.issues].map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 256 ||
        seen.has(item.id)) throw Error('T1 canonical issue identities invalid or duplicated');
    seen.add(item.id);
    const location = parsedLocation(item.affectedFile);
    const evidence = evidenceById.get(item.id);
    const reference = location && files.get(location.file);
    let evaluation;
    if (!location) evaluation = failSafe('unknown','missing-or-invalid-source-location');
    else if (!reference) evaluation = failSafe('unknown','source-outside-supplied-inventory');
    else if (reference.content === null) evaluation = failSafe('unknown','source-unreadable-or-over-budget');
    else if (duplicateAssertions.has(item.id)) evaluation = failSafe('unknown','ambiguous-evidence-assertions');
    else if (evidence === undefined) evaluation = failSafe('source-referenced','source-path-reopened-no-independent-predicate');
    else if (!validAssertion(evidence,item.id,location.file,location.line)) evaluation = failSafe('unknown','untrusted-or-malformed-evidence-predicate');
    else if (sha256(reference.content) !== evidence.sourceSha256) evaluation = failSafe('unknown','source-snapshot-hash-mismatch');
    else {
      const line = reference.content.split(/\r\n|\r|\n/)[evidence.line-1];
      if (line === undefined || !line.includes(evidence.fragment))
        evaluation = failSafe('disputed','pinned-literal-assertion-not-present');
      else evaluation = {
        ...failSafe('independently-checked-in-scope','pinned-literal-assertion-present'),
        checkedPredicate:'literal-source-fragment-at-line',
      };
    }
    // Even a locally matching fragment is NOT independently certified while
    // the underlying UCE scan is incomplete or a rule threw.
    if (evaluation.status === 'independently-checked-in-scope' &&
       (describeReportReadiness(report).partial || report.classification?.isSoftware === false)) {
      evaluation = failSafe('source-referenced','local-fragment-matched-but-scan-incomplete');
    }
    return {findingIdSha256:sha256(item.id), ...evaluation};
  }).sort((a,b)=>a.findingIdSha256.localeCompare(b.findingIdSha256));
  const orphanEvidenceRecords = [...evidenceById.keys()].filter(id => !seen.has(id)).length;
  const counts = Object.fromEntries(STATES.map(s => [s,candidates.filter(c => c.status === s).length]));
  const result = {
    schemaVersion:1, stage:'Trilogy-T1', mode:'read-only-local-source-check',
    canonicalEvidenceSha256:projectHash,
    origin:'UCE', independentTrilogyDetector:'not-run',
    sourceSnapshotAuthenticated:'not-established-by-T1',
    originalIssueCount:report.issues.length, originalRawScore:report.score.overall,
    modifiedCanonicalScore:false, modifiedCanonicalIssues:false,
    scope:describeReportReadiness(report).partial ? 'partial' : 'static-assessed-scope',
    counts, orphanEvidenceRecords, findings:candidates,
    verifiedCompatibilities:0, verifiedVulnerabilities:0,
    independentAccuracy:null, recommendationCorrectness:null,
    recommendationAutoApply:false, generatedPatches:0,
    limitations:[
      'Only literal presence at a pinned line in supplied local source bytes is checked; the underlying source snapshot must be independently authenticated.',
      'A matching literal is not proof of an issue, impact, root cause, patch safety, compatibility or successful runtime execution.',
      'Disputed means the narrow pinned literal assertion failed, not that the original UCE finding was disproved.',
      'Unknown and partial findings must never be promoted to verified or safe-to-fix.',
      'Origin remains UCE. T1 source checking is not an independently implemented Trilogy vulnerability detector.',
    ],
  };
  if (JSON.stringify(report) !== original) throw Error('T1 mutated the original canonical UCE report');
  return result;
}
