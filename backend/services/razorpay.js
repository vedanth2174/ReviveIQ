import Razorpay from 'razorpay';
import 'dotenv/config';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

export async function createRetryLink(event, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const link = await razorpay.paymentLink.create({
        amount: event.cart_value * 100,
        currency: "INR",
        description: `Retry payment - ${event.error_code} resolved`,
        customer: {
          name: event.customer_id,
          contact: "9876543210" // your number
        },
        notify: { sms: false, email: false },
        reminder_enable: false
      });
      return link.short_url;
    } catch (err) {
      const isRateLimited = err.statusCode === 429;
      if (isRateLimited && attempt < retries) {
        const wait = 2000 * attempt;
        console.log(`  (Razorpay rate limited, retrying in ${wait}ms...)`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      console.error("Razorpay link creation failed:", err.error?.description || err.message);
      return null;
    }
  }
  return null;
}