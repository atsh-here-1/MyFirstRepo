import express from 'express';
import session from 'express-session';
import cors from 'cors';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const app = express();
const PORT = process.env.PORT || 10000;

const RP_NAME = 'Atsh Cyberpunk Terminal';
const RP_ID = 'passkey-backend-6w35.onrender.com';
const ORIGIN = 'https://atsh.tech';

// Memory store (replace with DB in production)
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
  secret: 'cyberpunk-super-secret',
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
    console.log(`🆕 Created new user: ${username}`);
  }
  return users.get(username);
}

// === Register ===
app.post('/register-challenge', (req, res) => {
  const { username } = req.body;
  console.log('📩 /register-challenge for:', username);

  if (!username) return res.status(400).send('Missing username');

  const user = getUser(username);

  const options = generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: user.id,
    userName: username,
    attestationType: 'none',
    authenticatorSelection: {
      userVerification: 'preferred',
      residentKey: 'required',
    },
    excludeCredentials: user.authenticators.map(auth => ({
      id: auth.credentialID,
      type: 'public-key',
    })),
  });

  req.session.challenge = options.challenge;
  console.log('✅ Generated challenge:', options.challenge);
  res.json(options);
});

app.post('/register-verify', async (req, res) => {
  const { username, ...response } = req.body;
  const user = getUser(username);
  const expectedChallenge = req.session.challenge;

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = registrationInfo;
      user.authenticators.push({
        credentialID,
        credentialPublicKey,
        counter,
      });
      console.log('✅ Registered credential for user:', username);
    }

    res.json({ verified });
  } catch (err) {
    console.error('❌ Register verify error:', err);
    res.status(400).send('Registration failed');
  }
});

// === Login ===
app.post('/login-challenge', (req, res) => {
  const { username } = req.body;
  const user = getUser(username);

  if (!user || user.authenticators.length === 0) {
    return res.status(404).send('User or credentials not found');
  }

  const options = generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    allowCredentials: user.authenticators.map(auth => ({
      id: auth.credentialID,
      type: 'public-key',
    })),
  });

  req.session.challenge = options.challenge;
  console.log('✅ Login challenge sent for user:', username);
  res.json(options);
});

app.post('/login-verify', async (req, res) => {
  const { username, ...response } = req.body;
  const user = getUser(username);

  const cred = user.authenticators.find(
    auth => auth.credentialID.toString('base64url') === response.id
  );

  if (!cred) {
    console.error('❌ Credential not found for:', response.id);
    return res.status(404).send('Credential not found');
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: req.session.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: cred.credentialID,
        credentialPublicKey: cred.credentialPublicKey,
        counter: cred.counter,
      },
    });

    const { verified, authenticationInfo } = verification;

    if (verified) {
      cred.counter = authenticationInfo.newCounter;
      console.log('✅ Login successful for user:', username);
    }

    res.json({ verified });
  } catch (err) {
    console.error('❌ Login verify error:', err);
    res.status(400).send('Login failed');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
