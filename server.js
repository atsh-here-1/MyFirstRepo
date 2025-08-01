// server.js — complete backend with debugging statements

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
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

const rpName = 'Atsh Cyberpunk Terminal';
const rpID = 'atsh.tech';
const origin = 'https://atsh.tech';

const users = new Map();

function getUser(username) {
  if (!users.has(username)) {
    users.set(username, { credentials: [] });
    console.log(`🆕 New user created: ${username}`);
  }
  return users.get(username);
}

app.post('/register-challenge', (req, res) => {
  const { username } = req.body;
  console.log("📩 Received /register-challenge for:", username);
  if (!username || typeof username !== 'string') {
    console.error("❌ Invalid username:", username);
    return res.status(400).send('Invalid username');
  }
  const user = getUser(username);

  const userIdBuffer = Buffer.from(username, 'utf8');
  const options = generateRegistrationOptions({
    rpName,
    rpID,
    userID: userIdBuffer,
    userName: username,
    attestationType: 'none',
    authenticatorSelection: { userVerification: 'preferred' },
  });

  console.log("🧾 Generated options.challenge (len):", options.challenge?.length);
  user.currentChallenge = options.challenge;

  res.json(options);
});

app.post('/register-verify', async (req, res) => {
  console.log("📥 Received /register-verify payload keys:", Object.keys(req.body));
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
    console.log("✅ Registration verified:", verified);

    if (verified && registrationInfo) {
      user.credentials.push({
        credentialID: registrationInfo.credentialID,
        publicKey: registrationInfo.credentialPublicKey,
        counter: registrationInfo.counter,
      });
      console.log("🗄️ Stored credentialID:", registrationInfo.credentialID.toString('base64url'));
    }

    res.json({ verified });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(400).send('Registration error: ' + err.message);
  }
});

app.post('/login-challenge', (req, res) => {
  const { username } = req.body;
  console.log("📩 Received /login-challenge for:", username);
  const user = getUser(username);
  if (!user.credentials.length) {
    console.error("❌ No credentials for user:", username);
    return res.status(404).send('No credentials found');
  }

  const options = generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: user.credentials.map(c => ({
      id: c.credentialID,
      type: 'public-key',
    })),
  });

  user.currentChallenge = options.challenge;
  console.log("🧾 Generated login options.challenge (len):", options.challenge?.length);

  res.json(options);
});

app.post('/login-verify', async (req, res) => {
  const { username, ...body } = req.body;
  console.log("📥 Received /login-verify body id:", body.id);
  const user = getUser(username);
  const cred = user.credentials.find(c =>
    c.credentialID.toString('base64url') === body.id
  );
  if (!cred) {
    console.error("❌ Credential not found for id:", body.id);
    return res.status(404).send('Credential not found');
  }

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
    console.log("✅ Login verified:", verified);

    if (verified) cred.counter = authenticationInfo.newCounter;
    res.json({ verified });
  } catch (err) {
    console.error("❌ Login verify error:", err);
    res.status(400).send('Login error: ' + err.message);
  }
});

app.listen(PORT, () => console.log(`Auth server listening on port ${PORT}`));
