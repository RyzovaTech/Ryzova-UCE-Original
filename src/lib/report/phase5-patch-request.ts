/**
 * Browser-only, explicit-click *request preparation*, not an automatic fix.
 * Actual source-hashed semver validation and diff preview run in the opt-in
 * local Node CLI. No code execution, network, file writes or "verified" claim.
 */
export interface BrowserEvidenceBundle {
  fileName?: string;
  workspace?: string;
  files: Array<{ path: string; content: string; size?: number; isDirectory?: boolean }>;
}
export interface BrowserProposalRequest {
  action: 'generate-fix-proposal';
  targetFile: '.nvmrc' | '.node-version';
  targetVersion: string;
  expectedSha256: string;
}
const canonicalPath = (s: unknown): s is string => typeof s === 'string' &&
  s.length > 0 && s.length <= 160 &&
  /^[a-zA-Z0-9_.@/-]+$/.test(s) &&
  s.split('/').every(part => part !== '..' && part !== '.' && !!part);
const stable = (v: string) => /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(v) &&
  v.split('.').every(n => Number.isSafeInteger(Number(n)) && Number(n) <= 1000000);

export function validateBrowserEvidenceBundle(data: unknown): BrowserEvidenceBundle {
  if (!data || typeof data !== 'object') throw Error('Invalid local evidence JSON.');
  const item = data as Partial<BrowserEvidenceBundle>;
  if (Object.keys(item).some(key => !['fileName', 'workspace', 'files'].includes(key)) ||
      (item.fileName !== undefined && (typeof item.fileName !== 'string' ||
        item.fileName.length < 1 || item.fileName.length > 100))) {
    throw Error('Evidence JSON must contain only a bounded name, workspace and files; remove saved requests or extra fields.');
  }
  if ((item.workspace ?? '') !== '' || !Array.isArray(item.files) ||
      item.files.length < 3 || item.files.length > 64) {
    throw Error('V1 supports root npm evidence with 3–64 files and no workspace override.');
  }
  const seen = new Set<string>();
  let total = 0;
  for (const f of item.files) {
    if (!f || !canonicalPath(f.path) || typeof f.content !== 'string' ||
        f.isDirectory === true || seen.has(f.path)) throw Error('Unsafe, missing or duplicate source file.');
    seen.add(f.path);
    total += new TextEncoder().encode(f.content).length;
    if (total > 2500 * 1024 || f.content.length > 1024 * 1024)
      throw Error('Evidence is over the bounded local input budget.');
  }
  if (!seen.has('package.json') || !seen.has('package-lock.json'))
    throw Error('Both root package.json and package-lock.json are required.');
  const pins = item.files.filter(f => f.path === '.nvmrc' || f.path === '.node-version');
  if (pins.length !== 1 || pins[0].content.length > 128 ||
      !/^[ \t]*v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)[ \t]*(?:\r?\n)?$/.test(pins[0].content))
    throw Error('Supply exactly one literal .nvmrc or .node-version source pin.');
  // Never copy unreviewed top-level fields or per-file metadata into the
  // exported CLI input. In particular, reject previously embedded requests.
  return {
    ...(item.fileName ? { fileName: item.fileName } : {}),
    workspace: '',
    files: item.files.map(f => ({ path: f.path, content: f.content })),
  };
}
export async function makeDeveloperPatchRequest(data: BrowserEvidenceBundle, targetVersion: string) {
  const checked = validateBrowserEvidenceBundle(data);
  if (!stable(targetVersion)) throw Error('Choose an exact stable Node version, e.g. 22.0.0.');
  const file = checked.files.find(f => f.path === '.nvmrc' || f.path === '.node-version')!;
  const original = file.content.trim().replace(/^v/, '');
  if (targetVersion === original) throw Error('Requested target already matches the existing pin.');
  if (!globalThis.crypto?.subtle) throw Error('Secure SHA-256 hashing is unavailable in this browser.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(file.content));
  const expectedSha256 = [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const request: BrowserProposalRequest = {
    action: 'generate-fix-proposal',
    targetFile: file.path as '.nvmrc' | '.node-version',
    targetVersion, expectedSha256,
  };
  return {
    request,
    review: {
      targetFile: file.path,
      originalVersion: original,
      targetVersion,
      sourceSha256: expectedSha256,
      riskLevel: 'requires-manual-review' as const,
      riskFactors: [
        'The browser has not established that the target satisfies the full dependency graph.',
        'CI, deployment, framework support, installation, build and runtime behavior are not tested.',
        'The downloaded evidence JSON contains source contents and may be confidential.',
      ],
      verificationChecklist: [
        'Verify the intended source file, target version and SHA-256.',
        'Run the separate guarded Node CLI locally; inspect its blocked/proposed status and diff.',
        'Review runtime and CI/deployment compatibility before any manually approved change.',
        'After manual application, run builds/tests and compare UCE scans.',
      ],
    },
    // Exact original bytes and request are provided to the local CLI only if
    // the developer explicitly downloads this bundle, never auto-submitted.
    cliInput: { ...checked, request },
    note: 'Request prepared locally; no patch generated, applied or solver verified. Run the Node-only experimental propose CLI to obtain a guarded reviewable diff.',
  };
}