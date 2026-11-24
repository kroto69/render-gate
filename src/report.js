// Writes stable JSON results and concise human reports.
// Machine output never shares stdout with progress text.
import fs from 'node:fs';
import path from 'node:path';

export function writeSummary(runDir, result) {
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'summary.json'), `${JSON.stringify(result, null, 2)}\n`);
}

export function report(result, { json = false } = {}) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  const title = result.ok ? 'RENDER-GATE PASSED' : 'RENDER-GATE FAILED';
  const lines = [
    `${title}  composition=${result.composition}  stage=${result.stage}  code=${result.code}`,
    `Reason:   ${result.reason}`,
    ...(result.evidence?.length ? [`Evidence: ${result.evidence.join(', ')}`] : []),
    `Renders avoided (estimated): ${result.rendersAvoidedEstimate ?? 0}`,
  ];
  process.stderr.write(`${lines.slice(0, 12).join('\n')}\n`);
}
