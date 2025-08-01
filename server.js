// server.js
const express = require('express');
const cors = require('cors');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');

const app = express();
const PORT = process.env.PORT || 3000;

// === ✅ CORS for Netlify Frontend ===
app.use(cors({
  origin: 'https://atsh.tech', // ✅ Netlify custom domain
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false,
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// === 📍 WebAuthn Config ===
const rpName = 'Atsh Cyberpunk Terminal';
const rpID = 'atsh.tech'; // domain
const origin = 'https://atsh.tech'; // frontend

// === 🧠 In-Memory "DB" ===
const users = new Map(); // username => { id, credentials, challenge }

function getUser(username) {
  if (!users.has(username)) {
    const id = Buffer.from(username).toString('base64url');
    users.set(username, { id, credentials: [] });
  }
  return users.get(username);
}

// === 1️⃣ /register-challenge ===
app.post('/register-challenge', (req, res) => {
  const { username } = req.body;
  console.log("📩 /register-challenge from:", username);
  if (!username) return res.status(400).send("Missing username");

  const user = getUser(username);

  const options = generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,
    userName: username,
    attestationType: 'none',
    authenticatorSelection: { userVerification: 'preferred' },
  });

  user.currentChallenge = options.challenge;
  res.json(options);
});

// === 2️⃣ /register-verify ===
app.post('/register-verify', async (req, res) => {
  const { username, ...body } = req.body;
  console.log("🔐 /register-verify for:", username);

  const user = getUser(username);
  if (!user) return res.status(404).send("User not found");

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
        id: registrationInfo.credentialID,
        counter: registrationInfo.counter ?? 0,
      });
    }

    res.send(verified ? "✅ Registered successfully!" : "❌ Verification failed.");
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(400).send("Registration error: " + err.message);
  }
});

// === 3️⃣ /login-challenge ===
app.post('/login-challenge', (req, res) => {
  const { username } = req.body;
  console.log("📩 /login-challenge from:", username);

  const user = getUser(username);
  if (!user || !user.credentials.length)
    return res.status(404).send("No credentials registered");

  const options = generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: user.credentials.map(cred => ({
      id: cred.id,
      type: 'public-key',
    })),
  });

  user.currentChallenge = options.challenge;
  res.json(options);
});

// === 4️⃣ /login-verify ===
app.post('/login-verify', async (req, res) => {
  const { username, ...body } = req.body;
  console.log("🔐 /login-verify for:", username);

  const user = getUser(username);
  if (!user) return res.status(404).send("User not found");

  const credential = user.credentials.find(c => c.id.toString('base64url') === body.id);

  if (!credential) return res.status(404).send("Credential not found");

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: credential.id,
        credentialPublicKey: credential.publicKey,
        counter: credential.counter,
      },
    });

    const { verified, authenticationInfo } = verification;

    if (verified) {
      credential.counter = authenticationInfo.newCounter ?? credential.counter;
    }

    res.send(verified ? "✅ Access granted via Passkey" : "❌ Invalid credentials");
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(400).send("Login error: " + err.message);
  }
});

// === 🚀 Start Server ===
app.listen(PORT, () => console.log(`🧠 Auth server running on http://localhost:${PORT}`));
