// ✅ script.js (Frontend for Passkey + UI effects + Firebase auth)

import {
  startRegistration,
  startAuthentication
} from '@simplewebauthn/browser';

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

async function registerPasskey() {
  const username = prompt("👤 Enter a username:");
  if (!username) return;

  try {
    console.log("[Client] 🔍 Fetching challenge...");
    const resp = await fetch(`${BACKEND_URL}/register-challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });

    if (!resp.ok) throw new Error("Failed to get challenge");
    const options = await resp.json();
    console.log("[Client] ✅ Got challenge:", options);

    console.log("[Client] 🧠 Starting browser passkey registration...");
    const attResp = await startRegistration(options);
    console.log("[Client] ✅ Passkey created:", attResp);

    console.log("[Client] 🔐 Sending attestation to server...");
    const verify = await fetch(`${BACKEND_URL}/register-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, ...attResp }),
    });

    const result = await verify.text();
    if (!verify.ok) throw new Error(result);

    alert("✅ Passkey registration success: " + result);
  } catch (err) {
    console.error("[Client] ❌ Passkey registration failed:", err);
    alert("❌ Passkey registration failed:\n" + err.message);
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

document.addEventListener("DOMContentLoaded", () => {
  createParticles();
  addButtonEffects();
  handleAuth();

  const registerBtn = document.getElementById("register-passkey-btn");
  if (registerBtn) registerBtn.addEventListener("click", registerPasskey);
});
