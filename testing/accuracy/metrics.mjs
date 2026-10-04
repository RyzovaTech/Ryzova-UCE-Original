// Metrics accept only labeled decisions; unknown labels are never true negatives.
export const percent = (part, total) => total ? Math.round(part / total * 10000) / 100 : null;
export function wilson95(successes, total) {
  if (!total) return null;
  const z2 = 1.96 ** 2, p = successes / total, d = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / d;
  const spread = 1.96 * Math.sqrt(p * (1 - p) / total + z2 / (4 * total ** 2)) / d;
  return [percent(Math.max(0, center - spread), 1), percent(Math.min(1, center + spread), 1)];
}
export function decisionMetrics(rows) {
  for (const row of rows) {
    if (!['boolean', 'string'].includes(typeof row.expected) || typeof row.actual !== typeof row.expected)
      throw Error(`Invalid decision types: ${row.id}`);
  }
  const binary = rows.filter(row => typeof row.expected === 'boolean');
  const tp = binary.filter(row => row.expected && row.actual).length;
  const fp = binary.filter(row => !row.expected && row.actual).length;
  const fn = binary.filter(row => row.expected && !row.actual).length;
  const tn = binary.filter(row => !row.expected && !row.actual).length;
  const correct = rows.filter(row => row.expected === row.actual).length;
  return { cases: rows.length, binaryCases: binary.length, categoricalCases: rows.length - binary.length,
    correct, decisionAccuracy: percent(correct, rows.length), decisionWilson95: wilson95(correct, rows.length),
    tp, fp, fn, tn, precision: percent(tp, tp + fp), precisionWilson95: wilson95(tp, tp + fp),
    recall: percent(tp, tp + fn), recallWilson95: wilson95(tp, tp + fn), falsePositiveRate: percent(fp, fp + tn) };
}
export function groupMetrics(rows, key) {
  return Object.fromEntries([...new Set(rows.map(row => row[key]))].sort().map(value =>
    [value, decisionMetrics(rows.filter(row => row[key] === value))]));
}
export function checkRegression(baseline, report) {
  if (baseline.corpusSha256 !== report.corpusSha256) throw Error('Corpus changed: review labels before recording a new baseline.');
  const prior = new Map(baseline.results.map(row => [row.id, row]));
  if (prior.size !== baseline.results.length || prior.size !== report.results.length) throw Error('Baseline decision IDs changed.');
  const regressions = report.results.filter(row => {
    const previous = prior.get(row.id);
    if (!previous || previous.expected !== row.expected) throw Error(`Baseline label changed: ${row.id}`);
    return previous.passed && !row.passed;
  });
  if (regressions.length) throw Error(`Accuracy regressions: ${regressions.map(row => row.id).join(', ')}`);
}
