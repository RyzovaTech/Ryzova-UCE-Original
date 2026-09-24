#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas/v3-rule-pack.schema.json'), 'utf8'));
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const full = path.resolve(root, relative);
  if (cache.has(full)) return cache.get(full).exports;
  const module = { exports: {} }; cache.set(full, module);
  if (full.endsWith('.json')) { module.exports = { default: JSON.parse(fs.readFileSync(full, 'utf8')) }; return module.exports; }
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', code)((name) => name.startsWith('.')
    ? load(path.resolve(path.dirname(full), name) + (path.extname(name) ? '' : '.ts')) : nativeRequire(name), module, module.exports);
  return module.exports;
}
/** Enforces every JSON Schema keyword used by the versioned V3 schema; local refs only. */
function validate(value, node, location = '$') {
  if (node.$ref) {
    if (!node.$ref.startsWith('#/$defs/')) throw Error('Unexpected external schema reference');
    return validate(value, schema.$defs[node.$ref.slice('#/$defs/'.length)], location);
  }
  if (node.oneOf) {
    const matching = node.oneOf.filter(branch => !validate(value, branch, location));
    return matching.length === 1 ? undefined : location + ': expected exactly one detector schema';
  }
  if ('const' in node && value !== node.const) return location + ': const mismatch';
  if (node.enum && !node.enum.includes(value)) return location + ': enum mismatch';
  if (node.type) {
    const matches = node.type === 'array' ? Array.isArray(value) :
      node.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) :
        node.type === 'integer' ? Number.isInteger(value) : typeof value === node.type;
    if (!matches) return location + ': expected ' + node.type;
  }
  if (typeof value === 'string') {
    if (node.minLength !== undefined && value.length < node.minLength) return location + ': string too short';
    if (node.maxLength !== undefined && value.length > node.maxLength) return location + ': string too long';
    if (node.pattern && !new RegExp(node.pattern).test(value)) return location + ': invalid pattern';
    if (node.format === 'uri') try { new URL(value); } catch { return location + ': invalid URI'; }
  }
  if (typeof value === 'number') {
    if (node.minimum !== undefined && value < node.minimum) return location + ': below minimum';
    if (node.maximum !== undefined && value > node.maximum) return location + ': above maximum';
    if (node.exclusiveMinimum !== undefined && value <= node.exclusiveMinimum) return location + ': below exclusive minimum';
  }
  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) return location + ': too few items';
    if (node.maxItems !== undefined && value.length > node.maxItems) return location + ': too many items';
    if (node.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) return location + ': duplicate items';
    for (let index = 0; index < value.length; index++) {
      const error = validate(value[index], node.items, location + '[' + index + ']');
      if (error) return error;
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of node.required ?? []) if (!(key in value)) return location + ': missing ' + key;
    for (const [key, entry] of Object.entries(value)) {
      if (node.additionalProperties === false && !(key in (node.properties ?? {}))) return location + ': unexpected ' + key;
      if (node.properties?.[key]) {
        const error = validate(entry, node.properties[key], location + '.' + key);
        if (error) return error;
      }
    }
  }
}
const { V3_DEFAULT_RULE_PACKS } = load('src/lib/knowledge/v3-default-packs.ts');
let rules = 0;
for (const pack of V3_DEFAULT_RULE_PACKS) {
  assert.equal(validate(pack, schema), undefined, pack.id);
  rules += pack.rules.length;
}
assert.equal(rules, 10_000);
const exemplar = structuredClone(V3_DEFAULT_RULE_PACKS[0]);
assert.ok(validate({ ...exemplar, extra: 1 }, schema));
assert.ok(validate({ ...exemplar, rules: [{ ...exemplar.rules[0], severity: 'urgent' }] }, schema));
assert.ok(validate({ ...exemplar, rules: [{ ...exemplar.rules[0], detectors: [{ kind: 'unknown' }] }] }, schema));
console.log(JSON.stringify({ schema: schema.$id, validatedPacks: V3_DEFAULT_RULE_PACKS.length, validatedRules: rules, negativeSchemaTests: 3 }));
