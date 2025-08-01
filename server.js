import express from 'express';
import session from 'express-session';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoUint8Array, isoBase64URL } from '@simplewebauthn/server/helpers';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('./public'));
app.use(express.json());
app.use(session({
  secret: 'supersecret',
  resave: false,
  saveUninitialized: true,
}));

const users = []; // in-memory

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) {
    return res.status(409).send('User exists');
  }
  const user = { id: `u${Date.now()}`, username, password, authenticators: [] };
  users.push(user);
  console.log('User created:', user.username);
  res.send('User created');
});

app.post('/register-challenge', (req, res) => {
  const { username } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send('No user');

  const options = generateRegistrationOptions({
    rpName: 'Atsh Terminal',
    rpID: 'passkey-backend-6w35.onrender.com',
    userID: isoUint8Array.fromUTF8String(user.id),
    userName: user.username,
    attestationType: 'none',
    excludeCredentials: user.authenticators.map(a => ({
      id: a.credentialID,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
    timeout: 60000,
  });

  req.session.challenge = options.challenge;
  console.log('Registration challenge:', options.challenge);
  res.json(options);
});

app.post('/register-verify', async (req, res) => {
  const { username, ...body } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send('User not found');

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: req.session.challenge,
      expectedOrigin: 'https://atsh.tech',
      expectedRPID: 'passkey-backend-6w35.onrender.com',
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
      user.authenticators.push({
        credentialID: isoBase64URL.fromBuffer(credentialID),
        publicKey: isoBase64URL.fromBuffer(credentialPublicKey),
        counter,
      });
      console.log('Passkey registered for', username);
      res.json({ verified: true });
    } else {
      res.status(400).send('Registration not verified');
    }
  } catch (e) {
    console.error('Register verify error:', e);
    res.status(400).send('Registration error: ' + e.message);
  }
});

app.post('/login-challenge', (req, res) => {
  const { username } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || !user.authenticators.length) {
    return res.status(404).send('No credentials');
  }

  const options = generateAuthenticationOptions({
    rpID: 'passkey-backend-6w35.onrender.com',
    userVerification: 'preferred',
    allowCredentials: user.authenticators.map(a => ({
      id: a.credentialID,
    })),
    timeout: 60000,
  });

  req.session.challenge = options.challenge;
  console.log('Login challenge:', options.challenge);
  res.json(options);
});

app.post('/login-verify', async (req, res) => {
  const { username, ...body } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send('User not found');

  const authenticator = user.authenticators.find(a => a.credentialID === body.id);
  if (!authenticator) return res.status(404).send('Authenticator not found');

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: req.session.challenge,
      expectedOrigin: 'https://atsh.tech',
      expectedRPID: 'passkey-backend-6w35.onrender.com',
      authenticator: {
        credentialID: isoBase64URL.fromBuffer(isoBase64URL.toBytes(authenticator.credentialID)),
        credentialPublicKey: isoBase64URL.fromBuffer(isoBase64URL.toBytes(authenticator.publicKey)),
        counter: authenticator.counter,
      },
    });

    if (verification.verified) {
      authenticator.counter = verification.authenticationInfo.newCounter;
      console.log('Login verified for', username);
      res.json({ verified: true });
    } else {
      res.status(400).send('Not verified');
    }
  } catch (e) {
    console.error('Login verify error:', e);
    res.status(400).send('Login error: ' + e.message);
  }
});

app.listen(PORT, () => console.log('Server running on port', PORT));
