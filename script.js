// Create animated particles
        function createParticles() {
            const particlesContainer = document.getElementById('particles');
            const particleCount = 50;
        
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                
                // Random properties
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 20 + 's';
                particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        
                // Initial off-screen position to prevent top-stuck look
                particle.style.transform = 'translateY(100vh)';
        
                // Cyberpunk random colors
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
                button.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-3px) scale(1.02)';
                });
                
                button.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0) scale(1)';
                });
                
                button.addEventListener('click', function(e) {
                    // Create ripple effect
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

        // Form submission handling
        function handleFormSubmission() {
            const form = document.querySelector('.email-form');
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Add loading state
                const submitBtn = this.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
                submitBtn.disabled = true;
                
                // Simulate authentication process
                setTimeout(() => {
                    submitBtn.innerHTML = '<i class="fas fa-check"></i> Access Granted';
                    submitBtn.style.background = 'rgba(0, 255, 0, 0.2)';
                    submitBtn.style.borderColor = '#00ff00';
                    submitBtn.style.boxShadow = '0 0 30px rgba(0, 255, 0, 0.5)';
                    
                    setTimeout(() => {
                        submitBtn.innerHTML = originalText;
                        submitBtn.disabled = false;
                        submitBtn.style.background = '';
                        submitBtn.style.borderColor = '';
                        submitBtn.style.boxShadow = '';
                    }, 2000);
                }, 2000);
            });
        }

        // Initialize everything when DOM is loaded
        document.addEventListener('DOMContentLoaded', function() {
            createParticles();
            addButtonEffects();
            handleFormSubmission();
        });

        // Add keyboard navigation enhancement
        document.addEventListener('keydown', function(e) {
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
