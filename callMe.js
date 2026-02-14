require('dotenv').config();
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

client.calls.create({
    // We replace 'url' with 'twiml'.
    // <Say> tells the robot to speak.
    // voice="alice" is a standard female voice.
    twiml: `
      <Response>
        <Pause length="1"/>
        <Say voice="alice">
          System online. Hello Tyler. I am ready to get to work.
        </Say>
      </Response>
    `,
    to: process.env.MY_CELL_NUMBER,
    from: process.env.TWILIO_PHONE_NUMBER
})
.then(call => console.log(`Call started! SID: ${call.sid}`))
.catch(err => console.error(err));