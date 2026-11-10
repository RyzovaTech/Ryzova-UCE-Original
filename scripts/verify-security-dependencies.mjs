import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));

function gte(actual, required) {
  const parts = value => {
    assert.match(value, /^\d+\.\d+\.\d+$/, "Non-semver lock entry: " + value);
    return value.split(".").map(Number);
  };
  const a = parts(actual), b = parts(required);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}
const modules = {
  "node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion": "5.0.12",
  "node_modules/brace-expansion": "1.1.21",
  "node_modules/source-map-js": "1.2.2",
  "node_modules/vite": "8.3.5",
};
assert.equal(pkg.devDependencies.vite, "^8.3.5", "Vite's declared range must match the patched build.");
assert.equal(lock.packages[""].devDependencies.vite, pkg.devDependencies.vite, "Root lock manifest and package manifest must agree.");
for (const [path, minimum] of Object.entries(modules)) {
  const entry = lock.packages[path];
  assert.ok(entry, "Missing transitive dependency " + path);
  assert.ok(gte(entry.version, minimum), path + ": vulnerable or stale version " + entry.version + "; expected >= " + minimum);
  assert.ok(entry.resolved?.startsWith("https://registry.npmjs.org/"), path + ": missing canonical npm resolved URL");
  assert.ok(entry.integrity?.startsWith("sha512-"), path + ": missing npm integrity");
}
for (const [path, entry] of Object.entries(lock.packages)) {
  const name = path.split("/").at(-1);
  if (name === "source-map-js") assert.ok(gte(entry.version, "1.2.2"), "Outdated source-map-js at " + path);
  if (name === "vite" && entry.version.startsWith("8.2.")) assert.ok(gte(entry.version, "8.2.4"), "Vulnerable Vite at " + path);
  if (name === "brace-expansion" && entry.version.startsWith("5.")) assert.ok(gte(entry.version, "5.0.12"), "Vulnerable brace-expansion at " + path);
}
console.log("PASS: UCE Dependabot 2026-11 regression: lockfile versions, integrity, and declared Vite range.");
