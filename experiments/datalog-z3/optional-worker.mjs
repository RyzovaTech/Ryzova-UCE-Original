import { evaluateSmartSequential } from './smart-sequential.mjs';

// One payload, one native-analysis process, no project source execution.
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 700 * 1024) {
    process.stdout.write(JSON.stringify({ status: 'unknown', reason: 'input-too-large' }));
    process.exit(0);
  }
}
try {
  const payload = JSON.parse(input);
  if (!payload || !Array.isArray(payload.files) || payload.files.length !== 2 ||
      typeof payload.workspace !== 'string' ||
      payload.files.some(f => !f || typeof f.path !== 'string' ||
        typeof f.content !== 'string' || f.content.length > 256 * 1024)) {
    process.stdout.write(JSON.stringify({ status: 'unknown', reason: 'invalid-input' }));
  } else {
    const r = await evaluateSmartSequential(payload.files, {
      workspace: payload.workspace,
      ...(payload.options ?? {}),
    });
    process.stdout.write(JSON.stringify(r));
  }
} catch {
  process.stdout.write(JSON.stringify({ status: 'unknown', reason: 'solver-failure' }));
}
