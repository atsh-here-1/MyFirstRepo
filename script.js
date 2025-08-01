// ✅ script.js — Fully working with WebAuthn + Firebase + UI

const { startRegistration, startAuthentication } = SimpleWebAuthnBrowser;
const BACKEND_URL = "https://passkey-backend-6w35.onrender.com";

// 🟡 Particle Background
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

// 🟢 Ripple & Hover Effect
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

// 🔐 Register Passkey
async function registerPasskey() {
  const username = prompt("👤 Enter username:");
  if (!username) return;

  try {
    console.log("[Client] Requesting challenge...");
    const resp = await fetch(`${BACKEND_URL}/register-challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username }),
    });

    const options = await resp.json();
    console.log("[Client] Challenge received:", options);

    const attResp = await startRegistration({ optionsJSON: options });
    console.log("[Client] Registration response:", attResp);

    const verifyResp = await fetch(`${BACKEND_URL}/register-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, ...attResp }),
    });

    const verifyText = await verifyResp.text();
    if (!verifyResp.ok) throw new Error(verifyText);

    alert("✅ Passkey registration successful!");
  } catch (err) {
    console.error("[Client] ❌ Registration failed:", err);
    alert("❌ Registration error: " + err.message);
  }
}

// 🔑 Login with Passkey
async function loginWithPasskeyPrompt() {
  const username = prompt("👤 Enter username:");
  if (!username) return;

  try {
    const resp = await fetch(`${BACKEND_URL}/login-challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username }),
    });

    const options = await resp.json();
    console.log("[Client] Login challenge received:", options);

    const authResp = await startAuthentication({ optionsJSON: options });
    console.log("[Client] Authentication response:", authResp);

    const verifyResp = await fetch(`${BACKEND_URL}/login-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, ...authResp }),
    });

    const verifyText = await verifyResp.text();
    if (!verifyResp.ok) throw new Error(verifyText);

    alert("✅ Logged in with passkey!");
  } catch (err) {
    console.error("[Client] ❌ Login failed:", err);
    alert("❌ Login error: " + err.message);
  }
}

// 🔑 Firebase + Google Auth
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
      alert("✅ Google login success!");
    } catch (err) {
      alert("❌ Google login failed: " + err.message);
    }
  });
}

// 🔁 Init
document.addEventListener("DOMContentLoaded", () => {
  createParticles();
  addButtonEffects();
  handleAuth();
});

// 🌐 Make accessible to HTML onclick
window.registerPasskey = registerPasskey;
window.loginWithPasskeyPrompt = loginWithPasskeyPrompt;
