import { BROWSER_FEATURES } from '../analyzer/browser-knowledge';
import { TECHNOLOGY_REGISTRY } from '../analyzer/technology-registry';
import { V3_PHASE3_RULE_PACKS } from './v3-phase3-packs';
import type { V3CorrelationDetector, V3Rule, V3RuleModule, V3RulePack } from './v3-types';

export const V3_PHASE4_VERSION = '3.3.0';
export const V3_PHASE4_RULE_TARGET = 2_500;
export const V3_PHASE4_TOTAL_TARGET = 9_000;
type Group = 'browser-target' | 'manifest-lockfile' | 'value-flow' | 'import-boundary' | 'context-links';
const groups: Group[] = ['browser-target', 'manifest-lockfile', 'value-flow', 'import-boundary', 'context-links'];
const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Chrome Android', 'Safari iOS'];
const sourceGlob: Record<string, string[]> = {
  javascript: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '*.js', '*.jsx', '*.ts', '*.tsx'],
  python: ['**/*.py', '*.py'], php: ['**/*.php', '*.php'],
  java: ['**/*.java', '*.java'], dotnet: ['**/*.cs', '*.cs'], go: ['**/*.go', '*.go'],
};
const SOURCES: Record<string, string> = {
  javascript: 'req\\.query\\.\\w+ req\\.params\\.\\w+ req\\.body\\.\\w+ request\\.query\\.\\w+ request\\.params\\.\\w+ request\\.body\\.\\w+ ctx\\.query\\.\\w+ ctx\\.params\\.\\w+ ctx\\.request\\.body\\.\\w+ event\\.data location\\.search location\\.hash document\\.cookie window\\.name localStorage\\.getItem\\([^)]+\\) sessionStorage\\.getItem\\([^)]+\\) new\\s+URLSearchParams\\([^)]+\\) process\\.env\\.\\w+ import\\.meta\\.env\\.\\w+ headers\\.get\\([^)]+\\) cookies\\.get\\([^)]+\\) formData\\.get\\([^)]+\\) searchParams\\.get\\([^)]+\\) navigator\\.clipboard\\.readText\\(\\) window\\.location\\.href',
  python: 'request\\.args\\.get\\([^)]+\\) request\\.form\\.get\\([^)]+\\) request\\.json\\.get\\([^)]+\\) request\\.GET\\.get\\([^)]+\\) request\\.POST\\.get\\([^)]+\\) request\\.path_params\\.get\\([^)]+\\) os\\.environ\\.get\\([^)]+\\) os\\.getenv\\([^)]+\\) sys\\.argv\\[\\d+\\] input\\([^)]+\\) await\\s+request\\.body\\(\\) request\\.query_params\\.get\\([^)]+\\) websocket\\.receive_text\\(\\) request\\.cookies\\.get\\([^)]+\\)',
  php: '\\$_GET\\[[^\\]]+\\] \\$_POST\\[[^\\]]+\\] \\$_REQUEST\\[[^\\]]+\\] \\$_COOKIE\\[[^\\]]+\\] \\$_SERVER\\[[^\\]]+\\] \\$_FILES\\[[^\\]]+\\] filter_input\\([^)]+\\) getenv\\([^)]+\\) file_get_contents\\(["\\x27]php://input["\\x27]\\) \\$request->input\\([^)]+\\)',
  java: 'request\\.getParameter\\([^)]+\\) request\\.getHeader\\([^)]+\\) request\\.getCookies\\(\\) request\\.getQueryString\\(\\) System\\.getenv\\([^)]+\\) scanner\\.nextLine\\(\\) reader\\.readLine\\(\\) exchange\\.getRequestURI\\(\\) message\\.getPayload\\(\\) request\\.getInputStream\\(\\)',
  dotnet: 'Request\\.Query\\[[^\\]]+\\] Request\\.Form\\[[^\\]]+\\] Request\\.Headers\\[[^\\]]+\\] Request\\.Cookies\\[[^\\]]+\\] Environment\\.GetEnvironmentVariable\\([^)]+\\) Console\\.ReadLine\\(\\) request\\.Query\\[[^\\]]+\\] request\\.Headers\\[[^\\]]+\\] httpContext\\.Request\\.Path httpContext\\.Request\\.Body',
  go: 'r\\.URL\\.Query\\(\\)\\.Get\\([^)]+\\) r\\.FormValue\\([^)]+\\) r\\.PostFormValue\\([^)]+\\) r\\.Header\\.Get\\([^)]+\\) r\\.Cookie\\([^)]+\\) os\\.Getenv\\([^)]+\\) os\\.Args\\[\\d+\\] scanner\\.Text\\(\\) c\\.Query\\([^)]+\\) c\\.Param\\([^)]+\\)',
};
const SINKS: Record<string, string> = {
  javascript: 'eval\\s*\\(\\s*{{variable}}\\b document\\.write\\s*\\(\\s*{{variable}}\\b document\\.writeln\\s*\\(\\s*{{variable}}\\b innerHTML\\s*=\\s*{{variable}}\\b outerHTML\\s*=\\s*{{variable}}\\b insertAdjacentHTML\\s*\\([^,]+,\\s*{{variable}}\\b child_process\\.exec\\s*\\(\\s*{{variable}}\\b child_process\\.execSync\\s*\\(\\s*{{variable}}\\b exec\\s*\\(\\s*{{variable}}\\b execSync\\s*\\(\\s*{{variable}}\\b vm\\.runInNewContext\\s*\\(\\s*{{variable}}\\b vm\\.runInThisContext\\s*\\(\\s*{{variable}}\\b db\\.query\\s*\\(\\s*{{variable}}\\b connection\\.query\\s*\\(\\s*{{variable}}\\b pool\\.query\\s*\\(\\s*{{variable}}\\b sequelize\\.query\\s*\\(\\s*{{variable}}\\b fs\\.readFileSync\\s*\\(\\s*{{variable}}\\b fs\\.writeFileSync\\s*\\(\\s*{{variable}}\\b res\\.redirect\\s*\\(\\s*{{variable}}\\b response\\.redirect\\s*\\(\\s*{{variable}}\\b window\\.open\\s*\\(\\s*{{variable}}\\b fetch\\s*\\(\\s*{{variable}}\\b location\\.href\\s*=\\s*{{variable}}\\b path\\.join\\s*\\([^)]*{{variable}}\\b',
  python: 'eval\\s*\\(\\s*{{variable}}\\b exec\\s*\\(\\s*{{variable}}\\b os\\.system\\s*\\(\\s*{{variable}}\\b os\\.popen\\s*\\(\\s*{{variable}}\\b subprocess\\.run\\s*\\(\\s*{{variable}}\\b subprocess\\.Popen\\s*\\(\\s*{{variable}}\\b subprocess\\.call\\s*\\(\\s*{{variable}}\\b cursor\\.execute\\s*\\(\\s*{{variable}}\\b connection\\.execute\\s*\\(\\s*{{variable}}\\b pickle\\.loads\\s*\\(\\s*{{variable}}\\b yaml\\.load\\s*\\(\\s*{{variable}}\\b open\\s*\\(\\s*{{variable}}\\b send_file\\s*\\(\\s*{{variable}}\\b redirect\\s*\\(\\s*{{variable}}\\b requests\\.get\\s*\\(\\s*{{variable}}\\b urllib\\.request\\.urlopen\\s*\\(\\s*{{variable}}\\b',
  php: 'eval\\s*\\(\\s*{{variable}}\\b system\\s*\\(\\s*{{variable}}\\b exec\\s*\\(\\s*{{variable}}\\b shell_exec\\s*\\(\\s*{{variable}}\\b passthru\\s*\\(\\s*{{variable}}\\b unserialize\\s*\\(\\s*{{variable}}\\b mysqli_query\\s*\\([^,]+,\\s*{{variable}}\\b file_get_contents\\s*\\(\\s*{{variable}}\\b file_put_contents\\s*\\(\\s*{{variable}}\\b include\\s+{{variable}}\\b require\\s+{{variable}}\\b header\\s*\\(\\s*{{variable}}\\b',
  java: 'Runtime\\.getRuntime\\(\\)\\.exec\\s*\\(\\s*{{variable}}\\b ProcessBuilder\\s*\\(\\s*{{variable}}\\b Statement\\.execute\\s*\\(\\s*{{variable}}\\b Statement\\.executeQuery\\s*\\(\\s*{{variable}}\\b Statement\\.executeUpdate\\s*\\(\\s*{{variable}}\\b Class\\.forName\\s*\\(\\s*{{variable}}\\b ScriptEngine\\.eval\\s*\\(\\s*{{variable}}\\b Files\\.readString\\s*\\(\\s*{{variable}}\\b Files\\.writeString\\s*\\(\\s*{{variable}}\\b URL\\s*\\(\\s*{{variable}}\\b URI\\.create\\s*\\(\\s*{{variable}}\\b response\\.sendRedirect\\s*\\(\\s*{{variable}}\\b',
  dotnet: 'Process\\.Start\\s*\\(\\s*{{variable}}\\b Assembly\\.Load\\s*\\(\\s*{{variable}}\\b SqlCommand\\s*\\(\\s*{{variable}}\\b ExecuteSqlRaw\\s*\\(\\s*{{variable}}\\b File\\.ReadAllText\\s*\\(\\s*{{variable}}\\b File\\.WriteAllText\\s*\\(\\s*{{variable}}\\b Redirect\\s*\\(\\s*{{variable}}\\b Response\\.Redirect\\s*\\(\\s*{{variable}}\\b HttpClient\\.GetStringAsync\\s*\\(\\s*{{variable}}\\b BinaryFormatter\\.Deserialize\\s*\\(\\s*{{variable}}\\b XmlDocument\\.LoadXml\\s*\\(\\s*{{variable}}\\b XslCompiledTransform\\.Load\\s*\\(\\s*{{variable}}\\b',
  go: 'exec\\.Command\\s*\\(\\s*{{variable}}\\b exec\\.CommandContext\\s*\\([^,]+,\\s*{{variable}}\\b db\\.Query\\s*\\(\\s*{{variable}}\\b db\\.Exec\\s*\\(\\s*{{variable}}\\b db\\.QueryContext\\s*\\([^,]+,\\s*{{variable}}\\b os\\.ReadFile\\s*\\(\\s*{{variable}}\\b os\\.WriteFile\\s*\\(\\s*{{variable}}\\b http\\.Get\\s*\\(\\s*{{variable}}\\b http\\.Post\\s*\\(\\s*{{variable}}\\b template\\.HTML\\s*\\(\\s*{{variable}}\\b template\\.JS\\s*\\(\\s*{{variable}}\\b os\\.Open\\s*\\(\\s*{{variable}}\\b',
};
function split(value: string): string[] { return value.split(/\s+(?![^(]*\))/).filter(Boolean); }
function slug(value: string): string { return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(); }
function hash(value: string): string { let n = 2166136261; for (const char of value) { n ^= char.charCodeAt(0); n = Math.imul(n, 16777619); } return (n >>> 0).toString(36); }
function rule(group: Group, id: string, module: V3RuleModule, title: string, tech: string[], detector: V3CorrelationDetector): V3Rule {
  return {
    id: 'intelligence.' + group + '.' + slug(id) + '-' + hash(id), version: V3_PHASE4_VERSION,
    module, title, description: 'Joins independent static evidence in an applicable project scope; this finding requires developer review.',
    technologies: tech, scope: ['production', 'configuration'], severity: 'warning', confidence: 'review-required', detectors: [detector],
    evidenceRequirements: { minimum: 1, requireDetectorKinds: ['correlation'] },
    recommendation: 'Review the related files and effective runtime behavior before deciding whether a change is needed.',
    references: [], falsePositiveNotes: ['Static evidence does not establish reachability, exploitability, or the effective deployed configuration.'],
    budget: { maxFiles: 15_000, maxMatches: 12, maxContentBytes: 12 * 1024 * 1024, maxMilliseconds: 100 }, tags: ['phase4', group],
  };
}
const browserRules = BROWSER_FEATURES.flatMap(feature => browsers.map(browser =>
  rule('browser-target', feature.id + '-' + browser, 'browser', feature.feature + ' on ' + browser,
    ['javascript', 'typescript', 'html', 'css', 'react', 'vue', 'angular', 'svelte'],
    { kind: 'correlation', mode: 'browser-target', featureId: feature.id, browser })));
