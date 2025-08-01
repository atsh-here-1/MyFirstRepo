// server.js
const express = require('express');
const cors = require('cors');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://atsh.tech',
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

const rpName = 'Atsh Cyberpunk Terminal';
const rpID = 'atsh.tech';
const origin = 'https://atsh.tech';

// In-memory store
const users = new Map();

function getUser(username) {
  if (!users.has(username)) {
    users.set(username, { credentials: [] });
  }
  return users.get(username);
}

app.post('/register-challenge', (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).send('Invalid username');
  }
  const user = getUser(username);

  const options = generateRegistrationOptions({
    rpName,
    rpID,
    userName: username,
    attestationType: 'none',
    authenticatorSelection: { userVerification: 'prefered' },
  });

  user.currentChallenge = options.challenge;
  res.json(options);
});

app.post('/register-verify', async (req, res) => {
  const { username, ...body } = req.body;
  const user = getUser(username);
  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      user.credentials.push({
        publicKey: registrationInfo.credentialPublicKey,
        credentialID: registrationInfo.credentialID,
        counter: registrationInfo.counter,
      });
    }
    return res.json({ verified });
  } catch (err) {
    console.error(err);
    return res.status(400).send('Registration error: ' + err.message);
  }
});

app.post('/login-challenge', (req, res) => {
  const { username } = req.body;
  const user = getUser(username);
  if (!user || !user.credentials.length) {
    return res.status(404).send('No credentials found');
  }

  const options = generateAuthenticationOptions({
    rpID,
    userVerification: 'prefered',
    allowCredentials: user.credentials.map(cred => ({
      id: cred.credentialID,
      type: 'public-key',
    })),
  });
  user.currentChallenge = options.challenge;
  res.json(options);
});

app.post('/login-verify', async (req, res) => {
  const { username, ...body } = req.body;
  const user = getUser(username);
  const cred = user.credentials.find(c =>
    c.credentialID.toString('base64url') === body.id
  );
  if (!cred) return res.status(404).send('Credential not found');

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: cred.credentialID,
        credentialPublicKey: cred.publicKey,
        counter: cred.counter,
      },
    });
    const { verified, authenticationInfo } = verification;
    if (verified) cred.counter = authenticationInfo.newCounter;
    return res.json({ verified });
  } catch (err) {
    console.error(err);
    return res.status(400).send('Login error: ' + err.message);
  }
});

app.listen(PORT, () => console.log(`Auth server listening on ${PORT}`));
