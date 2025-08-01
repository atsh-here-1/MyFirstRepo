// ✅ server.js (Fixed with toBase64URL)
const express = require('express');
const cors = require('cors');
const { 
  generateRegistrationOptions, 
  verifyRegistrationResponse, 
  generateAuthenticationOptions, 
  verifyAuthenticationResponse 
} = require('@simplewebauthn/server');
const { toBase64URL } = require('@simplewebauthn/server/helpers'); // ✅ Correct import

const app = express();
const PORT = process.env.PORT || 3000;

// === ✅ CORS for Netlify frontend ===
app.use(cors({
  origin: 'https://atsh.tech',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false,
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// === Site Info ===
const rpName = 'Atsh Cyberpunk Terminal';
const rpID = 'atsh.tech';
const origin = 'https://atsh.tech';

// === In-memory "DB" ===
const users = new Map(); // username -> { id, credentials, currentChallenge }

function getUser(username) {
  if (!users.has(username)) {
    const id = Buffer.from(username, 'utf8'); // Buffer as required
    users.set(username, { id, credentials: [] });
  }
  return users.get(username);
}

// === 1. /register-challenge ===
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

  // Convert Buffer fields to base64url so frontend understands
  options.challenge = toBase64URL(options.challenge);
  options.user.id = toBase64URL(options.user.id);

  res.json(options);
});

// === 2. /register-verify ===
app.post('/register-verify', async (req, res) => {
  const { username, ...body } = req.body;
  const user = getUser(username);
  console.log("🔐 /register-verify for:", username);
  console.log("📥 Attestation Payload:", body);

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
    console.error("❌ Error verifying registration:", err);
    res.status(400).send("Registration error: " + err.message);
  }
});

// === 3. /login-challenge ===
app.post('/login-challenge', (req, res) => {
  const { username } = req.body;
  const user = getUser(username);
  console.log("📩 /login-challenge from:", username);

  if (!user || !user.credentials.length) return res.status(404).send("No credentials");

  const options = generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: user.credentials.map(c => ({ id: c.id, type: 'public-key' })),
  });

  user.currentChallenge = options.challenge;

  // Convert buffer fields
  options.challenge = toBase64URL(options.challenge);
  options.allowCredentials = options.allowCredentials.map(cred => ({
    ...cred,
    id: toBase64URL(cred.id),
  }));

  res.json(options);
});

// === 4. /login-verify ===
app.post('/login-verify', async (req, res) => {
  const { username, ...body } = req.body;
  const user = getUser(username);
  console.log("🔐 /login-verify for:", username);

  const cred = user.credentials.find(c => toBase64URL(c.id) === body.id);
  if (!cred) return res.status(404).send("Credential not found");

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: cred.id,
        credentialPublicKey: cred.publicKey,
        counter: cred.counter,
      },
    });

    const { verified, authenticationInfo } = verification;
    if (verified) cred.counter = authenticationInfo.newCounter ?? cred.counter;

    res.send(verified ? "✅ Access granted via Passkey" : "❌ Invalid credentials");
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(400).send("Login error: " + err.message);
  }
});

// === Start Server ===
app.listen(PORT, () => console.log(`🧠 Auth server running on http://localhost:${PORT}`));
