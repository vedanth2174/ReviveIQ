import { diagnoseError } from './agents/diagnose.js';
import events from './data/synthetic_events.json' with { type: 'json' };

const samples = events.slice(0, 5); // test on first 5 events

for (const event of samples) {
  const result = await diagnoseError(event.raw_error, event.error_code);
  console.log(`\n[${event.error_code}] "${event.raw_error}"`);
  console.log(`  True category: ${event._true_category}`);
  console.log(`  AI says: ${result.category} (confidence: ${result.confidence})`);
  console.log(`  Reasoning: ${result.reasoning}`);
}