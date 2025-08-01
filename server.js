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
  credentials: true,
}));
app.use(express.json());

const rpName = 'Atsh Cyberpunk Terminal';
const rpID = 'atsh.tech';
const origin = 'https://atsh.tech';

// In-memory user store
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
  console.log("📩 /register-challenge for:", username);

  if (!username || typeof username !== 'string') {
    console.error("❌ Invalid username:", username);
    return res.status(400).send('Invalid username');
  }

  const user = getUser(username);
  const userIdBuffer = Buffer.from(username, 'utf8');

  const options = generateRegistrationOptions({
    rpName,
    rpID,
    userID: userIdBuffer, // ✅ Required to generate challenge properly
    userName: username,
    attestationType: 'none',
    authenticatorSelection: {
      userVerification: 'preferred',
    },
  });

  user.currentChallenge = options.challenge;

  console.log("✅ Challenge generated:", options.challenge);
  res.json(options);
});


// ---------- Passkey Registration Verification ----------
app.post('/register-verify', async (req, res) => {
  const { username, ...body } = req.body;
  console.log("📥 /register-verify from:", username);
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
        credentialID: registrationInfo.credentialID,
        publicKey: registrationInfo.credentialPublicKey,
        counter: registrationInfo.counter,
      });
      console.log("✅ Passkey verified and stored:", registrationInfo.credentialID.toString('base64url'));
    }

    res.json({ verified });
  } catch (err) {
    console.error("❌ Registration failed:", err.message);
    res.status(400).send('Registration error: ' + err.message);
  }
});

// ---------- Login Challenge ----------
app.post('/login-challenge', (req, res) => {
  const { username } = req.body;
  console.log("📩 /login-challenge for:", username);
  const user = getUser(username);

  if (!user || user.credentials.length === 0) {
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
  console.log("✅ Login challenge:", options.challenge);

  res.json(options);
});

// ---------- Login Verification ----------
app.post('/login-verify', async (req, res) => {
  const { username, ...body } = req.body;
  console.log("📥 /login-verify for:", username);

  const user = getUser(username);
  const cred = user.credentials.find(c =>
    c.credentialID.toString('base64url') === body.id
  );

  if (!cred) {
    console.error("❌ Credential not found for:", body.id);
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
    if (verified) {
      cred.counter = authenticationInfo.newCounter;
      console.log("✅ Login verified for:", username);
    }

    res.json({ verified });
  } catch (err) {
    console.error("❌ Login verification failed:", err.message);
    res.status(400).send('Login error: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
