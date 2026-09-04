import fs from 'fs';
import { checkResolution } from './services/resolution.js';

const events = JSON.parse(fs.readFileSync('./data/synthetic_events.json', 'utf-8'));
const errorCodes = ['GATEWAY_TIMEOUT_5003', 'BANK_API_5XX', 'NPCI_UPI_TIMEOUT', 'INSUFFICIENT_FUNDS'];

for (const code of errorCodes) {
  const result = checkResolution(events, code);
  console.log(`\n[${code}]`);
  console.log(`  Resolved: ${result.resolved}, Confidence: ${result.confidence}`);
  console.log(`  ${result.reason}`);
}