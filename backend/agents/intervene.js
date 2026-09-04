import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

function extractJSON(text) {
  let cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error("no JSON object found in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function decideIntervention(diagnosis, resolution, cartValue, retries = 5) {
  const prompt = `You are deciding whether to reach out to a customer whose payment failed.

Diagnosis of why it failed:
- Category: ${diagnosis.category}
- Confidence: ${diagnosis.confidence}
- Reasoning: ${diagnosis.reasoning}

Whether the underlying issue is now resolved:
- Resolved: ${resolution.resolved}
- Confidence: ${resolution.confidence}
- Detail: ${resolution.reason}

Cart value: ₹${cartValue}

Rules to follow:
- Only consider notifying if diagnosis category is "systemic" AND resolution is resolved with reasonable confidence (>0.6)
- If either confidence is low, prefer "hold" — do not guess
- If cart value is high (>10000) and everything looks good, you may suggest "escalate" for human follow-up in addition to auto-notify
- Never notify if diagnosis category is "user_side" or "unknown" — customer already knows what happened, message would be noise
- Be conservative: it is better to hold and miss a recovery than to message someone unnecessarily

Respond with ONLY a JSON object, nothing else:
{"action": "notify" | "hold" | "escalate", "channel": "sms" | "whatsapp" | "none", "reasoning": "one short sentence"}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return extractJSON(text);
    } catch (err) {
      const isOverloaded = err.message.includes('503') || err.message.includes('overloaded');
      if (isOverloaded && attempt < retries) {
        await new Promise(r => setTimeout(r, 1500 * attempt));
        continue;
      }
      console.error("Intervention agent error:", err.message);
      return { action: "hold", channel: "none", reasoning: "intervention decision failed - defaulting to hold - " + err.message };
    }
  }
}