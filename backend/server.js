import express from 'express';
import cors from 'cors';
import fs from 'fs';
import 'dotenv/config';

import { diagnoseError } from './agents/diagnose.js';
import { checkResolution } from './services/resolution.js';
import { decideIntervention } from './agents/intervene.js';
import { generateMessage } from './agents/message.js';
import { canNotify, markNotified, getNotifiedCount } from './services/guardrails.js';

const app = express();
app.use(cors());
app.use(express.json());

const auditLog = [];
function logStage(eventId, stage, output) {
  auditLog.push({ event_id: eventId, stage, output, timestamp: new Date().toISOString() });
}

// load full dataset once — resolution detector needs the whole batch to compute rates
const allEvents = JSON.parse(fs.readFileSync('./data/synthetic_events.json', 'utf-8'));

async function processEvent(event) {
  const trace = { event_id: event.id, customer_id: event.customer_id, cart_value: event.cart_value, error_code: event.error_code };

  const diagnosis = await diagnoseError(event.raw_error, event.error_code);
  logStage(event.id, 'diagnosis', diagnosis);
  trace.diagnosis = diagnosis;

  if (diagnosis.category !== 'systemic') {
    trace.final_status = 'ignored';
    trace.reason = `category is ${diagnosis.category}, not actionable`;
    return trace;
  }

  const resolution = checkResolution(allEvents, event.error_code);
  logStage(event.id, 'resolution', resolution);
  trace.resolution = resolution;

  const intervention = await decideIntervention(diagnosis, resolution, event.cart_value);
  logStage(event.id, 'intervention', intervention);
  trace.intervention = intervention;

  if (intervention.action === 'hold') {
    trace.final_status = 'held';
    return trace;
  }

  const guardCheck = canNotify(event.customer_id, event.error_code);
  if (!guardCheck.allowed) {
    trace.final_status = 'blocked_by_guardrail';
    trace.reason = guardCheck.reason;
    logStage(event.id, 'guardrail', guardCheck);
    return trace;
  }

  const message = await generateMessage(event, diagnosis);
  markNotified(event.customer_id, event.error_code);
  logStage(event.id, 'message', { message });

  trace.final_status = intervention.action; // notify or escalate
  trace.message = message;
  return trace;
}

app.post('/process-event', async (req, res) => {
  const result = await processEvent(req.body);
  res.json(result);
});

app.get('/audit-log', (req, res) => res.json(auditLog));

app.get('/metrics', (req, res) => {
  res.json({
    total_processed: new Set(auditLog.map(l => l.event_id)).size,
    notified_count: getNotifiedCount(),
    audit_entries: auditLog.length
  });
});

app.listen(process.env.PORT || 5000, () => console.log(`ReviveIQ running on port ${process.env.PORT || 5000}`));