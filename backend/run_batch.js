import fs from 'fs';
import { diagnoseError } from './agents/diagnose.js';
import { checkResolution } from './services/resolution.js';
import { decideIntervention } from './agents/intervene.js';
import { generateMessage } from './agents/message.js';
import { canNotify, markNotified } from './services/guardrails.js';

const events = JSON.parse(fs.readFileSync('./data/synthetic_events.json', 'utf-8'));
const auditLog = [];
const results = [];

function logStage(eventId, stage, output) {
  auditLog.push({ event_id: eventId, stage, output, timestamp: new Date().toISOString() });
}

async function processEvent(event) {
  const trace = {
    event_id: event.id,
    customer_id: event.customer_id,
    cart_value: event.cart_value,
    error_code: event.error_code,
    true_category: event._true_category
  };

  const diagnosis = await diagnoseError(event.raw_error, event.error_code);
  logStage(event.id, 'diagnosis', diagnosis);
  trace.predicted_category = diagnosis.category;
  trace.diagnosis_confidence = diagnosis.confidence;

  if (diagnosis.category !== 'systemic') {
    trace.final_status = 'ignored';
    return trace;
  }

  const resolution = checkResolution(events, event.error_code);
  logStage(event.id, 'resolution', resolution);
  trace.resolved = resolution.resolved;

  const intervention = await decideIntervention(diagnosis, resolution, event.cart_value);
  logStage(event.id, 'intervention', intervention);
  trace.action = intervention.action;

  if (intervention.action === 'hold') {
    trace.final_status = 'held';
    return trace;
  }

  const guardCheck = canNotify(event.customer_id, event.error_code);
  if (!guardCheck.allowed) {
    trace.final_status = 'blocked_by_guardrail';
    return trace;
  }

  const message = await generateMessage(event, diagnosis);
  markNotified(event.customer_id, event.error_code);
  logStage(event.id, 'message', { message });

  trace.final_status = intervention.action;
  trace.message = message;
  return trace;
}

async function runBatch() {
  console.log(`Processing ${events.length} events...\n`);

  for (let i = 0; i < events.length; i++) {
    const result = await processEvent(events[i]);
    results.push(result);
    console.log(`[${i + 1}/${events.length}] ${result.error_code} -> ${result.final_status}`);
  }

  fs.writeFileSync('./data/audit_log.json', JSON.stringify(auditLog, null, 2));
  fs.writeFileSync('./data/batch_results.json', JSON.stringify(results, null, 2));

  console.log(`\nDone. Saved audit_log.json and batch_results.json`);
  computeMetrics(results);
}

function computeMetrics(results) {
  const total = results.length;
  const systemic = results.filter(r => r.true_category === 'systemic');
  const correctlyDiagnosed = results.filter(r => r.predicted_category === r.true_category).length;

  const notified = results.filter(r => r.final_status === 'notify' || r.final_status === 'escalate');
  const held = results.filter(r => r.final_status === 'held');
  const ignored = results.filter(r => r.final_status === 'ignored');

  const revenueRecovered = notified.reduce((sum, r) => sum + r.cart_value, 0);

  console.log(`\n--- METRICS ---`);
  console.log(`Total events: ${total}`);
  console.log(`Diagnosis accuracy: ${correctlyDiagnosed}/${total} (${(correctlyDiagnosed/total*100).toFixed(1)}%)`);
  console.log(`Notified/Escalated: ${notified.length}`);
  console.log(`Held (correctly restrained): ${held.length}`);
  console.log(`Ignored (user-side/unknown): ${ignored.length}`);
  console.log(`Estimated revenue recovered: ₹${revenueRecovered}`);
}

runBatch();