// Firebase Auth setup
const auth = firebase.auth();

// Create animated particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        particle.style.transform = 'translateY(100vh)';

        const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff00'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.background = color;
        particle.style.boxShadow = `0 0 10px ${color}`;

        particlesContainer.appendChild(particle);
    }
}

// Enhanced button interactions
function addButtonEffects() {
    const buttons = document.querySelectorAll('.login-btn');

    buttons.forEach(button => {
        button.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-3px) scale(1.02)';
        });

        button.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0) scale(1)';
        });

        button.addEventListener('click', function (e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
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

            this.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}

// Add ripple animation
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(2);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Handle Email/Password Login
function handleFormSubmission() {
    const form = document.querySelector('.email-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const email = emailInput.value;
        const password = passwordInput.value;

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
        submitBtn.disabled = true;

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                submitBtn.innerHTML = '<i class="fas fa-check"></i> Access Granted';
                submitBtn.style.background = 'rgba(0, 255, 0, 0.2)';
                submitBtn.style.borderColor = '#00ff00';
                submitBtn.style.boxShadow = '0 0 30px rgba(0, 255, 0, 0.5)';

                setTimeout(() => {
                    alert('✅ Welcome ' + userCredential.user.email);
                    window.location.href = "/dashboard.html"; // or your desired page
                }, 1500);
            })
            .catch((error) => {
                alert("❌ " + error.message);
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            });
    });
}

// Google Sign-In
function handleGoogleLogin() {
    const googleBtn = document.getElementById('google-login');

    googleBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();

        auth.signInWithPopup(provider)
            .then((result) => {
                alert("✅ Logged in as " + result.user.displayName);
                window.location.href = "/dashboard.html"; // or redirect
            })
            .catch((error) => {
                alert("❌ " + error.message);
            });
    });
}

// Enter key navigation
function addKeyboardNav() {
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && document.activeElement.classList.contains('form-input')) {
            const inputs = Array.from(document.querySelectorAll('.form-input'));
            const currentIndex = inputs.indexOf(document.activeElement);

            if (currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
            } else {
                document.querySelector('button[type="submit"]').click();
            }
        }
    });
}

// Initialize all
document.addEventListener('DOMContentLoaded', function () {
    createParticles();
    addButtonEffects();
    handleFormSubmission();
    handleGoogleLogin();
    addKeyboardNav();
});
