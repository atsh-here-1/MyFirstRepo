const express = require('express');
const cors = require('cors');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
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
  store: new FileStore({
    path: './sessions', // The directory where session files will be stored
    retries: 1, // Number of retries for reading/writing session files
  }),
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
let users = readUsers();

const rpID = process.env.RP_ID;
const port = process.env.PORT || 3000;
const expectedOrigin = process.env.EXPECTED_ORIGIN;

if (!rpID || !expectedOrigin) {
  console.error('FATAL ERROR: RP_ID and EXPECTED_ORIGIN environment variables are not set.');
  console.error('Please set them in your Render dashboard.');
  console.error('RP_ID should be your backend domain (e.g., passkey-backend-6w35.onrender.com)');
  console.error('EXPECTED_ORIGIN should be your frontend URL (e.g., https://atsh.tech)');
  process.exit(1); // Stop the server if config is missing
}

app.post('/register/start', (req, res) => {
  const { email } = req.body;
  console.log(`[REGISTER/START] Received request for email: ${email}`);

  if (!email) {
    console.error('[REGISTER/START] FAIL: Email is missing.');
    return res.status(400).json({ error: 'Email is required' });
  }

  const existingUser = users[email];
  console.log(`[REGISTER/START] Existing user check:`, existingUser ? `Found user with ${existingUser.authenticators.length} authenticators.` : 'No user found.');

  if (existingUser && existingUser.authenticators.length > 0) {
    console.error(`[REGISTER/START] FAIL: User ${email} already exists and has passkeys.`);
    return res.status(400).json({ error: 'User already exists. Please log in.' });
  }

  // HARDCODED FOR DEBUGGING: Using a static but unique ID to isolate the problem.
  const userID = Buffer.from(`static-user-id-${email}`, 'utf8');
  console.log(`[REGISTER/START] DEBUG: Hardcoded userID to: ${userID.toString('utf8')}`);
  // END DEBUGGING

  const excludeCredentials = existingUser ? existingUser.authenticators.map(auth => ({
    id: auth.credentialID,
    type: 'public-key',
    transports: auth.transports,
  })) : [];

  const optionsPayload = {
    rpName: 'Cyberpunk Login',
    rpID,
    userID: userID, // Using the hardcoded userID for the payload
    userName: email, // Still using the real email for userName
    attestationType: 'none',
    excludeCredentials,
  };

  console.log('[REGISTER/START] Generating registration options with payload:', JSON.stringify(optionsPayload, null, 2));

  const options = generateRegistrationOptions(optionsPayload);

  console.log('[REGISTER/START] Generated options from @simplewebauthn/server:', JSON.stringify(options, null, 2));

  req.session.challenge = options.challenge;
  req.session.email = email;

  console.log(`[REGISTER/START] Storing challenge in session: ${options.challenge}`);

  req.session.save((err) => {
    if (err) {
      console.error('[REGISTER/START] SESSION SAVE ERROR:', err);
      return res.status(500).json({ error: 'Failed to save session.' });
    }
    console.log('[REGISTER/START] Session saved successfully. Sending options response.');
    res.json(options);
  });
});

app.post('/register/finish', async (req, res) => {
  const { email, challenge } = req.session;

  if (!email || !challenge) {
    return res.status(400).json({ error: 'Session data missing. Please start registration again.' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID: rpID,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credentialPublicKey, credentialID, counter } = registrationInfo;

      // Find user or create new user
      let user = users[email];
      if (!user) {
        user = {
          id: email,
          username: email,
          authenticators: [],
        };
        users[email] = user;
      }

      const newAuthenticator = {
        credentialID,
        credentialPublicKey,
        counter,
        transports: req.body.response.transports,
      };
      user.authenticators.push(newAuthenticator);
      
      writeUsers(users); // Save the updated user record

      // Clear the challenge from the session
      req.session.challenge = undefined;
      req.session.save(() => {
        res.json({ verified: true });
      });
    } else {
      res.status(400).json({ verified: false, error: 'Verification failed.' });
    }
  } catch (error) {
    console.error('Error during /register/finish:', error);
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
