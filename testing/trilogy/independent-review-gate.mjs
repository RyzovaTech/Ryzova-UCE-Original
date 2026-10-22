// Pure validation of human-signed/blinded reference votes.
// No solver access and no repository fetching. This cannot invent labels.
const STATUS = new Set(['conflict', 'satisfiable', 'unknown']);
const SIG = /^[a-f0-9]{40}$/;

export function adjudicateBlindReview(corpus, reviews) {
  if (!corpus || !Array.isArray(corpus.cases) || !Array.isArray(reviews))
    return { ready: false, reason: 'invalid-corpus-or-reviews', labels: [] };
  const labels = [], seenCases = new Set();
  for (const entry of corpus.cases) {
    if (seenCases.has(entry.id)) return { ready: false, reason: 'duplicate-case', labels: [] };
    seenCases.add(entry.id);
    if (!SIG.test(entry.commit) || !SIG.test(entry.manifestBlobSha))
      return { ready: false, reason: 'unverified-source-pins', labels: [] };
    const votes = reviews.filter(r => r.caseId === entry.id);
    if (votes.some(r =>
      r.repository !== entry.repository || r.commit !== entry.commit ||
      r.manifestBlobSha !== entry.manifestBlobSha ||
      r.workspace !== entry.workspace ||
      typeof r.reviewerId !== 'string' || !r.reviewerId.trim() ||
      r.blindedToSolverOutput !== true ||
      !STATUS.has(r.label) || typeof r.rationale !== 'string' ||
      r.rationale.trim().length < 20 ||
      typeof r.reviewedAt !== 'string' ||
      Number.isNaN(Date.parse(r.reviewedAt))
    )) return { ready: false, reason: 'invalid-or-unblinded-vote', labels: [] };
    const people = new Set(votes.map(v => v.reviewerId));
    if (people.size !== votes.length)
      return { ready: false, reason: 'duplicate-reviewer-vote', labels: [] };
    const first = votes.filter(v => v.role === 'primary');
    if (first.length !== 2 || first[0].reviewerId === first[1].reviewerId)
      return { ready: false, reason: 'missing-independent-primary-votes', labels: [] };
    const adj = votes.filter(v => v.role === 'adjudicator');
    if (adj.length > 1) return { ready: false, reason: 'excess-adjudication', labels: [] };
    const agree = first[0].label === first[1].label;
    if (!agree && (adj.length !== 1 || first.some(p=>p.reviewerId===adj[0].reviewerId)))
      return { ready: false, reason: 'unresolved-reviewer-disagreement', labels: [] };
    if (agree && adj.length > 0)
      return { ready: false, reason: 'unnecessary-adjudication', labels: [] };
    labels.push({ id: entry.id, label: agree ? first[0].label : adj[0].label });
  }
  if (reviews.some(r => !seenCases.has(r.caseId)))
    return { ready: false, reason: 'review-references-unknown-case', labels: [] };
  return { ready: true, reason: null, labels };
}
