import { generateMessage } from './agents/message.js';

const event = { cart_value: 13000 };
const diagnosis = { reasoning: "Gateway timeout, not customer's fault" };

const msg = await generateMessage(event, diagnosis);
console.log(msg);
console.log(`Length: ${msg.length} chars`);