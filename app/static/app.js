document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const toSignupBtn = document.getElementById('to-signup');
    const toLoginBtn = document.getElementById('to-login');

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    // Password fields and toggles
    const loginPasswordInput = document.getElementById('login-password');
    const toggleLoginPassword = document.getElementById('toggle-login-password');
    
    const signupPasswordInput = document.getElementById('signup-password');
    const signupConfirmPasswordInput = document.getElementById('signup-confirm-password');
    const toggleSignupPassword = document.getElementById('toggle-signup-password');
    const toggleSignupConfirmPassword = document.getElementById('toggle-signup-confirm-password');

    // Registration validation elements
    const passwordStrengthBar = document.getElementById('password-strength-bar');
    const passwordStrengthText = document.getElementById('password-strength-text');
    const passwordMatchText = document.getElementById('password-match-text');

    // Quotes element
    const quotes = [
        { text: "Teaching is the one profession that creates all other professions.", author: "Unknown" },
        { text: "Technology is just a tool. In terms of getting the kids working together, the teacher is the most important.", author: "Bill Gates" },
        { text: "The influence of a good teacher can never be erased.", author: "Unknown" },
        { text: "Education is not the filling of a pail, but the lighting of a fire.", author: "W.B. Yeats" },
        { text: "Better than a thousand days of diligent study is one day with a great teacher.", author: "Japanese Proverb" }
    ];
    const quoteTextElem = document.getElementById('quote-text');
    const quoteAuthorElem = document.getElementById('quote-author');
    let currentQuoteIndex = 0;

    // Toast element for global alerts
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // --- State Toggles (Login vs Signup) ---
    function switchView(showSignup) {
        if (showSignup) {
            loginView.classList.add('hidden');
            signupView.classList.remove('hidden');
            signupView.classList.add('fade-in-slide');
            // Reset signup form
            signupForm.reset();
            resetValidationStyles();
        } else {
            signupView.classList.add('hidden');
            loginView.classList.remove('hidden');
            loginView.classList.add('fade-in-slide');
            // Reset login form
            loginForm.reset();
            clearFormErrors(loginForm);
        }
    }

    toSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(true);
    });

    toLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(false);
    });

    // --- Password Visibility Toggles ---
    function setupPasswordToggle(input, toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = input.getAttribute('type') === 'password';
            input.setAttribute('type', isPassword ? 'text' : 'password');
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                if (isPassword) {
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
        });
    }

    setupPasswordToggle(loginPasswordInput, toggleLoginPassword);
    setupPasswordToggle(signupPasswordInput, toggleSignupPassword);
    setupPasswordToggle(signupConfirmPasswordInput, toggleSignupConfirmPassword);

    // --- Quotes Rotation System ---
    function rotateQuote() {
        if (!quoteTextElem || !quoteAuthorElem) return;
        
        // Add fade out
        quoteTextElem.parentElement.classList.add('opacity-0');
        
        setTimeout(() => {
            currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
            quoteTextElem.textContent = `"${quotes[currentQuoteIndex].text}"`;
            quoteAuthorElem.textContent = `— ${quotes[currentQuoteIndex].author}`;
            
            // Fade in
            quoteTextElem.parentElement.classList.remove('opacity-0');
        }, 500);
    }
    // Rotate every 8 seconds
    setInterval(rotateQuote, 8000);

    // --- Client-Side Real-Time Validation ---

    // Password Strength Meter
    signupPasswordInput.addEventListener('input', () => {
        const password = signupPasswordInput.value;
        const result = checkPasswordStrength(password);
        
        // Update visual meter
        passwordStrengthBar.className = 'h-1.5 rounded-full transition-all duration-300 ';
        if (password.length === 0) {
            passwordStrengthBar.style.width = '0%';
            passwordStrengthText.textContent = '';
        } else {
            passwordStrengthBar.style.width = `${result.percentage}%`;
            passwordStrengthBar.classList.add(result.colorClass);
            passwordStrengthText.textContent = `Strength: ${result.label}`;
            passwordStrengthText.className = `text-xs mt-1 font-medium ${result.textClass}`;
        }

        // Validate confirm match if it already has text
        if (signupConfirmPasswordInput.value.length > 0) {
            validatePasswordMatch();
        }
    });

    // Password Match Validation
    signupConfirmPasswordInput.addEventListener('input', validatePasswordMatch);

    function checkPasswordStrength(password) {
        let score = 0;
        if (password.length >= 8) score += 1;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
        if (/\d/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;

        if (password.length < 6) {
            return { percentage: 25, label: 'Too Short', colorClass: 'bg-rose-500', textClass: 'text-rose-500' };
        }

        switch (score) {
            case 0:
            case 1:
                return { percentage: 25, label: 'Weak', colorClass: 'bg-rose-500', textClass: 'text-rose-500' };
            case 2:
                return { percentage: 50, label: 'Fair', colorClass: 'bg-amber-500', textClass: 'text-amber-500' };
            case 3:
                return { percentage: 75, label: 'Good', colorClass: 'bg-emerald-500', textClass: 'text-emerald-500' };
            case 4:
            default:
                return { percentage: 100, label: 'Strong', colorClass: 'bg-teal-500', textClass: 'text-teal-600' };
        }
    }

    function validatePasswordMatch() {
        const password = signupPasswordInput.value;
        const confirmPassword = signupConfirmPasswordInput.value;

        if (confirmPassword.length === 0) {
            passwordMatchText.textContent = '';
            signupConfirmPasswordInput.classList.remove('border-rose-500', 'border-teal-500');
            return false;
        }

        if (password === confirmPassword) {
            passwordMatchText.textContent = 'Passwords match';
            passwordMatchText.className = 'text-xs mt-1 text-teal-600 font-medium';
            signupConfirmPasswordInput.classList.remove('border-rose-500');
            signupConfirmPasswordInput.classList.add('border-teal-500');
            return true;
        } else {
            passwordMatchText.textContent = 'Passwords do not match';
            passwordMatchText.className = 'text-xs mt-1 text-rose-500 font-medium';
            signupConfirmPasswordInput.classList.remove('border-teal-500');
            signupConfirmPasswordInput.classList.add('border-rose-500');
            return false;
        }
    }

    function resetValidationStyles() {
        passwordStrengthBar.style.width = '0%';
        passwordStrengthText.textContent = '';
        passwordMatchText.textContent = '';
        signupConfirmPasswordInput.classList.remove('border-rose-500', 'border-teal-500');
        clearFormErrors(signupForm);
    }

    // --- Inline Error Management ---
    function setFieldError(inputElement, errorMessage) {
        const parent = inputElement.closest('.form-group') || inputElement.parentElement;
        let errorContainer = parent.querySelector('.error-msg');
        
        inputElement.classList.add('border-rose-500', 'focus:ring-rose-500', 'focus:border-rose-500');
        inputElement.classList.remove('border-slate-300', 'focus:ring-teal-500', 'focus:border-teal-500');
        
        if (!errorContainer) {
            errorContainer = document.createElement('p');
            errorContainer.className = 'error-msg text-xs text-rose-500 mt-1 font-medium';
            parent.appendChild(errorContainer);
        }
        errorContainer.textContent = errorMessage;
        inputElement.setAttribute('aria-invalid', 'true');
    }

    function clearFieldError(inputElement) {
        const parent = inputElement.closest('.form-group') || inputElement.parentElement;
        const errorContainer = parent.querySelector('.error-msg');
        
        inputElement.classList.remove('border-rose-500', 'focus:ring-rose-500', 'focus:border-rose-500');
        inputElement.classList.add('border-slate-300');
        
        if (errorContainer) {
            errorContainer.remove();
        }
        inputElement.removeAttribute('aria-invalid');
    }

    function clearFormErrors(form) {
        const inputs = form.querySelectorAll('input');
        inputs.forEach(clearFieldError);
        const globalErr = form.querySelector('.global-error');
        if (globalErr) {
            globalErr.classList.add('hidden');
        }
    }

    // Input event listeners to clear error on typing
    const allInputs = document.querySelectorAll('input');
    allInputs.forEach(input => {
        input.addEventListener('input', () => {
            clearFieldError(input);
            const globalErr = input.closest('form').querySelector('.global-error');
            if (globalErr) {
                globalErr.classList.add('hidden');
            }
        });
    });

    // --- Toast Alerts ---
    function showToast(message, type = 'success') {
        if (!toast) return;
        toastMessage.textContent = message;
        
        // Set styling based on type
        toast.className = 'fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl transition-all duration-500 transform translate-y-0 opacity-100 flex items-center gap-3 ';
        if (type === 'success') {
            toast.classList.add('bg-teal-50', 'text-teal-800', 'border', 'border-teal-200');
            toast.querySelector('.toast-icon').innerHTML = '<i class="fas fa-check-circle text-teal-500 text-lg"></i>';
        } else {
            toast.classList.add('bg-rose-50', 'text-rose-800', 'border', 'border-rose-200');
            toast.querySelector('.toast-icon').innerHTML = '<i class="fas fa-exclamation-circle text-rose-500 text-lg"></i>';
        }
        
        toast.classList.remove('pointer-events-none', 'opacity-0', '-translate-y-4');

        setTimeout(() => {
            toast.classList.add('opacity-0', '-translate-y-4', 'pointer-events-none');
        }, 4000);
    }

    // --- Form Submissions ---

    // Login Form Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormErrors(loginForm);

        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const rememberMeInput = document.getElementById('remember-me');

        let isValid = true;
        
        // Basic Client Checks
        if (!emailInput.value.trim()) {
            setFieldError(emailInput, 'Email address is required');
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
            setFieldError(emailInput, 'Please enter a valid email address');
            isValid = false;
        }

        if (!passwordInput.value) {
            setFieldError(passwordInput, 'Password is required');
            isValid = false;
        }

        if (!isValid) return;

        // Set Loading state
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Logging in...';

        // Prepare URL encoded parameters (FastAPI OAuth2PasswordRequestForm expects form-urlencoded)
        const params = new URLSearchParams();
        params.append('username', emailInput.value.trim());
        params.append('password', passwordInput.value);

        try {
            const response = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.access_token);
                if (rememberMeInput.checked) {
                    localStorage.setItem('remembered_email', emailInput.value.trim());
                } else {
                    localStorage.removeItem('remembered_email');
                }
                
                showToast('Welcome back! Login successful.', 'success');
                
                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            } else {
                const errData = await response.json();
                const detail = errData.detail || 'Invalid email or password';
                
                // Show global login error
                const globalErr = loginForm.querySelector('.global-error');
                globalErr.textContent = detail;
                globalErr.classList.remove('hidden');
                
                showToast(detail, 'error');
            }
        } catch (error) {
            console.error('API Error:', error);
            // Handle offline fallback
            handleOfflineDemo(submitBtn, originalText, 'login', {
                email: emailInput.value.trim(),
                password: passwordInput.value,
                remember: rememberMeInput.checked
            });
        } finally {
            if (!submitBtn.classList.contains('demo-active')) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    });

    // Registration Form Submit
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormErrors(signupForm);

        const fullNameInput = document.getElementById('signup-fullname');
        const emailInput = document.getElementById('signup-email');
        const contactInput = document.getElementById('signup-contact');
        const staffIdInput = document.getElementById('signup-staffid');
        const passwordInput = document.getElementById('signup-password');
        const confirmPasswordInput = document.getElementById('signup-confirm-password');
        const termsInput = document.getElementById('signup-terms');

        let isValid = true;

        // Name Check
        if (!fullNameInput.value.trim()) {
            setFieldError(fullNameInput, 'Full name is required');
            isValid = false;
        }

        // Email Check
        if (!emailInput.value.trim()) {
            setFieldError(emailInput, 'School email address is required');
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
            setFieldError(emailInput, 'Please enter a valid school email address');
            isValid = false;
        }

        // Contact Check
        if (contactInput.value.trim() && !/^\+?[0-9\s\-]{7,15}$/.test(contactInput.value.trim())) {
            setFieldError(contactInput, 'Please enter a valid contact number');
            isValid = false;
        }

        // Staff ID check (optional, but if provided should be alphanumeric/sensible)
        if (staffIdInput.value.trim() && !/^[A-Za-z0-9\-]{3,20}$/.test(staffIdInput.value.trim())) {
            setFieldError(staffIdInput, 'Please enter a valid alphanumeric Staff ID');
            isValid = false;
        }

        // Password Strength Check
        if (!passwordInput.value) {
            setFieldError(passwordInput, 'Password is required');
            isValid = false;
        } else if (passwordInput.value.length < 8) {
            setFieldError(passwordInput, 'Password must be at least 8 characters long');
            isValid = false;
        } else if (passwordInput.value.length > 72) {
            setFieldError(passwordInput, 'Password must not exceed 72 characters');
            isValid = false;
        }

        // Confirm Password Match
        if (!validatePasswordMatch()) {
            isValid = false;
        }

        // Terms check
        if (!termsInput.checked) {
            // Find parent form group for checkbox
            const parent = termsInput.closest('.form-group') || termsInput.parentElement.parentElement;
            let errorContainer = parent.querySelector('.error-msg');
            if (!errorContainer) {
                errorContainer = document.createElement('p');
                errorContainer.className = 'error-msg text-xs text-rose-500 mt-1 font-medium';
                parent.appendChild(errorContainer);
            }
            errorContainer.textContent = 'You must agree to the Terms of Service';
            isValid = false;
        }

        if (!isValid) return;

        // Set Loading state
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Registering...';

        // Prepare JSON body for API endpoint (/api/v1/auth/register)
        const payload = {
            email: emailInput.value.trim(),
            password: passwordInput.value,
            full_name: fullNameInput.value.trim(),
            role: "TEACHER", // Custom role defaulted for registrations
            employee_id: staffIdInput.value.trim() || null
        };

        try {
            const response = await fetch('/api/v1/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                
                // Store additional teacher fields in LocalStorage as simulated profile data
                if (contactInput.value.trim()) {
                    localStorage.setItem(`profile_contact_${data.id}`, contactInput.value.trim());
                }
                if (staffIdInput.value.trim()) {
                    localStorage.setItem(`profile_staffid_${data.id}`, staffIdInput.value.trim());
                }

                showToast('Registration successful! Redirecting to login.', 'success');
                
                // Auto transition to login and fill email
                setTimeout(() => {
                    switchView(false);
                    document.getElementById('login-email').value = payload.email;
                    document.getElementById('login-password').focus();
                }, 1500);
            } else {
                const errData = await response.json();
                const detail = errData.detail || 'Registration failed. The email may already be in use.';
                
                // Check if detail represents email conflict
                if (detail.toLowerCase().includes('email')) {
                    setFieldError(emailInput, detail);
                } else {
                    const globalErr = signupForm.querySelector('.global-error');
                    globalErr.textContent = detail;
                    globalErr.classList.remove('hidden');
                }
                showToast(detail, 'error');
            }
        } catch (error) {
            console.error('API Error:', error);
            // Handle offline fallback
            handleOfflineDemo(submitBtn, originalText, 'signup', {
                email: emailInput.value.trim(),
                fullName: fullNameInput.value.trim(),
                contact: contactInput.value.trim(),
                staffId: staffIdInput.value.trim(),
                password: passwordInput.value
            });
        } finally {
            if (!submitBtn.classList.contains('demo-active')) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    });

    // --- Offline Demo / Simulation Handler ---
    function handleOfflineDemo(submitBtn, originalText, type, formData) {
        console.warn('Backend server is offline. Running in Demo Simulation Mode.');
        
        // Show simulated message to user
        showToast('Running in local Demo Mode (Backend server offline).', 'success');

        submitBtn.classList.add('demo-active');
        submitBtn.innerHTML = '<i class="fas fa-check mr-2"></i> Demo Successful!';
        
        setTimeout(() => {
            submitBtn.classList.remove('demo-active');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;

            if (type === 'login') {
                localStorage.setItem('token', 'simulated-jwt-token-for-' + formData.email);
                showToast('Welcome back! Login successful (Demo).', 'success');
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            } else if (type === 'signup') {
                alert(`[DEMO SUCCESSFUL]\nRegistered new Teacher profile locally:\nName: ${formData.fullName}\nEmail: ${formData.email}\nContact: ${formData.contact || 'N/A'}\nStaff ID: ${formData.staffId || 'N/A'}\n\nTransitioning to Login view...`);
                switchView(false);
                document.getElementById('login-email').value = formData.email;
                document.getElementById('login-password').focus();
            }
        }, 1200);
    }

    // --- Auto-fill remembered email ---
    const rememberedEmail = localStorage.getItem('remembered_email');
    if (rememberedEmail) {
        const emailInput = document.getElementById('login-email');
        if (emailInput) {
            emailInput.value = rememberedEmail;
            const remCheckbox = document.getElementById('remember-me');
            if (remCheckbox) remCheckbox.checked = true;
        }
    }

    // --- Forgot Password handler ---
    const forgotPasswordLink = document.getElementById('forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('login-email');
            const email = emailInput.value.trim();
            if (email) {
                alert(`Password reset instructions have been simulated. In a production system, a reset link would be dispatched to:\n${email}`);
            } else {
                const promptEmail = prompt('Please enter your school email address to receive password reset instructions:');
                if (promptEmail) {
                    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(promptEmail.trim())) {
                        alert(`Password reset instructions simulated. Directing reset mail to:\n${promptEmail.trim()}`);
                    } else {
                        alert('Invalid email address format.');
                    }
                }
            }
        });
    }
});
