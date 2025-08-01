import express from 'express';
import cors from 'cors';
import session from 'express-session';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';

const app = express();
const PORT = process.env.PORT || 10000;
const RP_NAME = 'Atsh Cyberpunk Terminal';
const RP_ID = 'passkey-backend-6w35.onrender.com';
const ORIGIN = 'https://atsh.tech';

// In-memory user store
const users = new Map();

// Middleware
app.use(cors({
  origin: ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(session({
  secret: 'supersecret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 3600000 }
}));

function getUser(username) {
  if (!users.has(username)) {
    users.set(username, {
      id: `user-${Date.now()}`,
      username,
      authenticators: []
    });
    console.log(`🆕 New user created: ${username}`);
  }
  return users.get(username);
}

// Registration challenge
app.post('/register-challenge', (req, res) => {
  const { username } = req.body;
  const user = getUser(username);
  const userID = isoUint8Array.fromUTF8String(user.id);

  const options = generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID,
    userName: username,
    attestationType: 'none',
    authenticatorSelection: {
      userVerification: 'preferred',
      residentKey: 'required'
    },
    excludeCredentials: user.authenticators.map(a => ({
      id: a.credentialID,
      type: 'public-key'
    }))
  });

  req.session.challenge = options.challenge;
  console.log('📩 register_challenge:', options.challenge);
  res.json(options);
});

// Registration verification
app.post('/register-verify', async (req, res) => {
  const { username, ...response } = req.body;
  const user = getUser(username);

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: req.session.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID
    });

    const { verified, registrationInfo } = verification;
    if (verified && registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = registrationInfo;
      user.authenticators.push({ credentialID, credentialPublicKey, counter });
      console.log('✅ Passkey registered for:', username);
    }

    res.json({ verified });
  } catch (err) {
    console.error('Registration failed:', err);
    res.status(400).send('Registration error');
  }
});

// Login challenge
app.post('/login-challenge', (req, res) => {
  const { username } = req.body;
  const user = getUser(username);

  if (!user.authenticators.length) {
    return res.status(404).send('No registered passkeys');
  }

  const options = generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    allowCredentials: user.authenticators.map(a => ({
      id: a.credentialID,
      type: 'public-key'
    }))
  });

  req.session.challenge = options.challenge;
  console.log('📩 login_challenge:', options.challenge);
  res.json(options);
});

// Login verification
app.post('/login-verify', async (req, res) => {
  const { username, ...response } = req.body;
  const user = getUser(username);
  const cred = user.authenticators.find(a => a.credentialID.toString('base64url') === response.id);

  if (!cred) return res.status(404).send('Unknown credential');

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: req.session.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: cred.credentialID,
        credentialPublicKey: cred.credentialPublicKey,
        counter: cred.counter
      }
    });

    if (verification.verified) {
      cred.counter = verification.authenticationInfo.newCounter;
      console.log('✅ Login success for:', username);
    }

    res.json({ verified: verification.verified });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(400).send('Login error');
  }
});

app.listen(PORT, () => console.log(`🚀 Auth server listening on port ${PORT}`));
