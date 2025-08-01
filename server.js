const express = require('express');
const cors = require('cors');
const session = require('express-session');
const fs = require('fs');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'https://atsh.tech', // Your Netlify frontend URL
  credentials: true,
}));
app.use(session({
  secret: 'a-secure-secret-key', // Please change this to a strong, random secret
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: true, // Required for HTTPS
    httpOnly: true,
    sameSite: 'none' // 'none' because frontend and backend are on different domains
  }
}));

const DATA_FILE = './users.json';

// Helper functions to read and write from the JSON file
const readUsers = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading users file:', error);
  }
  return {};
};

const writeUsers = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing users file:', error);
  }
};

// Load users from the file
const users = readUsers();

const rpID = process.env.RP_ID || 'localhost'; // Your domain
const port = process.env.PORT || 3000;
const expectedOrigin = process.env.EXPECTED_ORIGIN || `http://${rpID}:${port}`;

app.post('/register/start', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (users[email]) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const user = {
    id: email,
    username: email,
    authenticators: [],
  };
  users[email] = user;
  writeUsers(users); // Save users to file

  const options = generateRegistrationOptions({
    rpName: 'Cyberpunk Login',
    rpID,
    userID: Buffer.from(user.id, 'utf8'),
    userName: user.username,
    attestationType: 'none',
    excludeCredentials: user.authenticators.map(auth => ({
      id: auth.credentialID,
      type: 'public-key',
      transports: auth.transports,
    })),
  });

  req.session.challenge = options.challenge;
  req.session.email = email;

  req.session.save(() => {
    res.json(options);
  });
});

app.post('/register/finish', async (req, res) => {
  const { email } = req.session;
  const user = users[email];

  // Check if session and challenge exist
  if (!req.session || !req.session.challenge) {
    return res.status(400).json({ error: 'Session challenge not found. Please start registration again.' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: req.session.challenge,
      expectedOrigin,
      expectedRPID: rpID,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credentialPublicKey, credentialID, counter } = registrationInfo;

      const newAuthenticator = {
        credentialID,
        credentialPublicKey,
        counter,
        transports: req.body.response.transports,
      };
      user.authenticators.push(newAuthenticator);
      writeUsers(users); // Save users to file
    }

    res.json({ verified });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/login/start', (req, res) => {
  const { email } = req.body;
  const user = users[email];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const options = generateAuthenticationOptions({
    allowCredentials: user.authenticators.map(auth => ({
      id: auth.credentialID,
      type: 'public-key',
      transports: auth.transports,
    })),
    userVerification: 'preferred',
  });

  req.session.challenge = options.challenge;
  req.session.email = email;

  req.session.save(() => {
    res.json(options);
  });
});

app.post('/login/finish', async (req, res) => {
    const { email } = req.session;
    const user = users[email];
    const authenticator = user.authenticators.find(
        auth => auth.credentialID === req.body.id
    );

    // Check if session and challenge exist
    if (!req.session || !req.session.challenge) {
      return res.status(400).json({ error: 'Session challenge not found. Please start login again.' });
    }

    if (!authenticator) {
        return res.status(400).json({ error: 'Authenticator not found' });
    }

    try {
        const verification = await verifyAuthenticationResponse({
            response: req.body,
            expectedChallenge: req.session.challenge,
            expectedOrigin,
            expectedRPID: rpID,
            authenticator,
        });

        const { verified, authenticationInfo } = verification;

        if (verified) {
            authenticator.counter = authenticationInfo.newCounter;
            writeUsers(users); // Save users to file
        }

        res.json({ verified });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});


// A simple endpoint to handle email/password registration
app.post('/register/email', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    if (users[email]) {
        return res.status(400).json({ error: 'User already exists' });
    }

    users[email] = {
        id: email,
        username: email,
        password, // In a real app, hash and salt the password
        authenticators: [],
    };

    writeUsers(users); // Save users to file
    console.log('User registered:', users[email]);
    res.json({ success: true, message: 'User registered successfully' });
});


app.listen(port, () => {
  console.log(`Server listening on port ${port}. RP_ID: ${rpID}, Origin: ${expectedOrigin}`);
});
