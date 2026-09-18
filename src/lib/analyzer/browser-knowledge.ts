import type { BrowserName, BrowserCompatibilityFinding } from './types';

export interface BrowserFeatureDefinition {
  id: string;
  feature: string;
  kind: BrowserCompatibilityFinding['kind'];
  pattern: RegExp;
  minimums: Partial<Record<BrowserName, number>>;
  partialMinimums?: Partial<Record<BrowserName, number>>;
  unsupported?: BrowserName[];
  recommendation: string;
}

/** Versioned, deterministic web-platform knowledge. Versions are minimum stable releases. */
export const BROWSER_KNOWLEDGE_VERSION = '3.0.0';
export const BROWSER_FEATURES: readonly BrowserFeatureDefinition[] = [
  { id: 'webgpu', feature: 'WebGPU', kind: 'web-api', pattern: /navigator\.gpu\b/, minimums: { Chrome: 113, Edge: 113, Firefox: 141, Safari: 26 }, recommendation: 'Feature-detect navigator.gpu and provide a fallback.' },
  { id: 'view-transitions', feature: 'View Transitions API', kind: 'web-api', pattern: /document\.startViewTransition\b/, minimums: { Chrome: 111, Edge: 111, Firefox: 144, Safari: 18 }, recommendation: 'Feature-detect startViewTransition and provide a normal transition fallback.' },
  { id: 'popover', feature: 'Popover API', kind: 'web-api', pattern: /\.(?:showPopover|hidePopover|togglePopover)\s*\(|\b(?:popoverTargetElement|popoverTargetAction)\b|\bpopover\s*=\s*["'](?:auto|manual)["']/i, minimums: { Chrome: 114, Edge: 114, Firefox: 125, Safari: 17 }, recommendation: 'Feature-detect the Popover API or provide a dialog/menu fallback.' },
  { id: 'css-has', feature: 'CSS :has()', kind: 'css', pattern: /:has\s*\(/, minimums: { Chrome: 105, Edge: 105, Firefox: 121, Safari: 15.4 }, recommendation: 'Provide a fallback selector for browsers below the :has() baseline.' },
  { id: 'container-queries', feature: 'CSS container queries', kind: 'css', pattern: /@container\b/, minimums: { Chrome: 105, Edge: 105, Firefox: 110, Safari: 16 }, recommendation: 'Provide a media-query or layout fallback when container queries are unavailable.' },
  { id: 'css-nesting', feature: 'CSS nesting', kind: 'css', pattern: /(?:^|\})\s*[.#[:][^{]+\{[^{}]*&(?:\s|[.#[:])/m, minimums: { Chrome: 120, Edge: 120, Firefox: 117, Safari: 17.2 }, partialMinimums: { Chrome: 112, Edge: 112, Safari: 16.5 }, recommendation: 'Compile nested CSS or provide unnested rules for older targets.' },
  { id: 'css-subgrid', feature: 'CSS subgrid', kind: 'css', pattern: /grid-template-(?:rows|columns)\s*:\s*subgrid\b/i, minimums: { Chrome: 117, Edge: 117, Firefox: 71, Safari: 16 }, recommendation: 'Provide a regular grid fallback for browsers without subgrid.' },
  { id: 'color-mix', feature: 'CSS color-mix()', kind: 'css', pattern: /\bcolor-mix\s*\(/i, minimums: { Chrome: 111, Edge: 111, Firefox: 113, Safari: 16.2 }, recommendation: 'Provide a precomputed color fallback before color-mix().' },
  { id: 'backdrop-filter', feature: 'CSS backdrop-filter', kind: 'css', pattern: /(?:^|[;{\s])(?:-webkit-)?backdrop-filter\s*:/, minimums: { Chrome: 76, Edge: 79, Firefox: 103, Safari: 9 }, recommendation: 'Provide a background fallback for browsers without backdrop-filter.' },
  { id: 'focus-visible', feature: 'CSS :focus-visible', kind: 'css', pattern: /:focus-visible\b/, minimums: { Chrome: 86, Edge: 86, Firefox: 85, Safari: 15.4 }, recommendation: 'Keep a safe :focus fallback for keyboard focus styling.' },
  { id: 'structured-clone', feature: 'structuredClone()', kind: 'web-api', pattern: /\bstructuredClone\s*\(/, minimums: { Chrome: 98, Edge: 98, Firefox: 94, Safari: 15.4 }, recommendation: 'Use a compatible clone fallback for older browsers.' },
  { id: 'resize-observer', feature: 'ResizeObserver', kind: 'web-api', pattern: /\bnew\s+ResizeObserver\s*\(|\bResizeObserver\s*\(/, minimums: { Chrome: 64, Edge: 79, Firefox: 69, Safari: 13.1 }, recommendation: 'Load a ResizeObserver polyfill when older browsers are supported.' },
  { id: 'intersection-observer', feature: 'IntersectionObserver', kind: 'web-api', pattern: /\bnew\s+IntersectionObserver\s*\(|\bIntersectionObserver\s*\(/, minimums: { Chrome: 51, Edge: 15, Firefox: 55, Safari: 12.1 }, recommendation: 'Load a polyfill or provide an eager-loading fallback for older browsers.' },
  { id: 'abort-controller', feature: 'AbortController', kind: 'web-api', pattern: /\bnew\s+AbortController\s*\(/, minimums: { Chrome: 66, Edge: 16, Firefox: 57, Safari: 12.1 }, recommendation: 'Use a cancellation fallback or polyfill for older targets.' },
  { id: 'clipboard', feature: 'Async Clipboard API', kind: 'web-api', pattern: /navigator\.clipboard\b/, minimums: { Chrome: 66, Edge: 79, Firefox: 63, Safari: 13.1 }, recommendation: 'Feature-detect clipboard access and provide a manual copy fallback.' },
  { id: 'broadcast-channel', feature: 'BroadcastChannel', kind: 'web-api', pattern: /\bnew\s+BroadcastChannel\s*\(/, minimums: { Chrome: 54, Edge: 79, Firefox: 38, Safari: 15.4 }, recommendation: 'Use a storage-event or server-mediated fallback for older browsers.' },
  { id: 'dialog', feature: 'HTML dialog element', kind: 'web-api', pattern: /\.(?:showModal|close)\s*\(|<dialog\b/i, minimums: { Chrome: 37, Edge: 79, Firefox: 98, Safari: 15.4 }, recommendation: 'Provide dialog semantics and focus management through a compatible fallback.' },
  { id: 'web-bluetooth', feature: 'Web Bluetooth', kind: 'web-api', pattern: /navigator\.bluetooth\b/, minimums: { Chrome: 56, Edge: 79 }, unsupported: ['Firefox', 'Safari'], recommendation: 'Treat Web Bluetooth as an enhancement and provide a non-Bluetooth path.' },
  { id: 'file-system-access', feature: 'File System Access API', kind: 'web-api', pattern: /\b(?:showOpenFilePicker|showSaveFilePicker|showDirectoryPicker)\s*\(/, minimums: { Chrome: 86, Edge: 86 }, unsupported: ['Firefox', 'Safari'], recommendation: 'Provide input/download fallbacks when native file-system access is unavailable.' },
  { id: 'import-maps', feature: 'Import maps', kind: 'javascript', pattern: /<script[^>]+type=["']importmap["']/i, minimums: { Chrome: 89, Edge: 89, Firefox: 108, Safari: 16.4 }, recommendation: 'Bundle imports or provide an import-map fallback for older browsers.' },
  { id: 'optional-chaining', feature: 'Optional chaining', kind: 'javascript', pattern: /\?\./, minimums: { Chrome: 80, Edge: 80, Firefox: 74, Safari: 13.1 }, recommendation: 'Transpile optional chaining for older browser targets.' },
  { id: 'nullish-coalescing', feature: 'Nullish coalescing', kind: 'javascript', pattern: /\?\?=?/, minimums: { Chrome: 80, Edge: 80, Firefox: 72, Safari: 13.1 }, recommendation: 'Transpile nullish coalescing for older browser targets.' },
  { id: 'promise-all-settled', feature: 'Promise.allSettled()', kind: 'javascript', pattern: /\bPromise\.allSettled\s*\(/, minimums: { Chrome: 76, Edge: 79, Firefox: 71, Safari: 13 }, recommendation: 'Polyfill Promise.allSettled or use an equivalent aggregation strategy.' },
  { id: 'bigint', feature: 'BigInt', kind: 'javascript', pattern: /\bBigInt\s*\(|\b\d+n\b/, minimums: { Chrome: 67, Edge: 79, Firefox: 68, Safari: 14 }, recommendation: 'Avoid BigInt on older targets or provide a compatible numeric library.' },
  { id: 'array-at', feature: 'Array.prototype.at()', kind: 'javascript', pattern: /\.at\s*\(\s*-?\d+\s*\)/, minimums: { Chrome: 92, Edge: 92, Firefox: 90, Safari: 15.4 }, recommendation: 'Transpile or replace .at() when supporting older browsers.' },
] as const;
