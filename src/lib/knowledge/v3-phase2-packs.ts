import { TECHNOLOGY_REGISTRY, type TechnologyDefinition } from '../analyzer/technology-registry';
import type {
  V3DependencyDetector, V3Detector, V3Rule, V3RuleModule, V3RulePack,
} from './v3-types';

/** Phase 2 contributes 2,995 rules; together with the five bootstrap rules the public inventory is exactly 3,000. */
export const V3_PHASE2_RULE_TARGET = 2_995;
export const V3_TOTAL_CORE_RULE_TARGET = 3_000;
export const V3_PHASE2_KNOWLEDGE_VERSION = '3.1.0';

type DependencyEcosystem = V3DependencyDetector['ecosystems'][number];
interface CompiledRule { group: string; rule: V3Rule }
interface DependencyDefinition { id: string; name: string; dependencies?: string[]; ecosystemDependencies?: Array<{ ecosystem: DependencyEcosystem; name: string }> }
interface SourceProfile {
  id: string;
  group: string;
  module: V3RuleModule;
  technologies: string[];
  include: string[];
  calls: string[];
  recommendation: string;
  reference: string;
}

const SOURCE_PROFILES: readonly SourceProfile[] = [
  {
    id: 'javascript-sensitive-api', group: 'javascript-web', module: 'security',
    technologies: ['javascript', 'typescript', 'node.js', 'nodejs'], include: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs', '**/*.ts', '**/*.tsx'],
    calls: ['Function', 'setImmediate', 'setTimeout', 'setInterval', 'document.write', 'document.writeln', 'insertAdjacentHTML', 'outerHTML', 'execScript', 'child_process.exec', 'child_process.execSync', 'child_process.spawn', 'child_process.spawnSync', 'vm.runInThisContext', 'vm.runInNewContext', 'vm.runInContext', 'deserialize', 'unserialize', 'crypto.createCipher', 'crypto.createDecipher', 'Math.random', 'process.binding', 'fs.chmod', 'fs.chown', 'fs.writeFile', 'fs.appendFile', 'fetch', 'WebSocket'],
    recommendation: 'Review the call boundary, validate untrusted input, and prefer the safest purpose-built API.', reference: 'https://owasp.org/www-project-top-ten/',
  },
  {
    id: 'python-sensitive-api', group: 'python', module: 'security', technologies: ['python'], include: ['**/*.py'],
    calls: ['eval', 'exec', 'compile', '__import__', 'pickle.load', 'pickle.loads', 'marshal.load', 'marshal.loads', 'yaml.load', 'subprocess.call', 'subprocess.run', 'subprocess.Popen', 'os.system', 'os.popen', 'commands.getoutput', 'tempfile.mktemp', 'random.random', 'random.randint', 'hashlib.md5', 'hashlib.sha1', 'requests.get', 'requests.post', 'urllib.request.urlopen', 'open', 'shutil.rmtree', 'xml.etree.ElementTree.parse', 'lxml.etree.parse', 'socket.socket'],
    recommendation: 'Validate data origin and use safe loaders, parameterized process arguments, and cryptographic primitives where required.', reference: 'https://docs.python.org/3/library/security_warnings.html',
  },
  {
    id: 'jvm-sensitive-api', group: 'jvm', module: 'security', technologies: ['java', 'kotlin', 'jvm'], include: ['**/*.java', '**/*.kt', '**/*.kts'],
    calls: ['Runtime.getRuntime().exec', 'ProcessBuilder', 'Class.forName', 'ObjectInputStream', 'XMLDecoder', 'ScriptEngine.eval', 'Statement.execute', 'Statement.executeQuery', 'Statement.executeUpdate', 'MessageDigest.getInstance', 'Cipher.getInstance', 'SecureRandom', 'Random', 'Files.write', 'Files.delete', 'Files.createTempFile', 'URL.openConnection', 'URL.openStream', 'System.load', 'System.loadLibrary', 'setAccessible'],
    recommendation: 'Treat external input as untrusted and use constrained APIs, prepared queries, and safe serialization formats.', reference: 'https://docs.oracle.com/en/java/javase/21/security/',
  },
  {
    id: 'native-sensitive-api', group: 'native', module: 'security', technologies: ['c', 'c++', 'cpp'], include: ['**/*.c', '**/*.h', '**/*.cc', '**/*.cpp', '**/*.cxx', '**/*.hpp'],
    calls: ['gets', 'strcpy', 'strcat', 'sprintf', 'vsprintf', 'scanf', 'sscanf', 'fscanf', 'memcpy', 'memmove', 'malloc', 'calloc', 'realloc', 'free', 'system', 'popen', 'execve', 'execl', 'execlp', 'dlopen', 'mktemp', 'tmpnam', 'rand', 'srand', 'chmod', 'chown', 'setuid', 'setgid', 'realpath', 'readlink'],
    recommendation: 'Review buffer bounds, ownership, integer sizes, command construction, and privilege transitions.', reference: 'https://wiki.sei.cmu.edu/confluence/display/c/SEI+CERT+C+Coding+Standard',
  },
  {
    id: 'dotnet-sensitive-api', group: 'dotnet', module: 'security', technologies: ['c#', 'csharp', '.net', 'dotnet'], include: ['**/*.cs', '**/*.fs', '**/*.vb'],
    calls: ['Process.Start', 'Assembly.Load', 'Assembly.LoadFrom', 'Type.GetType', 'Activator.CreateInstance', 'BinaryFormatter.Deserialize', 'LosFormatter.Deserialize', 'XmlSerializer.Deserialize', 'XslCompiledTransform.Load', 'SqlCommand', 'ExecuteReader', 'ExecuteNonQuery', 'ExecuteScalar', 'MD5.Create', 'SHA1.Create', 'Random', 'File.WriteAllText', 'File.Delete', 'Directory.Delete', 'WebClient.DownloadString', 'HttpClient.GetStringAsync'],
    recommendation: 'Constrain reflection and process execution, parameterize queries, and avoid obsolete serializers and cryptography.', reference: 'https://learn.microsoft.com/en-us/dotnet/standard/security/',
  },
  {
    id: 'go-sensitive-api', group: 'go', module: 'security', technologies: ['go'], include: ['**/*.go'],
    calls: ['exec.Command', 'exec.CommandContext', 'template.HTML', 'template.JS', 'template.URL', 'sql.Open', 'Query', 'QueryContext', 'Exec', 'ExecContext', 'http.Get', 'http.Post', 'http.ListenAndServe', 'http.ListenAndServeTLS', 'ioutil.WriteFile', 'os.WriteFile', 'os.RemoveAll', 'os.Chmod', 'rand.Int', 'rand.Read', 'md5.New', 'sha1.New'],
    recommendation: 'Validate command, template, SQL, filesystem, and network inputs and use context-aware safe APIs.', reference: 'https://go.dev/doc/security/best-practices',
  },
  {
    id: 'rust-sensitive-api', group: 'rust', module: 'security', technologies: ['rust'], include: ['**/*.rs'],
    calls: ['Command::new', 'Command::args', 'std::mem::transmute', 'std::ptr::read', 'std::ptr::write', 'std::slice::from_raw_parts', 'std::ffi::CStr::from_ptr', 'libc::system', 'File::create', 'remove_dir_all', 'set_permissions', 'TcpListener::bind', 'TcpStream::connect', 'reqwest::get', 'unwrap', 'expect', 'panic', 'unreachable_unchecked', 'get_unchecked', 'from_utf8_unchecked', 'MaybeUninit::assume_init'],
    recommendation: 'Keep unsafe and external-process boundaries minimal, document invariants, and propagate recoverable errors.', reference: 'https://doc.rust-lang.org/nomicon/',
  },
  {
    id: 'php-sensitive-api', group: 'php', module: 'security', technologies: ['php'], include: ['**/*.php', '**/*.phtml'],
    calls: ['eval', 'assert', 'system', 'exec', 'shell_exec', 'passthru', 'popen', 'proc_open', 'unserialize', 'include', 'require', 'include_once', 'require_once', 'file_get_contents', 'file_put_contents', 'unlink', 'chmod', 'move_uploaded_file', 'mysqli_query', 'PDO::query', 'PDO::exec', 'header', 'setcookie', 'openssl_decrypt'],
    recommendation: 'Validate paths and input, parameterize database access, and avoid dynamic execution and unsafe deserialization.', reference: 'https://www.php.net/manual/en/security.php',
  },
  {
    id: 'web-platform-sensitive-api', group: 'javascript-web', module: 'browser', technologies: ['javascript', 'typescript', 'html', 'react', 'vue', 'angular', 'svelte'], include: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.vue', '**/*.svelte', '**/*.html'],
    calls: ['navigator.geolocation.getCurrentPosition', 'navigator.geolocation.watchPosition', 'navigator.mediaDevices.getUserMedia', 'navigator.clipboard.read', 'navigator.clipboard.write', 'Notification.requestPermission', 'window.open', 'postMessage', 'localStorage.setItem', 'sessionStorage.setItem', 'indexedDB.open', 'caches.open', 'serviceWorker.register', 'crypto.subtle.encrypt', 'crypto.subtle.decrypt', 'DOMParser.parseFromString', 'URL.createObjectURL', 'history.pushState', 'history.replaceState', 'document.cookie', 'Element.requestFullscreen', 'navigator.share', 'navigator.sendBeacon'],
    recommendation: 'Confirm browser support, permissions, privacy expectations, origin checks, and a graceful fallback.', reference: 'https://developer.mozilla.org/en-US/docs/Web/API',
  },
  {
    id: 'frontend-framework-escape-hatch', group: 'frameworks', module: 'security', technologies: ['react', 'next.js', 'nextjs', 'vue', 'angular', 'svelte'], include: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.vue', '**/*.svelte', '**/*.html'],
    calls: ['dangerouslySetInnerHTML', 'bypassSecurityTrustHtml', 'bypassSecurityTrustScript', 'bypassSecurityTrustUrl', 'bypassSecurityTrustResourceUrl', 'v-html', 'use:html', 'set:html', 'createPortal', 'createRoot', 'renderToString', 'renderToStaticMarkup'],
    recommendation: 'Keep framework security escape hatches isolated and sanitize any value that can be influenced externally.', reference: 'https://owasp.org/www-community/attacks/xss/',
  },
  {
    id: 'api-protocol-boundary', group: 'api-data', module: 'api', technologies: ['javascript', 'typescript', 'python', 'java', 'kotlin', 'go', 'rust', 'php', 'c#'], include: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.py', '**/*.java', '**/*.kt', '**/*.go', '**/*.rs', '**/*.php', '**/*.cs'],
    calls: ['fetch', 'axios', 'request', 'graphql', 'subscribe', 'WebSocket', 'EventSource', 'send', 'publish', 'consume', 'query', 'execute', 'transaction', 'commit', 'rollback', 'listen', 'connect'],
    recommendation: 'Validate the remote endpoint, authentication, authorization, input schema, timeouts, and failure handling.', reference: 'https://owasp.org/www-project-api-security/',
  },
];

