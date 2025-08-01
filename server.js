// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const rpName = 'Atsh Cyberpunk Terminal';
const rpID = 'atsh.tech'; // your domain
const origin = 'https://atsh.tech'; // frontend URL

// Dummy DB
const users = new Map(); // username -> { id, credentials }

function getUser(username) {
  if (!users.has(username)) {
    const id = Buffer.from(username).toString('base64url');
    users.set(username, { id, credentials: [] });
  }
  return users.get(username);
}

// 1. Challenge for Passkey Registration
app.post('/register-challenge', (req, res) => {
  const { username } = req.body;
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

// 2. Verify Passkey Registration
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
      user.credentials.push(registrationInfo.credentialPublicKey);
    }

    res.send(verified ? "Registered successfully!" : "Verification failed.");
  } catch (err) {
    console.error(err);
    res.status(400).send("Registration error");
  }
});

// 3. Challenge for Passkey Login
app.post('/login-challenge', (req, res) => {
  const { username } = req.body;
  const user = getUser(username);

  const options = generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
  });

  user.currentChallenge = options.challenge;
  res.json(options);
});

// 4. Verify Passkey Login
app.post('/login-verify', async (req, res) => {
  const { username, ...body } = req.body;
  const user = getUser(username);

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: { credentialPublicKey: user.credentials[0], credentialID: body.id }, // Simplified
    });

    const { verified } = verification;
    res.send(verified ? "Access granted via Passkey" : "Invalid credentials");
  } catch (err) {
    console.error(err);
    res.status(400).send("Login error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Auth server running on ${PORT}`));
