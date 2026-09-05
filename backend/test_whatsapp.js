import { sendWhatsAppMessage } from './services/whatsapp.js';

const result = await sendWhatsAppMessage(
  "919172870354",           // your verified test number
  10466,                     // sample cart value
  "https://rzp.io/rzp/AQCHhWN" // a real link from your batch data, or generate a fresh one
);
console.log(result);