import { sendWhatsAppMessage } from './services/whatsapp.js';

const result = await sendWhatsAppMessage("919172870354"); // your verified test recipient number, no + or spaces
console.log(result);