const knownPackages = new Set([
  ...TECHNOLOGY_REGISTRY.flatMap(def => def.dependencies ?? []),
  ...V3_PHASE3_RULE_PACKS.flatMap(pack => pack.rules.flatMap(item => item.detectors.flatMap(detector =>
    detector.kind === 'dependency' && detector.ecosystems.includes('npm') ? detector.names : []))),
]);
const lockfileRules = [...knownPackages].sort().map(name =>
  rule('manifest-lockfile', name, 'dependency', 'Pinned ' + name + ' differs from npm lockfile',
    ['javascript', 'typescript', 'nodejs', 'npm', name.toLowerCase()],
    { kind: 'correlation', mode: 'lockfile-version', packageName: name }));
const flowRules = Object.keys(SOURCES).flatMap(language => {
  const sources = split(SOURCES[language]); const sinks = split(SINKS[language]);
  return sources.flatMap((source, i) => sinks.map((sink, j) => {
    const assignment = language === 'javascript' ? '(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*'
      : language === 'java' ? '(?:String|var|Object)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*'
        : language === 'dotnet' ? '(?:var|string|object)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*'
          : language === 'go' ? '([A-Za-z_$][\\w$]*)\\s*:=\\s*'
            : language === 'php' ? '\\$([A-Za-z_$][\\w$]*)\\s*=\\s*' : '([A-Za-z_$][\\w$]*)\\s*=\\s*';
    return rule('value-flow', language + '-' + i + '-' + j, 'security', language + ': review value passed to sensitive operation',
      [language, ...(language === 'javascript' ? ['typescript', 'nodejs', 'react'] : language === 'dotnet' ? ['csharp', '.net'] : [])],
      { kind: 'correlation', mode: 'flow', include: sourceGlob[language], sourcePattern: assignment + '(?:' + source + ')',
        sinkPattern: language === 'php' ? sink.replace(/\{\{variable\}\}/g, '\\$?{{variable}}') : sink, maxLineDistance: 35 });
  }));
});
const origins = ['src/components', 'src/pages', 'src/routes', 'src/views', 'src/ui', 'src/client', 'src/browser', 'src/widgets', 'src/screens', 'src/features', 'app/components', 'app/client', 'apps/web/src', 'apps/mobile/src', 'packages/ui/src', 'packages/client/src', 'frontend/src', 'web/src', 'client/src', 'ui/src'];
const destinations = ['src/server', 'src/backend', 'src/database', 'src/secrets', 'src/admin', 'src/internal', 'src/infra', 'src/private', 'src/credentials', 'src/config/server', 'app/server', 'app/api', 'apps/api/src', 'apps/server/src', 'packages/server/src', 'packages/db/src', 'backend/src', 'server/src', 'internal/src', 'infra/src'];
const importRules = origins.flatMap(origin => destinations.map(target =>
  rule('import-boundary', origin + '-' + target, 'architecture', 'Client module imports server or internal module',
    ['javascript', 'typescript', 'react', 'nextjs', 'vue', 'svelte', 'nodejs'],
    { kind: 'correlation', mode: 'import-boundary',
      include: [origin + '/**/*.js', origin + '/**/*.ts', origin + '/**/*.tsx', origin + '/**/*.jsx'],
      target: [target + '/**/*.js', target + '/**/*.ts', target + '/**/*.tsx', target + '/**/*.jsx'] })));
