// ✅ script.js — Complete and corrected for WebAuthn v11+ API

const { startRegistration, startAuthentication } = SimpleWebAuthnBrowser;
const BACKEND_URL = "https://passkey-backend-6w35.onrender.com";

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
  document.querySelectorAll(".login-btn").forEach(button => {
    button.addEventListener("mouseenter", () =>
      (button.style.transform = "translateY(-3px) scale(1.02)")
    );
    button.addEventListener("mouseleave", () =>
      (button.style.transform = "translateY(0) scale(1)")
    );
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
        background: radial-gradient(circle, rgba(0,255,255,0.5) 0%, transparent 70%);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
      `;
      button.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
  const style = document.createElement("style");
  style.textContent = `@keyframes ripple { to { transform: scale(2); opacity: 0; } }`;
  document.head.appendChild(style);
}

async function registerPasskey() {
  const username = prompt("👤 Enter username:");
  if (!username) return;

  try {
    const resp = await fetch(`${BACKEND_URL}/register-challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const options = await resp.json();
    const attResp = await startRegistration({ optionsJSON: options });

    const verifyResp = await fetch(`${BACKEND_URL}/register-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, ...attResp }),
    });
    if (!verifyResp.ok) throw new Error(await verifyResp.text());

    alert("✅ Passkey registration success!");
  } catch (err) {
    console.error("Registration failed", err);
    alert("❌ Registration error: " + err.message);
  }
}

async function loginWithPasskeyPrompt() {
  const username = prompt("👤 Enter username to login:");
  if (!username) return;

  try {
    const resp = await fetch(`${BACKEND_URL}/login-challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const options = await resp.json();

    const authResp = await startAuthentication({ optionsJSON: options });

    const verifyResp = await fetch(`${BACKEND_URL}/login-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, ...authResp }),
    });
    if (!verifyResp.ok) throw new Error(await verifyResp.text());

    alert("✅ Passkey login success!");
  } catch (err) {
    console.error("Login failed", err);
    alert("❌ Login error: " + err.message);
  }
}

function handleAuth() {
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
      alert("❌ Login failed: " + err.message);
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-sign-in-alt"></i> Access System';
        button.style.background = '';
        button.style.borderColor = '';
      }, 2000);
    }
  });

  document.getElementById("google-login").addEventListener("click", async () => {
    try {
      await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
      alert("✅ Google login success!");
    } catch (err) {
      alert("❌ Google login failed: " + err.message);
    }
  });
}

window.registerPasskey = registerPasskey;
window.loginWithPasskeyPrompt = loginWithPasskeyPrompt;

document.addEventListener("DOMContentLoaded", () => {
  createParticles();
  addButtonEffects();
  handleAuth();
});
