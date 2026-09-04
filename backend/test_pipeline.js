const testEvent = {
    id: "test1",
    customer_id: "cust_999",
    cart_value: 9500,
    raw_error: "Gateway timeout while processing transaction",
    error_code: "GATEWAY_TIMEOUT_5003"
  };
  
  const res = await fetch('http://localhost:5000/process-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testEvent)
  });
  
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));