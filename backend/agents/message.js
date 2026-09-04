import Groq from 'groq-sdk';
import 'dotenv/config';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generateMessage(event, diagnosis, retries = 3) {
  const prompt = `Write a short recovery message to a customer whose payment failed and has now been fixed on our end.

Context:
- Cart value: ₹${event.cart_value}
- What went wrong: ${diagnosis.reasoning}
- It's now fixed — they can complete their purchase

Write in natural Hinglish (mix of Hindi and English, like how Indian customers are messaged on WhatsApp/SMS) — friendly, brief, reassuring, not apologetic or corporate.
Keep it under 300 characters, suitable for SMS/WhatsApp.
Include a placeholder [RETRY_LINK] where the payment link goes.

Respond with ONLY the message text, nothing else — no quotes, no JSON, no explanation.`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        reasoning_effort: "low"
      });
      return completion.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1500 * attempt));
        continue;
      }
      console.error("Message agent error:", err.message);
      return `Hi! Your order of ₹${event.cart_value} is ready — the payment issue is fixed now. Complete it here: [RETRY_LINK]`;
    }
  }
}