import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const systemicErrors = [
  { code: 'GATEWAY_TIMEOUT_5003', raw: 'Gateway timeout while processing transaction' },
  { code: 'BANK_API_5XX', raw: 'Issuer bank API returned 503 Service Unavailable' },
  { code: 'NPCI_UPI_TIMEOUT', raw: 'NPCI collect request timed out' },
];

const userSideErrors = [
  { code: 'INSUFFICIENT_FUNDS', raw: 'Issuer declined: insufficient funds' },
  { code: 'WRONG_OTP', raw: 'OTP verification failed' },
  { code: 'CARD_EXPIRED', raw: 'Card expired' },
];

const unknownErrors = [
  { code: 'UNKNOWN_DECLINE', raw: 'Transaction declined by issuer' },
];

function randomBetween(a, b) {
  return Math.random() * (b - a) + a;
}

function makeEvent(errType, categoryHint, timestamp) {
  return {
    id: uuidv4(),
    customer_id: `cust_${Math.floor(Math.random() * 1000)}`,
    cart_value: Math.round(randomBetween(299, 15000)),
    raw_error: errType.raw,
    error_code: errType.code,
    timestamp,
    _true_category: categoryHint
  };
}

function generateEvents() {
  const events = [];
  const now = Date.now();

  // Phase 1: NORMAL period (6 hrs to 3 hrs ago) — only user-side + unknown errors, no outage yet
  for (let i = 0; i < 20; i++) {
    const t = now - randomBetween(3, 6) * 60 * 60 * 1000;
    const pool = Math.random() < 0.8 ? userSideErrors : unknownErrors;
    const err = pool[Math.floor(Math.random() * pool.length)];
    const cat = pool === userSideErrors ? 'user_side' : 'unknown';
    events.push(makeEvent(err, cat, new Date(t).toISOString()));
  }

  // Phase 2: OUTAGE cluster (90 min to 40 min ago) — systemic errors spike hard
  for (let i = 0; i < 30; i++) {
    const t = now - randomBetween(40, 90) * 60 * 1000;
    const err = systemicErrors[Math.floor(Math.random() * systemicErrors.length)];
    events.push(makeEvent(err, 'systemic', new Date(t).toISOString()));
  }
  // sprinkle a few user-side errors during the outage too (realistic — not everyone hits the outage)
  for (let i = 0; i < 8; i++) {
    const t = now - randomBetween(40, 90) * 60 * 1000;
    const err = userSideErrors[Math.floor(Math.random() * userSideErrors.length)];
    events.push(makeEvent(err, 'user_side', new Date(t).toISOString()));
  }

  // Phase 3: COOLDOWN tail (last 30 min) — outage resolved, ZERO systemic errors, only user-side
  for (let i = 0; i < 17; i++) {
    const t = now - randomBetween(0, 30) * 60 * 1000;
    const pool = Math.random() < 0.85 ? userSideErrors : unknownErrors;
    const err = pool[Math.floor(Math.random() * pool.length)];
    const cat = pool === userSideErrors ? 'user_side' : 'unknown';
    events.push(makeEvent(err, cat, new Date(t).toISOString()));
  }

  return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

const events = generateEvents();
fs.writeFileSync('./data/synthetic_events.json', JSON.stringify(events, null, 2));
console.log(`Generated ${events.length} events → data/synthetic_events.json`);
console.log(`Systemic: ${events.filter(e => e._true_category === 'systemic').length}, User-side: ${events.filter(e => e._true_category === 'user_side').length}, Unknown: ${events.filter(e => e._true_category === 'unknown').length}`);