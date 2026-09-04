// Deterministic resolution detector — no AI here on purpose.
// We don't want an LLM guessing at statistics; a clear rate comparison
// is more reliable and auditable for a yes/no signal like this.

const RECENT_WINDOW_MIN = 30;   // matches the cooldown tail length in our data
const PRIOR_WINDOW_MIN = 60;    // the window right before that (the outage itself)
const MIN_PRIOR_COUNT = 3;      // need at least this many failures to call it a real spike

export function checkResolution(events, errorCode) {
  const relevant = events.filter(e => e.error_code === errorCode);
  if (relevant.length === 0) {
    return { error_code: errorCode, resolved: false, confidence: 0, reason: "no events for this error code" };
  }

  // use the latest timestamp in the dataset as "now" — makes this work
  // consistently whether you run it live or hours after generating data
  const referenceTime = Math.max(...events.map(e => new Date(e.timestamp).getTime()));

  const recentCutoff = referenceTime - RECENT_WINDOW_MIN * 60 * 1000;
  const priorCutoff = recentCutoff - PRIOR_WINDOW_MIN * 60 * 1000;

  const recentCount = relevant.filter(e => {
    const t = new Date(e.timestamp).getTime();
    return t > recentCutoff && t <= referenceTime;
  }).length;

  const priorCount = relevant.filter(e => {
    const t = new Date(e.timestamp).getTime();
    return t > priorCutoff && t <= recentCutoff;
  }).length;

  if (priorCount < MIN_PRIOR_COUNT) {
    return { error_code: errorCode, resolved: false, confidence: 0, reason: `not enough prior failures to confirm a real spike (saw ${priorCount})` };
  }

  const dropRatio = 1 - (recentCount / priorCount);
  // resolved + confidence scales with how clean the drop is
  const resolved = recentCount === 0;
  const confidence = resolved ? Math.min(1, 0.6 + dropRatio * 0.4) : Math.max(0, dropRatio * 0.5);

  return {
    error_code: errorCode,
    resolved,
    confidence: Math.round(confidence * 100) / 100,
    prior_count: priorCount,
    recent_count: recentCount,
    reason: resolved
      ? `${priorCount} failures in prior window, 0 in recent window — likely resolved`
      : `${priorCount} prior, ${recentCount} recent — still occurring, not resolved`
  };
}