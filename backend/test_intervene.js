import { decideIntervention } from './agents/intervene.js';

// simulate outputs from the previous two steps
const diagnosis = { category: "systemic", confidence: 0.95, reasoning: "Gateway timeout, not customer's fault" };
const resolution = { resolved: true, confidence: 1, reason: "11 failures in prior window, 0 in recent window" };

const result1 = await decideIntervention(diagnosis, resolution, 13000);
console.log("High-value, resolved systemic issue:");
console.log(result1);

const lowConfResolution = { resolved: false, confidence: 0.3, reason: "still occurring" };
const result2 = await decideIntervention(diagnosis, lowConfResolution, 5000);
console.log("\nNot yet resolved:");
console.log(result2);

const userSideDiagnosis = { category: "user_side", confidence: 0.99, reasoning: "insufficient funds" };
const result3 = await decideIntervention(userSideDiagnosis, resolution, 3000);
console.log("\nUser-side failure (should never notify):");
console.log(result3);