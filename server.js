// server.js
const express = require('express');
const session = require('express-session');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// CORS
app.use(cors({
  origin: 'https://atsh.tech',
  credentials: true,
}));
app.use(express.json());

// Session for challenge storage
app.use(session({
  secret: 'supersecret',
  saveUninitialized: true,
  resave: false,
}));

const rpName = 'Atsh Cyberpunk Terminal';
const rpID = 'atsh.tech';
const origin = 'https://atsh.tech';

const users = new Map();

function getUser(username) {
  if (!users.has(username)) {
    users.set(username, { credentials: [] });
    console.log(`🆕 Created user: ${username}`);
  }
  return users.get(username);
}

app.post('/register-challenge', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).send('Missing username');

  const user = getUser(username);
  const options = generateRegistrationOptions({
    rpName,
    rpID,
    userID: Buffer.from(username),
    userName: username,
    attestationType: 'none',
    authenticatorSelection: {
      userVerification: 'preferred',
    },
    excludeCredentials: user.credentials.map(cred => ({
      id: cred.credentialID,
      type: 'public-key',
    })),
  });

  req.session.challenge = options.challenge;
  user.currentChallenge = options.challenge;

  console.log("📨 Sent registration challenge:", options.challenge);
  res.json(options);
});

app.post('/register-verify', async (req, res) => {
  const { username, ...response } = req.body;
  const user = getUser(username);

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: req.session.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
      user.credentials.push({
        credentialID,
        publicKey: credentialPublicKey,
        counter,
      });
      console.log("✅ Registered passkey:", credentialID.toString('base64url'));
      return res.send('Passkey registered successfully');
    }

    return res.status(400).send('Verification failed');
  } catch (e) {
    console.error("❌ Error verifying registration:", e);
    res.status(400).send('Verification error: ' + e.message);
  }
});

app.post('/login-challenge', (req, res) => {
  const { username } = req.body;
  const user = getUser(username);
  if (!user.credentials.length) return res.status(404).send('No credentials');

  const options = generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: user.credentials.map(cred => ({
      id: cred.credentialID,
      type: 'public-key',
    })),
  });

  req.session.challenge = options.challenge;
  user.currentChallenge = options.challenge;

  res.json(options);
});

app.post('/login-verify', async (req, res) => {
  const { username, ...response } = req.body;
  const user = getUser(username);

  const cred = user.credentials.find(c => c.credentialID.toString('base64url') === response.id);
  if (!cred) return res.status(404).send('Credential not found');

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: req.session.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: cred.credentialID,
        credentialPublicKey: cred.publicKey,
        counter: cred.counter,
      },
    });

    if (verification.verified) {
      cred.counter = verification.authenticationInfo.newCounter;
      return res.send('Authentication successful');
    } else {
      return res.status(400).send('Authentication failed');
    }
  } catch (e) {
    console.error("❌ Login verification failed:", e);
    return res.status(400).send('Login error: ' + e.message);
  }
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
