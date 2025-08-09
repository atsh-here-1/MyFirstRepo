document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('register-form');

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const dob = document.getElementById('dob').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const response = await fetch(`${window.config.backendUrl}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, dob, email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      alert('Account created successfully! Now, let\'s register a passkey.');
      await registerPasskey(email);
      window.location.href = 'index.html';
    } else {
      alert(`Registration failed: ${data.error}`);
    }
  });
});
