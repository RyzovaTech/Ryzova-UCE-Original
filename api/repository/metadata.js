/**
 * Public repository metadata relay for the ORIGINAL UCE web analyzer.
 * Targets are hardcoded GitLab and Codeberg APIs, never caller-supplied URLs.
 * This endpoint does not download or persist repository source.
 */
const SEGMENT = /^[A-Za-z0-9_.-]+$/;
const MAX_RESPONSE = 256 * 1024;

export function getPublicMetadataTarget(provider, sourcePath) {
  if (provider !== 'gitlab' && provider !== 'codeberg') throw Error('Unknown Git provider');
  if (typeof sourcePath !== 'string' || sourcePath.length > 300 || sourcePath.includes('%') ||
      sourcePath.includes('\\') || /[\x00-\x1f\x7f]/.test(sourcePath)) throw Error('Invalid repository path');
  const parts = sourcePath.split('/');
  if (parts.length < 2 || parts.length > (provider === 'gitlab' ? 8 : 2) ||
      parts.some(p => !SEGMENT.test(p) || p === '.' || p === '..' || p === '-'))
    throw Error('Invalid repository namespace');
  return provider === 'gitlab'
    ? 'https://gitlab.com/api/v4/projects/' + encodeURIComponent(sourcePath)
    : 'https://codeberg.org/api/v1/repos/' + parts.map(encodeURIComponent).join('/');
}
export function normalizePublicMetadata(provider, value) {
  if (!value || typeof value !== 'object' ||
      typeof value.default_branch !== 'string' || !value.default_branch) {
    throw Error('Repository metadata is missing a default branch');
  }
  if (provider === 'gitlab') {
    if (!Number.isSafeInteger(value.id) || value.id < 1 || value.visibility !== 'public')
      throw Error('Only public GitLab repositories are supported');
  } else if (value.private !== false || value.empty === true) {
    throw Error('Only nonempty public Codeberg repositories are supported');
  }
  return { default_branch: value.default_branch,
    ...(provider === 'gitlab' ? { id: value.id } : {}) };
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow','GET');res.status(405).json({error:'Method not allowed'});return;
  }
  const provider=req.query?.provider, sourcePath=req.query?.path;
  if (typeof provider !== 'string' || typeof sourcePath !== 'string') {
    res.status(400).json({error:'Invalid repository parameters'});return;
  }
  let upstream;
  try { upstream = getPublicMetadataTarget(provider,sourcePath); }
  catch { res.status(400).json({error:'Invalid or unsupported public repository'});return; }
  try {
    const response=await fetch(upstream,{
      headers:{'Accept':'application/json','User-Agent':'RYZOVA-UCE-public-repository-metadata'},
      redirect:'error',signal:AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      res.status([403,404,429].includes(response.status)?response.status:502)
        .json({error:'Public repository metadata unavailable'});return;
    }
    const length=Number(response.headers.get('content-length')??0);
    if (length>MAX_RESPONSE) throw Error('Repository metadata response too large');
    const raw=await response.text();
    if (raw.length>MAX_RESPONSE) throw Error('Repository metadata response too large');
    const metadata=normalizePublicMetadata(provider,JSON.parse(raw));
    res.status(200).json(metadata);
  } catch {
    res.status(502).json({error:'Could not verify the public repository'});
  }
}
