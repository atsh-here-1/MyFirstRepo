import express from 'express';
import session from 'express-session';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { base64url } from 'multiformats/bases/base64';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('./public'));
app.use(express.json());

const users = []; // Array of { id, username, password, authenticators }

app.use(
  session({
    secret: 'supersecret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 }, // 1 hour
  })
);

// 🔐 Simple user registration (email/password)
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) return res.status(400).send('Missing credentials');
  if (users.find(u => u.username === username)) {
    return res.status(409).send('User already exists');
  }

  const user = {
    id: `user-${Date.now()}`,
    username,
    password,
    authenticators: [],
  };

  users.push(user);
  console.log('✅ User registered:', user.username);
  res.send('User registered successfully');
});

// 🛂 Generate WebAuthn registration challenge
app.post('/register-challenge', async (req, res) => {
  const { username } = req.body;
  const user = users.find(u => u.username === username);

  if (!user) return res.status(404).send('User not found');

  const options = await generateRegistrationOptions({
    rpName: 'Atsh Cyberpunk Terminal',
    rpID: 'passkey-backend-6w35.onrender.com',
    userID: user.id,
    userName: user.username,
    attestationType: 'none',
    excludeCredentials: user.authenticators.map(a => ({
      id: base64url.decode(a.credentialID),
      type: 'public-key',
    })),
    authenticatorSelection: {
      userVerification: 'preferred',
      residentKey: 'required',
    },
  });

  req.session.challenge = options.challenge;
  console.log('📩 /register-challenge for:', username);
  console.log('🔐 Challenge:', options.challenge);

  res.json(options);
});

// ✅ Verify WebAuthn registration
app.post('/register-verify', async (req, res) => {
  const { username, ...response } = req.body;
  const user = users.find(u => u.username === username);

  if (!user) return res.status(404).send('User not found');

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: req.session.challenge,
      expectedOrigin: 'https://atsh.tech',
      expectedRPID: 'passkey-backend-6w35.onrender.com',
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = registrationInfo;

      user.authenticators.push({
        credentialID: base64url.encode(credentialID),
        credentialPublicKey: base64url.encode(credentialPublicKey),
        counter,
      });

      console.log('✅ Passkey registered for', username);
      return res.send('Passkey registration successful');
    }

    res.status(400).send('Registration verification failed');
  } catch (error) {
    console.error('❌ Registration verify error:', error);
    res.status(400).send('Registration failed');
  }
});

// 🛂 Generate login challenge
app.post('/login-challenge', async (req, res) => {
  const { username } = req.body;
  const user = users.find(u => u.username === username);

  if (!user || user.authenticators.length === 0) {
    return res.status(404).send('User or passkey not found');
  }

  const options = await generateAuthenticationOptions({
    rpID: 'passkey-backend-6w35.onrender.com',
    userVerification: 'preferred',
    allowCredentials: user.authenticators.map(a => ({
      id: base64url.decode(a.credentialID),
      type: 'public-key',
    })),
  });

  req.session.challenge = options.challenge;
  console.log('📩 /login-challenge for:', username);
  console.log('🔐 Challenge:', options.challenge);

  res.json(options);
});

// ✅ Verify login
app.post('/login-verify', async (req, res) => {
  const { username, ...response } = req.body;
  const user = users.find(u => u.username === username);

  if (!user) return res.status(404).send('User not found');

  const authenticator = user.authenticators.find(
    a => a.credentialID === response.id
  );

  if (!authenticator) {
    return res.status(404).send('Authenticator not found');
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: req.session.challenge,
      expectedOrigin: 'https://atsh.tech',
      expectedRPID: 'passkey-backend-6w35.onrender.com',
      authenticator: {
        credentialID: base64url.decode(authenticator.credentialID),
        credentialPublicKey: base64url.decode(authenticator.credentialPublicKey),
        counter: authenticator.counter,
      },
    });

    const { verified, authenticationInfo } = verification;

    if (verified) {
      authenticator.counter = authenticationInfo.newCounter;
      console.log('✅ Login verified for', username);
      return res.send('Login successful');
    }

    res.status(400).send('Login verification failed');
  } catch (error) {
    console.error('❌ Login verify error:', error);
    res.status(400).send('Login failed');
  }
});

app.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