interface Pair { module: V3RuleModule; tech: string[]; first: string[]; second: string[]; firstPattern: string; secondPattern: string; relation: 'same-file' | 'same-workspace' }
const pairs: Pair[] = [
  { module: 'build', tech: ['typescript', 'nodejs'], first: ['**/package.json','package.json'], second: ['**/tsconfig.json','tsconfig.json'], firstPattern: '"type"\\s*:\\s*"module"', secondPattern: '"module"\\s*:\\s*"CommonJS"', relation: 'same-workspace' },
  { module: 'runtime', tech: ['nodejs'], first: ['**/package.json','package.json'], second: ['**/.nvmrc','.nvmrc'], firstPattern: '"node"\\s*:', secondPattern: '^v?\\d+', relation: 'same-workspace' },
  { module: 'api', tech: ['javascript','typescript','react'], first: ['**/*.ts','**/*.tsx','**/*.js'], second: ['**/*.ts','**/*.tsx','**/*.js'], firstPattern: '\\bfetch\\s*\\(', secondPattern: '\\b(?:app|router)\\.(?:get|post|put|delete)\\s*\\(', relation: 'same-workspace' },
  { module: 'database', tech: ['prisma'], first: ['**/schema.prisma','schema.prisma'], second: ['**/migration.sql','**/migrations/**/*.sql'], firstPattern: '\\bmodel\\s+\\w+', secondPattern: '\\b(?:ALTER|DROP)\\s+TABLE\\b', relation: 'same-workspace' },
  { module: 'performance', tech: ['javascript','typescript'], first: ['**/*.js','**/*.ts','**/*.tsx'], second: ['**/*.js','**/*.ts','**/*.tsx'], firstPattern: '\\bfor\\s*\\(', secondPattern: '\\b(?:fetch|readFileSync|query)\\s*\\(', relation: 'same-file' },
  { module: 'accessibility', tech: ['react','vue','html'], first: ['**/*.tsx','**/*.jsx','**/*.html'], second: ['**/*.tsx','**/*.jsx','**/*.html'], firstPattern: '\\bonClick\\s*=', secondPattern: '\\btabIndex\\s*=', relation: 'same-file' },
  { module: 'platform', tech: ['javascript','typescript'], first: ['**/*.js','**/*.ts'], second: ['**/*.js','**/*.ts'], firstPattern: '\\bpath\\.join\\s*\\(', secondPattern: '\\bprocess\\.platform\\b', relation: 'same-file' },
  { module: 'technology', tech: ['react','nextjs'], first: ['**/*.tsx','**/*.jsx'], second: ['**/next.config.*','next.config.*'], firstPattern: '\\buse client\\b', secondPattern: '\\b(?:output|experimental)\\s*:', relation: 'same-workspace' },
];
const contextRules = pairs.map((pair, index) =>
  rule('context-links', pair.module + '-' + index, pair.module, 'Review linked ' + pair.module + ' evidence',
    pair.tech, { kind: 'correlation', mode: 'paired-evidence',
      first: { include: pair.first, pattern: pair.firstPattern }, second: { include: pair.second, pattern: pair.secondPattern }, relation: pair.relation }));

