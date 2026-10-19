# Investigation of three 160-repository primary-language disagreements

The earlier 160-repository benchmark compared UCE's **primary project language** with GitHub Linguist's **dominant repository language**. Those fields answer overlapping but not identical questions.

## Reviewed at pinned source revisions

| Project | Source commit | GitHub label | UCE label | Technical finding |
|---|---|---|---|---|
| typicode/lowdb | `8a6fce9b72f769b22533f0979fbc2e73180f8112` | JavaScript | TypeScript | Root `tsconfig.json`, build invokes `tsc`, and first-party `src/index.ts` uses TypeScript. `package.json` exports built `.js` artifacts for JS users. TypeScript primary-source identity is defensible. |
| labs42io/clean-code-typescript | `05a25e8fb8f4cdca4e6cfbddd60323c6ddc5aa54` | TypeScript | YAML | Root repository is principally a documentation/guidelines corpus, with an extensive README and no root `package.json` or `tsconfig.json` at this revision. UCE selects YAML from configuration files; the meaningful issue is **documentation-only versus software-project identification**, not TypeScript runtime inference. |
| wasmerio/wasmer-java | `cbd3ac5b3de83b5abab12361614ea982f6a30d79` | Java | Rust | Root `build.gradle` configures Java JAR packaging; root `Cargo.toml` builds Rust `cdylib`; Gradle calls native Rust build. This is explicitly a **Java + Rust JNI project**. A single primary-language metric is underspecified; both languages should be preserved in mixed-stack output. |

These are **source-informed review decisions**, not independently adjudicated gold labels. No engine change is justified merely by disagreement with GitHub Linguist. Do not modify the original expected labels to make agreement percentages appear higher.

## Next decisions / regression coverage

1. Verify `lowdb` retains first-party TypeScript and JavaScript runtime/build artifacts in the report; document the intended distinction between source identity and distributed runtime artifacts.
2. Audit documentation/config-only project classification separately from general language detection. A software-score for READMEs plus YAML without executable source is suspicious; any fix must include positive and negative examples and preserve infrastructure-as-code repositories as software.
3. Verify `wasmer-java` reports both Java and Rust and surfaces mixed-language status. A future primary-language precedence policy should explicitly distinguish host app, native library, and overall volume; don't replace correct Rust detection with a hard-coded Java name match.
4. Treat all three as benchmark **disagreements requiring interpretation**, not confirmed false positives or false negatives.

See [RESULTS.md](RESULTS.md) for the earlier 160-project totals. For the 1,000-project extension, compare *GitHub-label agreement* separately from *source-review-confirmed correctness*.
