// api/twiml-forward.js
// Receives inbound calls to +61485043210 and forwards to Alex's mobile.
// Twilio Voice webhook → HTTP POST

export default function handler(req, res) {
  const forwardTo = process.env.CALL_FORWARD_NUMBER || '+61404349425';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="+61485043210">
    <Number>${forwardTo}</Number>
  </Dial>
</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml);
}
