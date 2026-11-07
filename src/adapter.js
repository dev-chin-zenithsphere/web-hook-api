function parseSimulatorLine(line, receivedAt = new Date().toISOString()) {
  // Simulator-only grammar: WEIGHT=<finite number>;UNIT=<unit>;RESULT=OK|NG
  const fields = {}; const allowed = new Set(['WEIGHT', 'UNIT', 'RESULT']);
  for (const segment of line.split(';')) {
    const separator = segment.indexOf('=');
    if (separator < 1 || separator !== segment.lastIndexOf('=')) return { type: 'unparsed', reason: 'simulator line contains an invalid field segment', receivedAt };
    const key = segment.slice(0, separator).trim(); const value = segment.slice(separator + 1).trim();
    if (!allowed.has(key) || Object.hasOwn(fields, key)) return { type: 'unparsed', reason: 'simulator line contains an unknown or duplicate field', receivedAt };
    fields[key] = value;
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(fields.WEIGHT || '')) return { type: 'unparsed', reason: 'simulator line has an invalid WEIGHT', receivedAt };
  const weight = Number(fields.WEIGHT);
  if (!Number.isFinite(weight) || !/^[\x21-\x7e]{1,32}$/.test(fields.UNIT || '') || !['OK', 'NG'].includes(fields.RESULT)) return { type: 'unparsed', reason: 'simulator line lacks valid UNIT or explicit RESULT', receivedAt };
  return { type: 'result', weight, unit: fields.UNIT, result: fields.RESULT, receivedAt };
}
module.exports = { parseSimulatorLine };