function compile(): V3RulePack[] {
  const allocation: Array<[Group, V3Rule[], number]> = [
    ['browser-target', browserRules, browserRules.length],
    ['manifest-lockfile', lockfileRules, 400],
    ['value-flow', flowRules, 1_200],
    ['import-boundary', importRules, 300],
    ['context-links', contextRules, contextRules.length],
  ];
  const chosen = new Map<Group, V3Rule[]>();
  for (const [group, candidates, cap] of allocation) chosen.set(group, candidates.slice(0, cap));
  let total = [...chosen.values()].reduce((sum, items) => sum + items.length, 0);
  if (total < V3_PHASE4_RULE_TARGET) {
    for (const [group, candidates] of allocation) {
      const more = candidates.slice(chosen.get(group)?.length ?? 0, (chosen.get(group)?.length ?? 0) + V3_PHASE4_RULE_TARGET - total);
      chosen.set(group, [...(chosen.get(group) ?? []), ...more]); total += more.length;
      if (total === V3_PHASE4_RULE_TARGET) break;
    }
  }
  if (total < V3_PHASE4_RULE_TARGET) throw new Error('Only ' + total + ' distinct Phase 4 correlation rules available.');
  while (total > V3_PHASE4_RULE_TARGET) {
    const selected = chosen.get('value-flow') ?? [];
    if (!selected.length) throw new Error('Phase 4 correlation allocation over target.');
    selected.pop(); total--;
  }
  return groups.map(group => {
    const rules = chosen.get(group) ?? [];
    return { schemaVersion: 3, id: 'com.ryzova.uce.v3-phase4.' + group, name: 'UCE V3 Phase 4 — ' + group,
      version: V3_PHASE4_VERSION, publisher: 'RyzovaTech', description: 'Evidence-linked ' + group + ' review rules.',
      uceCompatibility: '>=2.0.0 <4.0.0', technologies: [...new Set(rules.flatMap(item => item.technologies))],
      modules: [...new Set(rules.map(item => item.module))], rules };
  });
}
export const V3_PHASE4_RULE_PACKS: V3RulePack[] = compile();
export const V3_PHASE4_RULE_COUNT = V3_PHASE4_RULE_PACKS.reduce((sum, pack) => sum + pack.rules.length, 0);
