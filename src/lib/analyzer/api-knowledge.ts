export interface ApiRouteRule { framework: string; method: string; pattern: RegExp; confidence: number; }
const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;
export const API_ROUTE_RULES: readonly ApiRouteRule[] = [
  ...methods.map((method) => ({ framework: 'Express/Fastify/Hono', method: method.toUpperCase(), pattern: new RegExp(`\\b(?:app|router|server|api|fastify)\\s*\\.\\s*${method}\\s*\\(\\s*["'\\x60](\\/[^"'\\x60]*)["'\\x60]`, 'gi'), confidence: 92 })),
  ...methods.map((method) => ({ framework: 'FastAPI/Flask', method: method.toUpperCase(), pattern: new RegExp(`@(?:app|router|blueprint)\\.${method}\\s*\\(\\s*["'\\x60](\\/[^"'\\x60]*)["'\\x60]`, 'gi'), confidence: 94 })),
  { framework: 'Spring', method: 'GET', pattern: /@GetMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/gi, confidence: 94 },
  { framework: 'Spring', method: 'POST', pattern: /@PostMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/gi, confidence: 94 },
  { framework: 'Spring', method: 'PUT', pattern: /@PutMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/gi, confidence: 94 },
  { framework: 'Spring', method: 'DELETE', pattern: /@DeleteMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/gi, confidence: 94 },
  ...methods.slice(0, 5).map((method) => ({ framework: 'Laravel', method: method.toUpperCase(), pattern: new RegExp(`\\bRoute::${method}\\s*\\(\\s*["']([^"']+)["']`, 'gi'), confidence: 94 })),
  ...methods.slice(0, 5).map((method) => ({ framework: 'Gin/Fiber/Echo', method: method.toUpperCase(), pattern: new RegExp(`\\b(?:app|router|r|e|group)\\.${method.toUpperCase()}\\s*\\(\\s*["']([^"']+)["']`, 'g'), confidence: 90 })),
  { framework: 'ASP.NET', method: 'GET', pattern: /\[HttpGet\s*\(\s*["']([^"']*)["']\s*\)\]/gi, confidence: 92 },
  { framework: 'ASP.NET', method: 'POST', pattern: /\[HttpPost\s*\(\s*["']([^"']*)["']\s*\)\]/gi, confidence: 92 },
  { framework: 'Django', method: 'ROUTE', pattern: /\b(?:path|re_path)\s*\(\s*["']([^"']+)["']/gi, confidence: 86 },
  { framework: 'Go net/http', method: 'ROUTE', pattern: /\b(?:http\.)?HandleFunc\s*\(\s*["']([^"']+)["']/g, confidence: 88 },
  { framework: 'Rails/Phoenix', method: 'GET', pattern: /(?:^|\s)get\s+["']([^"']+)["']/gm, confidence: 82 },
] as const;
