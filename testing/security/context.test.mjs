import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';
const { detectSecurityIntelligence } = load('src/lib/analyzer/security-intelligence.ts');
const scan = (content, path = 'src/app.js') => detectSecurityIntelligence([{ path, content, size: Buffer.byteLength(content), isDirectory: false }]).findings;
const has = (content, rule, path) => scan(content, path).some(row => row.ruleId === rule);
test('regex and nested template literals are prose; template expressions remain executable', () => {
  assert.equal(has('const regex = /eval(input)/;', 'SEC002'), false);
  assert.equal(has('const text = `eval(input)`;', 'SEC002'), false);
  assert.equal(has('const text = `outer ${`inner ${eval(input)}`}`;', 'SEC002'), true);
});
test('secrets and endpoint literals remain reviewable', () => {
  assert.equal(has('const api_key = "a-real-long-secret";', 'SEC001'), true);
  assert.equal(has('const key = "AKIAABCDEFGHIJKLMNOP";', 'SEC009'), true);
  assert.equal(has('fetch("http://example.com/api");', 'SEC005'), true);
  assert.equal(has('// const key = "AKIAABCDEFGHIJKLMNOP";', 'SEC009'), false);
  assert.equal(has('const key = "http://example.com/*"; eval(input);', 'SEC002'), true);
});
test('quoted configuration keys stay active while equivalent text examples do not', () => {
  assert.equal(has('const options = {"verify_signature": false};', 'SEC023'), true);
  assert.equal(has('const docs = \'{"verify_signature": false}\';', 'SEC023'), false);
});
test('C++/Rust raw literals and Go raw strings do not manufacture review calls', () => {
  assert.equal(has('const char *s = R"tag(createHash("md5"))tag";', 'SEC020', 'src/app.cpp'), false);
  assert.equal(has('let s = r##"createHash("md5")"##;', 'SEC020', 'src/app.rs'), false);
  assert.equal(has('s := `http.Get(request.URL.Query().Get("url"))`', 'SEC022', 'src/app.go'), false);
  assert.equal(has('let s = r##"/*"##; createHash("md5");', 'SEC020', 'src/app.rs'), true);
});
test('tokenization failure does not discard findings in the unknown suffix', () => {
  assert.equal(has('const invalid = @; eval(input);', 'SEC002'), true);
});
test('specific password-hash review subsumes only overlapping generic hash signals', () => {
  const specific = scan('const digest = createHash("md5").update(password);');
  assert.equal(specific.some(row => row.ruleId === 'SEC028'), true);
  assert.equal(specific.some(row => row.ruleId === 'SEC020'), false);
  assert.equal(has('const checksum = createHash("md5").update(file);', 'SEC020'), true);
  const separate = scan('const checksum = createHash("sha1").update(file);\nconst digest = createHash("md5").update(password);');
  assert.equal(separate.some(row => row.ruleId === 'SEC020' && row.line === 1), true);
});

test('Python comments/prose stay excluded without hiding secret or endpoint literals', () => {
  assert.equal(has('marker = "/*"\npickle.loads(data)', 'SEC015', 'src/app.py'), true);
  assert.equal(has('key = "AKIAABCDEFGHIJKLMNOP"', 'SEC009', 'src/app.py'), true);
  assert.equal(has('requests.get("http://example.com/api")', 'SEC005', 'src/app.py'), true);
  assert.equal(has('"""AKIAABCDEFGHIJKLMNOP"""', 'SEC009', 'src/app.py'), false);
  assert.equal(has('value = 1 # pickle.loads(data)', 'SEC015', 'src/app.py'), false);
});
