import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

function extractJSON(text) {
  // strip markdown fences if present
  let cleaned = text.replace(/```json|```/g, '').trim();
  // find the first { and last } to grab just the JSON object
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
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return extractJSON(text);
    } catch (err) {
      const isOverloaded = err.message.includes('503') || err.message.includes('overloaded');
      if (isOverloaded && attempt < retries) {
        console.log(`  (retrying after 503, attempt ${attempt}/${retries})`);
        await new Promise(r => setTimeout(r, 1500 * attempt)); // backoff
        continue;
      }
      console.error("Diagnosis agent error:", err.message);
      return { category: "unknown", confidence: 0, reasoning: "diagnosis failed - " + err.message };
    }
  }
}