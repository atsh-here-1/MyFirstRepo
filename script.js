// ✨ Particle + UI Effects
function createParticles() {
  const container = document.getElementById("particles");
  const count = 50;
  const colors = ["#00ffff", "#ff00ff", "#ffff00", "#00ff00"];

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 20 + "s";
    p.style.animationDuration = Math.random() * 10 + 10 + "s";
    p.style.transform = "translateY(100vh)";
    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.background = color;
    p.style.boxShadow = `0 0 10px ${color}`;
    container.appendChild(p);
  }
}

function addButtonEffects() {
  const buttons = document.querySelectorAll(".login-btn");

  buttons.forEach(button => {
    button.addEventListener("mouseenter", () => {
      button.style.transform = "translateY(-3px) scale(1.02)";
    });
    button.addEventListener("mouseleave", () => {
      button.style.transform = "translateY(0) scale(1)";
    });
    button.addEventListener("click", e => {
      const ripple = document.createElement("span");
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: radial-gradient(circle, rgba(0, 255, 255, 0.5) 0%, transparent 70%);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
      `;
      button.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });

  const rippleKeyframes = document.createElement("style");
  rippleKeyframes.textContent = `
    @keyframes ripple {
      to { transform: scale(2); opacity: 0; }
    }
  `;
  document.head.appendChild(rippleKeyframes);
}

// ✅ Passkey Registration and Login
async function registerPasskey() {
  const email = document.getElementById('email').value;
  if (!email) {
    alert('Please enter an email to register a passkey.');
    return;
  }

  try {
    // Start registration
    const startRes = await fetch('http://localhost:3000/register/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const options = await startRes.json();
    if (options.error) throw new Error(options.error);

    // Use WebAuthn to create a credential
    const { startRegistration } = SimpleWebAuthnBrowser;
    const attestation = await startRegistration(options);

    // Finish registration
    const finishRes = await fetch('http://localhost:3000/register/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attestation),
    });

    const { verified } = await finishRes.json();
    if (verified) {
      alert('Passkey registered successfully!');
    } else {
      alert('Passkey registration failed.');
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function loginWithPasskey() {
  const email = document.getElementById('email').value;
  if (!email) {
    alert('Please enter your email to log in with a passkey.');
    return;
  }

  try {
    // Start authentication
    const startRes = await fetch('http://localhost:3000/login/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const options = await startRes.json();
    if (options.error) throw new Error(options.error);

    // Use WebAuthn to get an assertion
    const { startAuthentication } = SimpleWebAuthnBrowser;
    const assertion = await startAuthentication(options);

    // Finish authentication
    const finishRes = await fetch('http://localhost:3000/login/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assertion),
    });

    const { verified } = await finishRes.json();
    if (verified) {
      alert('Logged in successfully with passkey!');
    } else {
      alert('Passkey login failed.');
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}


// ✅ Firebase Email & Google Auth
function handleAuth() {
// ...existing code...

  const auth = firebase.auth();
  const form = document.getElementById("login-form");

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const button = form.querySelector("button");

    try {
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
      button.disabled = true;
      await auth.signInWithEmailAndPassword(email, password);
      button.innerHTML = '<i class="fas fa-check"></i> Access Granted';
      button.style.background = 'rgba(0,255,0,0.2)';
      button.style.borderColor = '#00ff00';
    } catch (err) {
      alert("Login failed: " + err.message);
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-sign-in-alt"></i> Access System';
        button.style.background = '';
        button.style.borderColor = '';
      }, 2000);
    }
  });

  const googleBtn = document.getElementById("google-login");
  googleBtn.addEventListener("click", async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
      alert("Google login success!");
    } catch (err) {
      alert("Google login failed: " + err.message);
    }
  });
}

// 🔐 Decode base64url → Uint8Array
function base64urlToBuffer(base64url) {
  const padding = '='.repeat((4 - base64url.length % 4) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

// 🔐 WebAuthn Registration & Login
function handlePasskey() {
  const passkeyBtn = document.querySelector(".passkey");
  const emailInput = document.getElementById("email");
  const backend = "https://passkey-backend-6w35.onrender.com";

  passkeyBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) return alert("Please enter your email first.");

    const isLogin = confirm("Do you want to log in using passkey?\nClick Cancel to register.");

    try {
      if (isLogin) {
        // 🟢 LOGIN FLOW
        const loginOptionsRes = await fetch(`${backend}/login/options`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const options = await loginOptionsRes.json();

        options.challenge = base64urlToBuffer(options.challenge);
        options.allowCredentials = options.allowCredentials.map(cred => ({
          ...cred,
          id: base64urlToBuffer(cred.id),
        }));

        const assertion = await navigator.credentials.get({ publicKey: options });

        const loginRes = await fetch(`${backend}/login/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            authResp: assertion,
          }),
        });

        const result = await loginRes.json();
        if (result.verified) {
          alert("✅ Logged in with Passkey!");
        } else {
          alert("❌ Passkey login failed");
        }
      } else {
        // 🟡 REGISTRATION FLOW
        const regOptionsRes = await fetch(`${backend}/register/options`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const options = await regOptionsRes.json();
        options.challenge = base64urlToBuffer(options.challenge);
        options.user.id = base64urlToBuffer(options.user.id);

        const credential = await navigator.credentials.create({ publicKey: options });

        const regRes = await fetch(`${backend}/register/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            attResp: credential,
          }),
        });

        const result = await regRes.json();
        if (result.verified) {
          alert("🎉 Passkey Registered!");
        } else {
          alert("❌ Passkey registration failed");
        }
      }
    } catch (err) {
      console.error("❌ WebAuthn error (client side):", err);
      alert("Something went wrong with Passkey setup.");
    }
  });
}

// 🚀 Init All
document.addEventListener("DOMContentLoaded", () => {
  createParticles();
  addButtonEffects();
  handleAuth();
  handlePasskey();
});
