import axios from 'axios';
import 'dotenv/config';

export async function sendWhatsAppMessage(toNumber, cartValue, retryLink) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: toNumber,
          type: "template",
          template: {
            name: "jaspers_market_order_confirmation_v1", // the grocery one
            language: { code: "en_US" }, // match whatever language it was approved in
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: "Customer" },
                  { type: "text", text: `Order retry - ₹${cartValue}` },
                  { type: "text", text: retryLink }
                ]
              }
            ]
          }
        },
        { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
      );
      return { success: true, message_id: response.data.messages[0].id };
    } catch (err) {
      console.error("WhatsApp send failed:", err.response?.data || err.message);
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  }