const CONFIG_RULES: ReadonlyArray<{ id: string; group: string; module: V3RuleModule; technologies: string[]; include: string[]; pattern: string; title: string; recommendation: string; reference: string }> = [
  { id: 'docker.root-user', group: 'cloud-devops', module: 'deployment', technologies: ['docker'], include: ['Dockerfile', '**/Dockerfile', '**/Dockerfile.*'], pattern: '^\\s*USER\\s+(?:root|0)\\s*$', title: 'Container explicitly runs as root', recommendation: 'Run the final image as a dedicated non-root user unless root is required and documented.', reference: 'https://docs.docker.com/build/building/best-practices/' },
  { id: 'docker.add-remote', group: 'cloud-devops', module: 'security', technologies: ['docker'], include: ['Dockerfile', '**/Dockerfile', '**/Dockerfile.*'], pattern: '^\\s*ADD\\s+https?://', title: 'Docker ADD downloads a remote resource', recommendation: 'Download and verify remote artifacts explicitly before copying them into the image.', reference: 'https://docs.docker.com/reference/dockerfile/' },
  { id: 'docker.secret-env', group: 'cloud-devops', module: 'security', technologies: ['docker'], include: ['Dockerfile', '**/Dockerfile', '**/Dockerfile.*'], pattern: '^\\s*(?:ENV|ARG)\\s+[^\\n]*(?:SECRET|TOKEN|PASSWORD|API_KEY)', title: 'Possible secret passed through Docker build metadata', recommendation: 'Use BuildKit secret mounts or runtime secret injection.', reference: 'https://docs.docker.com/build/building/secrets/' },
  { id: 'github-actions-unpinned-use', group: 'cloud-devops', module: 'deployment', technologies: ['github-actions'], include: ['.github/workflows/*.yml', '.github/workflows/*.yaml', '**/.github/workflows/*.yml', '**/.github/workflows/*.yaml'], pattern: '^\\s*uses:\\s*[^@\\s]+@(?:main|master|latest|v\\d+)\\s*$', title: 'GitHub Action is not pinned to an immutable commit', recommendation: 'Pin third-party actions to a reviewed commit SHA and use dependency automation for updates.', reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions' },
  { id: 'github-actions-write-all', group: 'cloud-devops', module: 'security', technologies: ['github-actions'], include: ['.github/workflows/*.yml', '.github/workflows/*.yaml', '**/.github/workflows/*.yml', '**/.github/workflows/*.yaml'], pattern: '^\\s*permissions:\\s*write-all\\s*$', title: 'GitHub Actions grants write-all permissions', recommendation: 'Grant the minimum required permissions at workflow or job level.', reference: 'https://docs.github.com/en/actions/security-guides/automatic-token-authentication' },
  { id: 'cloud-public-access', group: 'cloud-devops', module: 'security', technologies: ['aws', 'gcp', 'azure', 'terraform', 'kubernetes'], include: ['**/*.tf', '**/*.yml', '**/*.yaml', '**/*.json'], pattern: '(?:public_access|publicAccess|allUsers|0\\.0\\.0\\.0/0)\\s*[:=]\\s*(?:true|["\']?0\\.0\\.0\\.0/0)', title: 'Cloud configuration may allow public access', recommendation: 'Restrict ingress and public access to explicitly required resources and document exceptions.', reference: 'https://owasp.org/www-project-cloud-native-application-security-top-10/' },
  { id: 'sql-string-concatenation', group: 'api-data', module: 'security', technologies: ['javascript', 'typescript', 'python', 'java', 'kotlin', 'go', 'php', 'c#'], include: ['**/*.js', '**/*.ts', '**/*.py', '**/*.java', '**/*.kt', '**/*.go', '**/*.php', '**/*.cs'], pattern: '(?:SELECT|INSERT|UPDATE|DELETE)[^\\n]{0,160}(?:\\+|\\$\\{|format\\()', title: 'SQL statement appears dynamically assembled', recommendation: 'Use parameterized queries or a query builder and validate dynamic identifiers separately.', reference: 'https://owasp.org/www-community/attacks/SQL_Injection' },
  { id: 'graphql-introspection-production', group: 'api-data', module: 'api', technologies: ['graphql'], include: ['**/*.js', '**/*.ts', '**/*.py', '**/*.java', '**/*.kt', '**/*.go', '**/*.rs', '**/*.php', '**/*.cs'], pattern: 'introspection\\s*:\\s*true', title: 'GraphQL introspection explicitly enabled', recommendation: 'Confirm production introspection exposure is intentional and protected by appropriate controls.', reference: 'https://graphql.org/learn/introspection/' },
  { id: 'websocket-wildcard-origin', group: 'api-data', module: 'security', technologies: ['websocket', 'ws', 'socket.io'], include: ['**/*.js', '**/*.ts', '**/*.py', '**/*.java', '**/*.kt', '**/*.go', '**/*.rs', '**/*.php', '**/*.cs'], pattern: '(?:origin|allowedOrigins?)\\s*[:=]\\s*["\']\\*["\']', title: 'WebSocket origin policy permits every origin', recommendation: 'Allow only trusted origins and authenticate each connection independently.', reference: 'https://owasp.org/www-community/attacks/Cross_Site_WebSocket_Hijacking' },
  { id: 'html-missing-lang', group: 'accessibility', module: 'accessibility', technologies: ['html', 'react', 'vue', 'angular', 'svelte'], include: ['**/*.html', '**/*.htm'], pattern: '<html(?![^>]*\\blang\\s*=)[^>]*>', title: 'HTML document has no language declaration', recommendation: 'Add an accurate lang attribute to the root html element.', reference: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html' },
  { id: 'image-missing-alt', group: 'accessibility', module: 'accessibility', technologies: ['html', 'react', 'vue', 'angular', 'svelte'], include: ['**/*.html', '**/*.htm', '**/*.jsx', '**/*.tsx', '**/*.vue', '**/*.svelte'], pattern: '<img(?![^>]*\\balt\\s*=)[^>]*>', title: 'Image has no alternative-text attribute', recommendation: 'Provide meaningful alt text or alt="" for a purely decorative image.', reference: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html' },
  { id: 'button-positive-tabindex', group: 'accessibility', module: 'accessibility', technologies: ['html', 'react', 'vue', 'angular', 'svelte'], include: ['**/*.html', '**/*.htm', '**/*.jsx', '**/*.tsx', '**/*.vue', '**/*.svelte'], pattern: 'tabIndex\\s*=\\s*["{]?[1-9]', title: 'Positive tabindex changes natural focus order', recommendation: 'Use DOM order and tabindex="0" or "-1" instead of positive values.', reference: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html' },
  { id: 'autofocus-review', group: 'accessibility', module: 'accessibility', technologies: ['html', 'react', 'vue', 'angular', 'svelte'], include: ['**/*.html', '**/*.htm', '**/*.jsx', '**/*.tsx', '**/*.vue', '**/*.svelte'], pattern: '\\bautoFocus\\b|\\bautofocus\\b', title: 'Automatic focus requires accessibility review', recommendation: 'Avoid unexpected focus movement and confirm screen-reader context remains clear.', reference: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html' },
];

const VERSION_POLICIES = [
  { id: 'mutable', pattern: '^(?:\\*|latest|next|nightly|dev)$', title: 'Mutable dependency version', severity: 'warning' as const, recommendation: 'Replace mutable labels with an intentional version range and commit the ecosystem lockfile.' },
  { id: 'remote-source', pattern: '^(?:https?://|git(?:\\+[^:]+)?[:@]|github:)', title: 'Remote-source dependency', severity: 'warning' as const, recommendation: 'Prefer a verified registry release or pin the remote source to an immutable reviewed revision.' },
  { id: 'local-source', pattern: '^(?:file:|link:|path:|workspace:\\*)', title: 'Local or wildcard workspace dependency', severity: 'info' as const, recommendation: 'Confirm the local/workspace source is reproducible in clean CI and release environments.' },
  { id: 'prerelease', pattern: '(?:^|[-.])(?:alpha|beta|rc|canary|next|snapshot|preview|dev)(?:[.-]|$)', title: 'Pre-release dependency version', severity: 'info' as const, recommendation: 'Confirm pre-release use is intentional and covered by compatibility tests.' },
  { id: 'unbounded', pattern: '^(?:[><]=?\\s*)?\\*|^[><]=?\\s*0(?:\\.0(?:\\.0)?)?$', title: 'Unbounded dependency constraint', severity: 'warning' as const, recommendation: 'Set a deliberate compatible version range and rely on a committed lockfile for repeatability.' },
  { id: 'zero-major', pattern: '^[~^]?[v=]?0\\.', title: 'Zero-major dependency compatibility', severity: 'info' as const, recommendation: 'Review zero-major updates carefully because compatibility guarantees may be limited.' },
  { id: 'snapshot', pattern: '(?:snapshot|nightly|dev|head|trunk)', title: 'Development snapshot dependency', severity: 'warning' as const, recommendation: 'Pin production builds to a stable or immutable dependency revision.' },
] as const;

const JVM_PACKAGES = [
  'org.springframework:spring-core', 'org.springframework.boot:spring-boot-starter-web', 'com.fasterxml.jackson.core:jackson-databind', 'com.google.guava:guava', 'org.apache.commons:commons-lang3', 'org.apache.logging.log4j:log4j-core', 'org.slf4j:slf4j-api', 'org.junit.jupiter:junit-jupiter', 'org.mockito:mockito-core', 'org.hibernate.orm:hibernate-core', 'jakarta.persistence:jakarta.persistence-api', 'io.netty:netty-all', 'com.squareup.okhttp3:okhttp', 'com.squareup.retrofit2:retrofit', 'com.google.code.gson:gson', 'org.jetbrains.kotlin:kotlin-stdlib', 'org.jetbrains.kotlinx:kotlinx-coroutines-core', 'io.ktor:ktor-server-core', 'io.quarkus:quarkus-core', 'io.micronaut:micronaut-runtime', 'org.projectlombok:lombok', 'org.mapstruct:mapstruct', 'org.flywaydb:flyway-core', 'org.liquibase:liquibase-core', 'org.postgresql:postgresql', 'com.mysql:mysql-connector-j', 'com.h2database:h2', 'org.apache.kafka:kafka-clients', 'io.grpc:grpc-netty', 'software.amazon.awssdk:s3',
] as const;
const DOTNET_PACKAGES = [
  'Microsoft.Extensions.DependencyInjection', 'Microsoft.Extensions.Configuration', 'Microsoft.AspNetCore.Authentication.JwtBearer', 'Microsoft.EntityFrameworkCore', 'Microsoft.EntityFrameworkCore.SqlServer', 'Microsoft.EntityFrameworkCore.Design', 'System.Text.Json', 'Newtonsoft.Json', 'Serilog', 'NLog', 'Dapper', 'MediatR', 'FluentValidation', 'AutoMapper', 'Polly', 'RestSharp', 'Grpc.Net.Client', 'StackExchange.Redis', 'Npgsql', 'Microsoft.Data.SqlClient', 'MongoDB.Driver', 'Azure.Identity', 'Azure.Storage.Blobs', 'AWSSDK.S3', 'OpenTelemetry', 'OpenTelemetry.Exporter.OpenTelemetryProtocol', 'Swashbuckle.AspNetCore', 'xunit', 'NUnit', 'MSTest.TestFramework', 'Moq', 'FluentAssertions', 'Bogus', 'BenchmarkDotNet', 'Microsoft.NET.Test.Sdk',
] as const;
const NATIVE_PACKAGES = [
  'boost', 'openssl', 'zlib', 'fmt', 'spdlog', 'catch2', 'gtest', 'benchmark', 'protobuf', 'grpc', 'abseil', 'sqlite3', 'libcurl', 'libxml2', 'libpng', 'libjpeg-turbo', 'eigen', 'opencv', 'qt', 'sdl', 'sfml', 'vulkan', 'glfw3', 'glew', 'assimp', 'rapidjson', 'nlohmann-json', 'poco', 'folly', 'tbb', 'llvm', 'cmake',
] as const;

const ADDITIONAL_DEPENDENCY_DEFINITIONS: DependencyDefinition[] = [
  ...JVM_PACKAGES.flatMap((name) => (['maven', 'gradle'] as const).map((ecosystem) => ({ id: 'jvm', name: 'JVM', ecosystemDependencies: [{ ecosystem, name }] }))),
  ...DOTNET_PACKAGES.map((name) => ({ id: 'dotnet', name: '.NET', ecosystemDependencies: [{ ecosystem: 'nuget' as const, name }] })),
  ...NATIVE_PACKAGES.flatMap((name) => (['conan', 'vcpkg'] as const).map((ecosystem) => ({ id: 'native-c-cpp', name: 'C/C++', ecosystemDependencies: [{ ecosystem, name }] }))),
];

function inventoryRule(definition: TechnologyDefinition): CompiledRule | undefined {
  const detectors = technologyDetectors(definition);
  if (!detectors.length) return undefined;
  return {
    group: groupForTechnology(definition),
    rule: {
      id: `technology.catalog.${definition.id}`, version: V3_PHASE2_KNOWLEDGE_VERSION, module: 'technology',
      title: `${definition.name} evidence`, description: `Confirms deterministic project evidence for ${definition.name}.`,
      technologies: [...new Set([definition.id, definition.name.toLowerCase()])], scope: ['production', 'configuration'], severity: 'info', confidence: 'confirmed', detectors,
      evidenceRequirements: { minimum: 1 }, recommendation: `Use the ${definition.name} evidence when reviewing the complete project technology graph.`,
      references: [], falsePositiveNotes: ['A declared or configured technology may not be exercised by every production path.'],
      budget: { maxFiles: 10_000, maxMatches: 20, maxContentBytes: 8 * 1024 * 1024, maxMilliseconds: 80 }, tags: ['inventory', definition.kind],
    },
  };
}

function technologyDetectors(definition: TechnologyDefinition): V3Detector[] {
  const detectors: V3Detector[] = [];
  if (definition.dependencies?.length) detectors.push({ kind: 'dependency', ecosystems: ['npm'], names: [...definition.dependencies] });
  for (const item of definition.ecosystemDependencies ?? []) detectors.push({ kind: 'dependency', ecosystems: [item.ecosystem as DependencyEcosystem], names: [item.name] });
  if (definition.files?.length) detectors.push({ kind: 'config', files: definition.files.flatMap(fileGlobs), operator: 'exists' });
  if (definition.filePrefixes?.length) detectors.push({ kind: 'regex', include: definition.filePrefixes.flatMap((item) => [item + '*', `**/${item}*`]), pattern: '\\S' });
  for (const signature of definition.manifestPatterns ?? []) detectors.push({ kind: 'config', files: signature.files.flatMap(fileGlobs), operator: 'matches', pattern: signature.pattern.source });
  const pathGlobs = PATH_GLOBS[definition.id];
  if (pathGlobs) detectors.push({ kind: 'regex', include: pathGlobs, pattern: '\\S' });
  return detectors;
}

const PATH_GLOBS: Record<string, string[]> = {
  'github-actions': ['.github/workflows/*.yml', '.github/workflows/*.yaml', '**/.github/workflows/*.yml', '**/.github/workflows/*.yaml'],
  'pm2-dependabot': ['.github/dependabot.yml', '.github/dependabot.yaml', '**/.github/dependabot.yml', '**/.github/dependabot.yaml'],
  'build2-msbuild': ['**/*.sln'], 'build2-xcode': ['**/*.xcodeproj/project.pbxproj'], 'build2-pyinstaller': ['**/*.spec'], 'runtime2-net': ['**/*.csproj'],
};

function sourceRules(): CompiledRule[] {
  const output: CompiledRule[] = [];
  for (const profile of SOURCE_PROFILES) for (const call of profile.calls) {
    const slug = safeId(call); const pattern = callPattern(call);
    output.push({
      group: profile.group,
      rule: {
        id: `${profile.module}.${profile.id}.${slug}`, version: V3_PHASE2_KNOWLEDGE_VERSION, module: profile.module,
        title: `${call} usage requires review`, description: `Locates ${call} usage at a sensitive code or compatibility boundary.`,
        technologies: profile.technologies, scope: ['production'], severity: 'warning', confidence: 'review-required',
        detectors: [{ kind: 'regex', include: profile.include, pattern }], evidenceRequirements: { minimum: 1 },
        recommendation: profile.recommendation, references: [profile.reference], falsePositiveNotes: ['Static presence alone does not prove exploitability or unsafe runtime data flow.'],
        budget: { maxFiles: 25_000, maxMatches: 50, maxContentBytes: 24 * 1024 * 1024, maxMilliseconds: 120 }, tags: ['phase2', 'review-boundary'],
      },
    });
  }
  for (const seed of CONFIG_RULES) output.push({
    group: seed.group,
    rule: {
      id: `${seed.module}.configuration.${seed.id}`, version: V3_PHASE2_KNOWLEDGE_VERSION, module: seed.module, title: seed.title,
      description: `${seed.title}; deterministic static evidence requires contextual review.`, technologies: seed.technologies,
      scope: seed.module === 'accessibility' ? ['production'] : ['configuration', 'production'], severity: 'warning', confidence: 'review-required',
      detectors: [{ kind: 'regex', include: seed.include, pattern: seed.pattern, flags: 'im' }], evidenceRequirements: { minimum: 1 },
      recommendation: seed.recommendation, references: [seed.reference], falsePositiveNotes: ['Generated examples and explicitly documented exceptions may be acceptable.'],
      budget: { maxFiles: 20_000, maxMatches: 50, maxContentBytes: 16 * 1024 * 1024, maxMilliseconds: 120 }, tags: ['phase2', 'configuration'],
    },
  });
  return output;
}

function dependencyRules(): CompiledRule[] {
  const signals = [...TECHNOLOGY_REGISTRY, ...ADDITIONAL_DEPENDENCY_DEFINITIONS].flatMap((definition) => dependencySignals(definition).map((signal) => ({ definition, ...signal })))
    .sort((left, right) => left.ecosystem.localeCompare(right.ecosystem) || left.definition.id.localeCompare(right.definition.id) || left.name.localeCompare(right.name));
  const output: CompiledRule[] = [];
  for (const policy of VERSION_POLICIES) for (const signal of signals) {
    const token = `${safeId(signal.name)}-${shortHash(signal.name)}`;
    output.push({
      group: groupForEcosystem(signal.ecosystem),
      rule: {
        id: `dependency.${signal.ecosystem}.${signal.definition.id}.${token}.${policy.id}`, version: V3_PHASE2_KNOWLEDGE_VERSION, module: 'dependency',
        title: `${policy.title}: ${signal.name}`, description: `Checks the declared ${signal.name} version used with ${signal.definition.name}.`,
        technologies: [...new Set([signal.definition.id, signal.definition.name.toLowerCase()])], scope: ['configuration', 'production'], severity: policy.severity, confidence: 'confirmed',
        detectors: [{ kind: 'dependency', ecosystems: [signal.ecosystem], names: [signal.name], version: policy.pattern }], evidenceRequirements: { minimum: 1 },
        recommendation: policy.recommendation, references: [ecosystemReference(signal.ecosystem)], falsePositiveNotes: ['Private registries and intentionally linked monorepo packages may follow a documented alternative release policy.'],
        budget: { maxFiles: 10_000, maxMatches: 20, maxContentBytes: 8 * 1024 * 1024, maxMilliseconds: 80 }, tags: ['phase2', 'dependency-health', policy.id],
      },
    });
  }
  return roundRobin(output, (item) => item.group);
}

function dependencySignals(definition: DependencyDefinition): Array<{ ecosystem: DependencyEcosystem; name: string }> {
  return [
    ...(definition.dependencies ?? []).map((name) => ({ ecosystem: 'npm' as const, name })),
    ...(definition.ecosystemDependencies ?? []).map((item) => ({ ecosystem: item.ecosystem as DependencyEcosystem, name: item.name })),
  ];
}

function compilePhase2Rules(): CompiledRule[] {
  const mandatory = [...TECHNOLOGY_REGISTRY.map(inventoryRule).filter((item): item is CompiledRule => Boolean(item)), ...sourceRules()];
  const seen = new Set<string>();
  const uniqueMandatory = mandatory.filter((item) => !seen.has(item.rule.id) && Boolean(seen.add(item.rule.id)));
  const remaining = V3_PHASE2_RULE_TARGET - uniqueMandatory.length;
  if (remaining < 0) throw new Error(`Phase 2 mandatory rules exceed target by ${Math.abs(remaining)}.`);
  const candidates = dependencyRules().filter((item) => !seen.has(item.rule.id) && Boolean(seen.add(item.rule.id)));
  if (candidates.length < remaining) throw new Error(`Phase 2 has only ${uniqueMandatory.length + candidates.length} rules; target is ${V3_PHASE2_RULE_TARGET}.`);
  return [...uniqueMandatory, ...candidates.slice(0, remaining)];
}

function buildPacks(compiled: CompiledRule[]): V3RulePack[] {
  const groups = new Map<string, V3Rule[]>();
  for (const item of compiled) groups.set(item.group, [...(groups.get(item.group) ?? []), item.rule]);
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([group, rules]) => ({
    schemaVersion: 3, id: `com.ryzova.uce.v3-phase2.${group}`, name: `UCE V3 Phase 2 — ${displayGroup(group)}`,
    version: V3_PHASE2_KNOWLEDGE_VERSION, publisher: 'RyzovaTech', description: `Validated Phase 2 core rules for ${displayGroup(group)}.`,
    uceCompatibility: '>=2.0.0 <4.0.0', technologies: unique(rules.flatMap((rule) => rule.technologies)), modules: unique(rules.map((rule) => rule.module)), rules,
  }));
}

export const V3_PHASE2_RULE_PACKS: V3RulePack[] = buildPacks(compilePhase2Rules());
export const V3_PHASE2_RULE_COUNT = V3_PHASE2_RULE_PACKS.reduce((total, pack) => total + pack.rules.length, 0);
export const V3_PHASE2_COVERAGE = V3_PHASE2_RULE_PACKS.map((pack) => ({
  id: pack.id, name: pack.name, rules: pack.rules.length, modules: pack.modules, technologies: pack.technologies.length,
}));

function fileGlobs(value: string): string[] { return value.includes('/') ? [value, `**/${value}`] : [value, `**/${value}`]; }
function safeId(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `signal-${shortHash(value)}`; }
function shortHash(value: string): string { let hash = 2166136261; for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function callPattern(value: string): string { return `\\b${escapeRegex(value).replace(/\\\./g, '\\s*\\.\\s*').replace(/::/g, '\\s*::\\s*')}\\s*\\(`; }
function unique<T extends string>(values: T[]): T[] { return [...new Set(values)].sort() as T[]; }
function displayGroup(group: string): string { return group.split('-').map((item) => item[0].toUpperCase() + item.slice(1)).join(' / '); }
function groupForEcosystem(ecosystem: DependencyEcosystem): string { return ({ npm: 'javascript-web', python: 'python', cargo: 'rust', go: 'go', maven: 'jvm', gradle: 'jvm', composer: 'php', nuget: 'dotnet', conan: 'native', vcpkg: 'native', ruby: 'other-ecosystems', dart: 'other-ecosystems', swift: 'other-ecosystems', mix: 'other-ecosystems' })[ecosystem]; }
function groupForTechnology(definition: TechnologyDefinition): string {
  const ecosystem = definition.ecosystemDependencies?.[0]?.ecosystem as DependencyEcosystem | undefined;
  if (ecosystem) return groupForEcosystem(ecosystem);
  if (definition.dependencies?.length) return 'javascript-web';
  if (/docker|cloud|ci|kubernetes|helm|vercel|netlify|aws|azure|gcp/i.test(`${definition.id} ${definition.kind}`)) return 'cloud-devops';
  if (/database|orm|storage|db2-/i.test(`${definition.id} ${definition.kind}`)) return 'api-data';
  if (/jvm|maven|gradle|java|kotlin/i.test(definition.id)) return 'jvm';
  if (/net|nuget|csharp|msbuild/i.test(definition.id)) return 'dotnet';
  if (/cargo|rust/i.test(definition.id)) return 'rust'; if (/python|pip|poetry|pdm/i.test(definition.id)) return 'python';
  if (/go-|golang|go-build|go-modules/i.test(definition.id)) return 'go'; if (/php|composer|laravel|symfony/i.test(definition.id)) return 'php';
  if (/cmake|meson|ninja|make|conan|vcpkg/i.test(definition.id)) return 'native'; return 'other-ecosystems';
}
function ecosystemReference(ecosystem: DependencyEcosystem): string {
  return ({ npm: 'https://docs.npmjs.com/cli/v10/configuring-npm/package-json', python: 'https://packaging.python.org/en/latest/specifications/dependency-specifiers/', cargo: 'https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html', go: 'https://go.dev/ref/mod', maven: 'https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html', gradle: 'https://docs.gradle.org/current/userguide/dependency_versions.html', composer: 'https://getcomposer.org/doc/04-schema.md', nuget: 'https://learn.microsoft.com/en-us/nuget/concepts/package-versioning', conan: 'https://docs.conan.io/2/reference/conanfile_txt.html', vcpkg: 'https://learn.microsoft.com/en-us/vcpkg/reference/vcpkg-json', ruby: 'https://bundler.io/guides/gemfile.html', dart: 'https://dart.dev/tools/pub/dependencies', swift: 'https://www.swift.org/package-manager/', mix: 'https://hexdocs.pm/mix/Mix.Tasks.Deps.html' })[ecosystem];
}
function roundRobin<T>(items: T[], key: (item: T) => string): T[] {
  const groups = new Map<string, T[]>(); for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  const keys = [...groups.keys()].sort(); const output: T[] = []; let index = 0;
  while (output.length < items.length) { for (const group of keys) { const item = groups.get(group)?.[index]; if (item) output.push(item); } index++; }
  return output;
}
