import { createRequire } from 'node:module';

// The holdout's semantic oracle uses npm semver and frozen contradictions /
// witnesses; it never invokes Souffle, Z3, cvc5 or UCE's classifications.
const solverPackageRequire = createRequire(new URL('../../experiments/datalog-z3/package.json', import.meta.url));
const semver = solverPackageRequire('semver');
const statuses = new Set(['conflict','satisfiable','unknown']);
const finite = n => Math.round(n * 10000) / 10000;

export function makeFiles(entry) {
  if (!entry || typeof entry.id !== 'string') throw Error('Holdout case invalid');
  const m = entry.mutations ?? {};
  const dep = m.scoped ? '@evaluation/alpha' : 'alpha';
  const prefix = m.workspace ? 'apps/api/' : '';
  const direct = { [dep]: m.workspaceAlias ? 'workspace:*' : '^1.0.0' };
  const alphaDeps = { beta: '^2.0.0' };
  const root = { name: 'holdout-project', version: '1.0.0' };
  if (entry.engines.root !== null) root.engines = { node: entry.engines.root };
  if (!m.noDependencies) root.dependencies = direct;
  const lockRoot = { name: 'holdout-project', version: '1.0.0' };
  if (!m.noDependencies) lockRoot.dependencies = m.staleRoot ? { [dep]: '^2.0.0' } : direct;
  const alpha = {
    version: m.mismatchVersion ? '2.0.0' : '1.2.0',
    engines: { node: entry.engines.alpha },
    dependencies: alphaDeps,
  };
  const beta = { version: '2.1.0', engines: { node: entry.engines.beta } };
  if (m.cycle) beta.dependencies = { [dep]: '^1.0.0' };
  if (m.noLockedVersion) delete alpha.version;
  const lock = {
    lockfileVersion: m.lockV4 ? 4 : 3,
    packages: {
      '': lockRoot,
      ['node_modules/' + dep]: alpha,
      'node_modules/beta': beta,
    },
  };
  if (m.unusedEngine) lock.packages['node_modules/unused'] = {
    version:'8.1.0', engines:{ node:m.unusedEngine },
  };
  if (m.nested) lock.packages['node_modules/alpha/node_modules/beta'] = { version:'2.1.0' };
  if (m.missingBeta) delete lock.packages['node_modules/beta'];
  const f = (path, content) => ({path, content, isDirectory:false, size:Buffer.byteLength(content)});
  const files = [f(prefix+'package.json', JSON.stringify(root))];
  if (!m.missingLock) files.push(f(prefix+'package-lock.json',m.malformedLock ? '{broken json' : JSON.stringify(lock)));
  if (m.sibling) {
    files.push(f('apps/web/package.json',JSON.stringify({name:'different-project',engines:{node:'<10'}})));
    files.push(f('apps/web/package-lock.json',JSON.stringify({
      lockfileVersion:3,packages:{'':{name:'different-project',version:'1.0.0'}},
    })));
  }
  return { workspace:m.workspace?'apps/api':'', files };
}

export function validateHoldout(corpus) {
  if (corpus?.schema !== 'uce-trilogy-heldout-v1' ||
      corpus.provenance?.humanReviewed !== false ||
      corpus.provenance?.realWorldRepositorySample !== false ||
      !Array.isArray(corpus.cases) || corpus.cases.length !== 40) {
    throw Error('Frozen provenance or corpus structure invalid');
  }
  const ids = new Set();
  const count = { conflict:0, satisfiable:0, unknown:0 };
  for (const entry of corpus.cases) {
    if (!/^[CSU]\d\d$/.test(entry.id) || ids.has(entry.id) ||
        !statuses.has(entry.label) || typeof entry.title !== 'string' ||
        entry.title.length < 4 || !entry.certificate ||
        !entry.engines || typeof entry.engines !== 'object') {
      throw Error('Invalid holdout label/provenance: '+entry.id);
    }
    ids.add(entry.id); count[entry.label]++;
    if (entry.label === 'satisfiable') {
      const witness = entry.certificate.witness;
      if (!semver.valid(witness) ||
          !Object.values(entry.engines).filter(x=>x!==null).every(r => semver.satisfies(witness,r))) {
        throw Error('SAT witness fails independent semver oracle: '+entry.id);
      }
    }
    if (entry.label === 'conflict') {
      if (entry.certificate.disjoint) {
        const [a,b]=entry.certificate.disjoint;
        if (typeof entry.engines[a]!=='string' || typeof entry.engines[b]!=='string' ||
            semver.intersects(entry.engines[a],entry.engines[b],{includePrerelease:false})) {
          throw Error('Conflict certificate has overlapping ranges: '+entry.id);
        }
      } else if (entry.certificate.finiteDomains) {
        const data=entry.certificate.finiteDomains;
        if (Object.keys(data).length !== 3 ||
            !Object.keys(data).every(x => Array.isArray(data[x]) &&
              data[x].every(major => semver.satisfies(major+'.0.0', entry.engines[x]))) ||
            data.root.some(n => data.alpha.includes(n) && data.beta.includes(n))) {
          throw Error('Joint finite-domain UNSAT certificate invalid: '+entry.id);
        }
        // The certified finite ranges are exact majors; do not generalize this
        // proof to arbitrary semver OR ranges without independent adjudication.
      } else throw Error('No positive conflict certificate: '+entry.id);
    }
    if (entry.label === 'unknown' &&
        (typeof entry.certificate.reason !== 'string' || entry.certificate.reason.length < 8)) {
      throw Error('Unknown reasoning not documented: '+entry.id);
    }
  }
  if (count.conflict!==14 || count.satisfiable!==14 || count.unknown!==12) {
    throw Error('Frozen reference-label balance unexpectedly changed');
  }
  return count;
}

