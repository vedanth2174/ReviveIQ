import Groq from 'groq-sdk';
import 'dotenv/config';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function extractJSON(text) {
  let cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error("no JSON object found in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function diagnoseError(rawError, errorCode, retries = 3) {
  const prompt = `You are a payment failure classifier for an e-commerce platform.

Given a payment failure, classify it into exactly one category:
- "systemic": the failure was caused by our payment infrastructure, gateway, or bank-side technical issue (timeouts, 5xx errors, API failures, network issues) — NOT the customer's fault
- "user_side": the failure was caused by the customer (insufficient funds, wrong OTP, expired card, etc.)
- "unknown": the failure reason is ambiguous or doesn't clearly fit either category

Failure details:
Raw error message: "${rawError}"
Error code: "${errorCode}"

Respond with ONLY a JSON object, nothing else before or after it:
{"category": "systemic", "confidence": 0.9, "reasoning": "short reason here"}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300
      });
      const text = completion.choices[0].message.content;
      return extractJSON(text);
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1500 * attempt));
        continue;
      }
      console.error("Diagnosis agent error:", err.message);
      return { category: "unknown", confidence: 0, reasoning: "diagnosis failed - " + err.message };
    }
  }
}