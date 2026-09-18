import type { SecurityFinding, SecurityRuleCategory } from './types';

export interface SecurityRule {
  id: string;
  title: string;
  category: SecurityRuleCategory;
  severity: SecurityFinding['severity'];
  confidence: SecurityFinding['confidence'];
  pattern: RegExp;
  filePattern?: RegExp;
  evidence: string;
  recommendation: string;
  shouldReport?: (match: RegExpMatchArray) => boolean;
}

const PLACEHOLDER_RE = /^(?:example|sample|placeholder|changeme|change-me|replace-me|your[-_].+|xxx+|test(?:ing)?|dummy|none|null|undefined|<.+>|\$\{.+\})$/i;
const credentialIsConcrete = (match: RegExpMatchArray): boolean => {
  const value = (match[1] ?? '').trim();
  return value.length >= 8 && !PLACEHOLDER_RE.test(value) && !/^(?:process\.env|import\.meta\.env|os\.getenv|env\[)/i.test(value);
};

export const SECURITY_KNOWLEDGE_VERSION = '3.0.0';
export const SECURITY_RULES: readonly SecurityRule[] = [
  { id: 'SEC001', title: 'Potential hardcoded credential', category: 'secrets', severity: 'critical', confidence: 'medium', pattern: /(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["']([^"'\n]+)["']/i, evidence: 'A non-placeholder credential-like value is assigned directly in source.', recommendation: 'Move secrets to environment variables or a managed secret store.', shouldReport: credentialIsConcrete },
  { id: 'SEC002', title: 'Dynamic code execution', category: 'code-execution', severity: 'critical', confidence: 'high', pattern: /\beval\s*\(|new\s+Function\s*\(/, filePattern: /\.[cm]?[jt]sx?$/i, evidence: 'Dynamic JavaScript code execution was detected.', recommendation: 'Avoid eval/new Function and use explicit parsing or safe dispatch.' },
  { id: 'SEC003', title: 'Process execution API requires review', category: 'code-execution', severity: 'warning', confidence: 'medium', pattern: /\b(?:exec|execSync|spawn|spawnSync)\s*\(/, filePattern: /\.[cm]?[jt]s$/i, evidence: 'A process execution API is used; arguments may require trust-boundary review.', recommendation: 'Use fixed commands, argument arrays, and strict input validation.' },
  { id: 'SEC004', title: 'Unsafe HTML injection sink', category: 'injection', severity: 'warning', confidence: 'high', pattern: /\bdangerouslySetInnerHTML\b|\.innerHTML\s*=/, filePattern: /\.(?:[cm]?[jt]sx?|html?)$/i, evidence: 'Raw HTML is inserted into a document.', recommendation: 'Prefer escaped rendering and sanitize HTML that must be accepted.' },
  { id: 'SEC005', title: 'Non-HTTPS URL literal', category: 'transport', severity: 'info', confidence: 'medium', pattern: /\b(http:\/\/[^\s'"`]+)/i, evidence: 'A non-HTTPS URL literal may be used for network traffic.', recommendation: 'Use HTTPS for production traffic and avoid sending secrets over HTTP.', shouldReport: (match) => !/^http:\/\/(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:\/|$)/i.test(match[1]) },
  { id: 'SEC006', title: 'Wildcard CORS policy', category: 'access-control', severity: 'warning', confidence: 'high', pattern: /(?:Access-Control-Allow-Origin|origin)\s*[:=]\s*["']\*["']|cors\s*\(\s*\{[^}]*origin\s*:\s*["']\*["']/is, evidence: 'CORS appears to allow every origin.', recommendation: 'Restrict allowed origins to the domains required by the application.' },
  { id: 'SEC007', title: 'Debug logging in source', category: 'information-exposure', severity: 'info', confidence: 'medium', pattern: /\bconsole\.(?:log|debug)\s*\(/, filePattern: /\.[cm]?[jt]sx?$/i, evidence: 'Debug logging may expose sensitive runtime data.', recommendation: 'Remove sensitive debug logs or gate them behind a development-only logger.' },
  { id: 'SEC008', title: 'Private key material in source', category: 'secrets', severity: 'critical', confidence: 'high', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, evidence: 'A private-key header is embedded in source.', recommendation: 'Revoke and remove the key, then load replacement credentials from a secret store.' },
  { id: 'SEC009', title: 'AWS access key identifier in source', category: 'secrets', severity: 'critical', confidence: 'high', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/, evidence: 'A value matching an AWS access-key identifier is embedded in source.', recommendation: 'Revoke the credential and use workload identity or managed secrets.' },
  { id: 'SEC010', title: 'TLS certificate verification disabled', category: 'transport', severity: 'critical', confidence: 'high', pattern: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*[:=]\s*["']?0/i, filePattern: /\.[cm]?[jt]s$/i, evidence: 'TLS certificate verification is explicitly disabled.', recommendation: 'Restore certificate verification and configure the correct trust chain.' },
  { id: 'SEC011', title: 'Shell execution enabled', category: 'code-execution', severity: 'warning', confidence: 'medium', pattern: /\b(?:exec|spawn|execFile)\s*\([\s\S]{0,300}?shell\s*:\s*true/i, filePattern: /\.[cm]?[jt]s$/i, evidence: 'A child process is configured to execute through a shell.', recommendation: 'Avoid shell mode; pass a fixed executable and validated argument array.' },
  { id: 'SEC012', title: 'Weak randomness for security-sensitive value', category: 'cryptography', severity: 'warning', confidence: 'medium', pattern: /(?:token|secret|nonce|session|password|otp)[\w$]*\s*=\s*[^;\n]*Math\.random\s*\(/i, filePattern: /\.[cm]?[jt]s$/i, evidence: 'Math.random() appears to generate a security-sensitive value.', recommendation: 'Use crypto.getRandomValues() or a platform cryptographic random generator.' },
  { id: 'SEC013', title: 'Wildcard postMessage target', category: 'access-control', severity: 'warning', confidence: 'high', pattern: /\.postMessage\s*\([^,]+,\s*["']\*["']\s*\)/, filePattern: /\.[cm]?[jt]sx?$/i, evidence: 'A cross-window message is sent to every origin.', recommendation: 'Specify the exact trusted target origin and validate received message origins.' },
  { id: 'SEC014', title: 'Potential SQL string interpolation', category: 'injection', severity: 'warning', confidence: 'medium', pattern: /(?:query|execute)\s*\(\s*(?:`[^`]*(?:\$\{|\+)|["'][^"']*["']\s*\+)/i, evidence: 'A database query appears to be built through string interpolation or concatenation.', recommendation: 'Use parameterized queries or prepared statements.' },
  { id: 'SEC015', title: 'Unsafe Python pickle deserialization', category: 'deserialization', severity: 'critical', confidence: 'high', pattern: /\bpickle\.(?:loads?|Unpickler)\s*\(/, filePattern: /\.py$/i, evidence: 'Python pickle deserialization can execute attacker-controlled code.', recommendation: 'Do not deserialize untrusted pickle data; use a constrained data format.' },
  { id: 'SEC016', title: 'Potentially unsafe YAML loading', category: 'deserialization', severity: 'warning', confidence: 'medium', pattern: /\byaml\.load\s*\((?![^\n)]*(?:SafeLoader|safe_load))/, filePattern: /\.py$/i, evidence: 'YAML is loaded without an evident safe loader.', recommendation: 'Use yaml.safe_load() or explicitly select SafeLoader.' },
  { id: 'SEC017', title: 'PHP object deserialization', category: 'deserialization', severity: 'warning', confidence: 'medium', pattern: /\bunserialize\s*\(/, filePattern: /\.php$/i, evidence: 'PHP object deserialization requires strict trust-boundary review.', recommendation: 'Avoid unserialize() for untrusted input and prefer JSON with schema validation.' },
  { id: 'SEC018', title: 'BinaryFormatter usage', category: 'deserialization', severity: 'critical', confidence: 'high', pattern: /\b(?:new\s+)?BinaryFormatter\b/, filePattern: /\.cs$/i, evidence: 'BinaryFormatter is an unsafe legacy deserialization API.', recommendation: 'Replace BinaryFormatter with a safe, constrained serializer.' },
  { id: 'SEC019', title: 'Java native object deserialization', category: 'deserialization', severity: 'warning', confidence: 'medium', pattern: /\bnew\s+ObjectInputStream\s*\(/, filePattern: /\.java$/i, evidence: 'Native Java object deserialization requires strict input controls.', recommendation: 'Avoid deserializing untrusted objects; use allowlists and safer data formats.' },
  { id: 'SEC020', title: 'Weak cryptographic hash', category: 'cryptography', severity: 'warning', confidence: 'medium', pattern: /createHash\s*\(\s*["'](?:md5|sha1)["']|MessageDigest\.getInstance\s*\(\s*["'](?:MD5|SHA-?1)["']|hashlib\.(?:md5|sha1)\s*\(/i, evidence: 'MD5 or SHA-1 is used where collision resistance may be expected.', recommendation: 'Use SHA-256 or stronger for integrity; use a password-hashing function for passwords.' },
] as const;

export function validateSecurityRules(rules: readonly SecurityRule[] = SECURITY_RULES): string[] {
  const errors: string[] = []; const ids = new Set<string>();
  for (const rule of rules) {
    if (ids.has(rule.id)) errors.push(`Duplicate security rule id: ${rule.id}`); ids.add(rule.id);
    if (!/^SEC\d{3}$/.test(rule.id)) errors.push(`Invalid security rule id: ${rule.id}`);
    if (!rule.title || !rule.evidence || !rule.recommendation) errors.push(`Incomplete security rule: ${rule.id}`);
  }
  return errors;
}
