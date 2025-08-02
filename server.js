import express from 'express';
import session from 'express-session';
import cors from 'cors';
import base64url from 'base64url';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';

const app = express();
const port = process.env.PORT || 3000;

// For demo: in-memory "DB"
const users = [];

// CORS: Allow GitHub Pages frontend to access
const FRONTEND_ORIGIN = 'https://atsh-here.github.io'; // Replace with your actual GitHub Pages origin
const RP_ID = 'myfirstrepo-ga0q.onrender.com'; // Replace with your Render backend domain (without https)
const ORIGIN = `https://${FRONTEND_ORIGIN.replace('https://', '')}`;

// Middleware
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: 'supersecret-key',
  saveUninitialized: true,
  resave: false,
  cookie: {
    secure: true, // Required on HTTPS
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 1000 * 60 * 30, // 30 mins
  }
}));

// ----------- ROUTES -------------

// 🧾 Register username/password
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) {
    return res.status(409).send('User already exists');
  }
  const user = {
    id: `user-${Date.now()}`,
    username,
    password,
    authenticators: []
  };
  users.push(user);
  res.send('User registered successfully');
});

// 🔐 Passkey Registration Challenge
app.post('/register-challenge', async (req, res) => {
  const { username } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send('User not found');

  const options = await generateRegistrationOptions({
    rpName: 'WebAuthn Demo',
    rpID: RP_ID,
    userID: user.id,
    userName: user.username,
    attestationType: 'none',
    excludeCredentials: user.authenticators.map(a => ({
      id: base64url.toBuffer(a.credentialID),
      type: 'public-key'
    })),
    authenticatorSelection: {
      userVerification: 'preferred',
      residentKey: 'required',
    }
  });

  req.session.challenge = options.challenge;
  res.json(options);
});

// ✅ Passkey Registration Verify
app.post('/register-verify', async (req, res) => {
  const { username, response } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send('User not found');

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: req.session.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (err) {
    console.error(err);
    return res.status(400).send('Registration verification failed');
  }

  const { verified, registrationInfo } = verification;

  if (verified) {
    const { credentialID, credentialPublicKey, counter } = registrationInfo;
    const newAuth = {
      credentialID: base64url.encode(credentialID),
      credentialPublicKey: base64url.encode(credentialPublicKey),
      counter
    };
    user.authenticators.push(newAuth);
    res.send('Passkey registered successfully');
  } else {
    res.status(400).send('Registration not verified');
  }
});

// 🧪 Passkey Login Challenge
app.post('/login-challenge', async (req, res) => {
  const { username } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || user.authenticators.length === 0) {
    return res.status(404).send('User or passkey not found');
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: user.authenticators.map(a => ({
      id: base64url.toBuffer(a.credentialID),
      type: 'public-key',
    })),
    userVerification: 'preferred',
  });

  req.session.challenge = options.challenge;
  res.json(options);
});

// 🔓 Passkey Login Verify
app.post('/login-verify', async (req, res) => {
  const { username, response } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send('User not found');

  const authenticator = user.authenticators.find(
    a => a.credentialID === response.id
  );
  if (!authenticator) return res.status(404).send('Passkey not found');

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: req.session.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: base64url.toBuffer(authenticator.credentialID),
        credentialPublicKey: base64url.toBuffer(authenticator.credentialPublicKey),
        counter: authenticator.counter,
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(400).send('Login verification failed');
  }

  const { verified, authenticationInfo } = verification;

  if (verified) {
    authenticator.counter = authenticationInfo.newCounter;
    req.session.loggedIn = true;
    req.session.username = username;
    res.send('Authentication successful');
  } else {
    res.status(400).send('Authentication failed');
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('✅ Backend is running');
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
