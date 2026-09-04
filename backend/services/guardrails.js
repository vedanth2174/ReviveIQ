// Deterministic stopping-rule enforcement.
// Tracks who's already been notified so we NEVER message the same
// customer twice for the same incident — this is our compliance/stopping rule.

const notifiedCustomers = new Map(); // customer_id -> { error_code, timestamp }
const MAX_ATTEMPTS = 1; // hard cap per incident, per your original design

export function canNotify(customerId, errorCode) {
  const key = `${customerId}:${errorCode}`;
  if (notifiedCustomers.has(key)) {
    return { allowed: false, reason: "already notified for this incident, stopping rule enforced" };
  }
  return { allowed: true, reason: "not yet notified" };
}

export function markNotified(customerId, errorCode) {
  const key = `${customerId}:${errorCode}`;
  notifiedCustomers.set(key, { timestamp: new Date().toISOString(), attempts: 1 });
}

export function getNotifiedCount() {
  return notifiedCustomers.size;
}