export function scoreTrilogyHoldout(cases, results) {
  if (!Array.isArray(cases)||!Array.isArray(results)||results.length!==cases.length) {
    throw Error('Holdout predictions must be complete and one-to-one');
  }
  const confusion = {
    conflict:{conflict:0,satisfiable:0,unknown:0},
    satisfiable:{conflict:0,satisfiable:0,unknown:0},
    unknown:{conflict:0,satisfiable:0,unknown:0},
  };
  const details=[];
  const ids=new Set();
  for(let i=0;i<cases.length;i++){
    const entry=cases[i], found=results[i];
    if(entry.id!==found.id||ids.has(entry.id)||!statuses.has(found.status)) {
      throw Error('Unknown/duplicate/missing prediction: '+entry.id);
    }
    ids.add(entry.id);
    confusion[entry.label][found.status]++;
    details.push({
      id:entry.id,category:entry.title,
      reference:entry.label,predicted:found.status,
      correct:entry.label===found.status,
      abstained:entry.label!=='unknown'&&found.status==='unknown',
      elapsedMs:found.elapsedMs,
      verification:found.verification??null,
    });
  }
  const tp=confusion.conflict.conflict, fp=confusion.satisfiable.conflict,
    fn=confusion.conflict.satisfiable, tn=confusion.satisfiable.satisfiable,
    ap=confusion.conflict.unknown, an=confusion.satisfiable.unknown;
  const known=tp+fp+fn+tn+ap+an, decided=tp+fp+fn+tn;
  const ratio=(top,bottom)=> bottom===0?null:finite(top/bottom);
  const positiveRecall=ratio(tp,tp+fn+ap);
  const negativeRecall=ratio(tn,tn+fp+an);
  const unknownTruth=confusion.unknown;
  const unknownCount=unknownTruth.conflict+unknownTruth.satisfiable+unknownTruth.unknown;
  const unsafe=unknownTruth.conflict+unknownTruth.satisfiable;
  return {
    version:1, sampleType:'frozen-authored-holdout-not-independent-human-adjudication',
    n:cases.length, referenceCounts:{
      conflict:tp+fn+ap,satisfiable:tn+fp+an,unknown:unknownCount,
    },
    confusion,
    counts:{
      TP:tp,FP:fp,FN:fn,TN:tn,
      abstainedPositive:ap,abstainedNegative:an,
      unknownReferenceCorrect:unknownTruth.unknown,
      unsupportedConflictAssertions:unknownTruth.conflict,
      unsupportedSatisfiableAssertions:unknownTruth.satisfiable,
    },
    metrics:{
      conflictPrecision:ratio(tp,tp+fp),
      conflictRecallConservative:ratio(tp,tp+fn+ap),
      conflictRecallOnDecided:ratio(tp,tp+fn),
      falsePositiveRateOnDecidedNegatives:ratio(fp,fp+tn),
      falsePositiveRateAllLabeledNegatives:ratio(fp,fp+tn+an),
      balancedAccuracyConservative:positiveRecall===null||negativeRecall===null?null:finite((positiveRecall+negativeRecall)/2),
      labeledCoverage:ratio(decided,known),
      selectiveAccuracy:ratio(tp+tn,decided),
      unknownReferenceAbstentionRate:ratio(unknownTruth.unknown,unknownCount),
      unsupportedAssertionCount:unsafe,
    },
    details,
    scopeWarnings:[
      'Frozen independently constructed synthetic labels; not blinded human independent adjudication and not real-world UCE accuracy.',
      'Reference-positive Unknown counts as a miss in conservative recall, not as a false negative; reference-negative Unknown reduces coverage.',
      'An Unknown-reference assertion is an unsafe unsupported claim, not a proven false-positive against a known negative.',
      'Metrics concern modeled Node engines.node constraints in bounded hoisted npm dependency graphs, not global compatibility.',
      'No threshold inferred for population-level precision, recall or false-positive rate.',
    ],
  };
}
