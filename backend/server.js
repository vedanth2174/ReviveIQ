import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from "path";
import 'dotenv/config';

import { diagnoseError } from './agents/diagnose.js';
import { checkResolution } from './services/resolution.js';
import { decideIntervention } from './agents/intervene.js';
import { generateMessage } from './agents/message.js';
import { canNotify, markNotified, getNotifiedCount } from './services/guardrails.js';
import { sendWhatsAppMessage } from './services/whatsapp.js';
import { createRetryLink } from './services/razorpay.js';
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(
    __dirname,
    "data",
    "synthetic_events.json"
  );

const auditLog = [];
function logStage(eventId, stage, output) {
  auditLog.push({ event_id: eventId, stage, output, timestamp: new Date().toISOString() });
}

// load full dataset once — resolution detector needs the whole batch to compute rates
const allEvents = JSON.parse(fs.readFileSync(dataPath, "utf8"));

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

app.post('/send-whatsapp/:eventId', async (req, res) => {
    const { recipient } = req.body;
    const toNumber = recipient || process.env.WHATSAPP_TEST_RECIPIENT; // fallback if not provided
    const result = await sendWhatsAppMessage(toNumber);
    res.json(result);
  });

app.get('/batch-results', (req, res) => {
    const results = JSON.parse(fs.readFileSync('./data/batch_results.json', 'utf-8'));
    res.json(results);
  });
  
  app.get('/batch-metrics', (req, res) => {
    const results = JSON.parse(fs.readFileSync('./data/batch_results.json', 'utf-8'));
    const total = results.length;
    const correctlyDiagnosed = results.filter(r => r.predicted_category === r.true_category).length;
    const notified = results.filter(r => r.final_status === 'notify' || r.final_status === 'escalate');
    const held = results.filter(r => r.final_status === 'held');
    const ignored = results.filter(r => r.final_status === 'ignored');
    const revenueRecovered = notified.reduce((sum, r) => sum + r.cart_value, 0);
  
    res.json({
      total,
      diagnosis_accuracy: Math.round((correctlyDiagnosed / total) * 1000) / 10,
      notified_count: notified.length,
      held_count: held.length,
      ignored_count: ignored.length,
      revenue_recovered: revenueRecovered
    });
  });

  app.post('/live-process', async (req, res) => {
    const { error_code, raw_error, cart_value, customer_id } = req.body;
    const event = { id: `live_${Date.now()}`, customer_id: customer_id || 'demo_customer', cart_value, raw_error, error_code };
  
    try {
      const diagnosis = await diagnoseError(event.raw_error, event.error_code);
      const stages = { diagnosis };
  
      if (diagnosis.category !== 'systemic') {
        return res.json({ ...stages, final_status: 'ignored' });
      }
  
      const allEvents = JSON.parse(fs.readFileSync('./data/synthetic_events.json', 'utf-8'));
      const resolution = checkResolution(allEvents, event.error_code);
      stages.resolution = resolution;
  
      const intervention = await decideIntervention(diagnosis, resolution, event.cart_value);
      stages.intervention = intervention;
  
      if (intervention.action === 'hold') {
        return res.json({ ...stages, final_status: 'held' });
      }
  
      const retryLink = await createRetryLink(event);
      const message = await generateMessage(event, diagnosis);
      const finalMessage = retryLink ? message.replace('[RETRY_LINK]', retryLink) : message;
  
      stages.message = finalMessage;
      stages.retry_link = retryLink;
      stages.final_status = intervention.action;
      stages.event_id = event.id;
  
      res.json(stages);
    } catch (err) {
      console.error("Live process error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  const PORT = process.env.PORT || 5000;

  if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
  
  export default app;