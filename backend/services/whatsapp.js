import axios from 'axios';
import 'dotenv/config';

export async function sendWhatsAppMessage(toNumber) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: toNumber, // format: 91XXXXXXXXXX, no + or spaces
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME,
          language: { code: "en_US" } // hello_world uses en_US specifically
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return { success: true, message_id: response.data.messages[0].id };
  } catch (err) {
    console.error("WhatsApp send failed:", err.response?.data || err.message);
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}