// DOM Elements
const form = document.getElementById('registrationForm');
const preview = document.getElementById('preview');
const profilePicInput = document.getElementById('profilePic');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const submitBtn = document.getElementById('submitBtn');
const emailInput = document.getElementById('email');
const otpInput = document.getElementById('otp');
let otpVerified = false;

// Profile Picture Preview
profilePicInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // Validate file type and size
        const validTypes = ['image/jpeg', 'image/png'];
        const maxSize = 2 * 1024 * 1024; // 2MB
        
        if (!validTypes.includes(file.type)) {
            showError('profilePicError', 'Only JPEG/PNG files allowed');
            return;
        }
        if (file.size > maxSize) {
            showError('profilePicError', 'File size must be less than 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.opacity = '1';
        }
        reader.readAsDataURL(file);
    }
});

// OTP Handling
sendOtpBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    if (!validateEmail(email)) {
        showError('emailError', 'Please enter a valid email address');
        return;
    }

    try {
        toggleLoading(sendOtpBtn, true, 'Sending...');
        
        const response = await fetch('/api/v1/users/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new ApiError(response.status, data?.message || 'Failed to send OTP');
        }

        sendOtpBtn.textContent = 'Resend OTP';
        verifyOtpBtn.style.display = 'inline-block';
        showError('otpError', 'OTP sent to your email', 'success');
    } catch (error) {
        showError('otpError', error.message || 'Error sending OTP');
    } finally {
        toggleLoading(sendOtpBtn, false);
    }
});

verifyOtpBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const otp = otpInput.value;

    if (!otp) {
        showError('otpError', 'Please enter OTP');
        return;
    }

    try {
        toggleLoading(verifyOtpBtn, true, 'Verifying...');
        
        const response = await fetch('/api/v1/users/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new ApiError(response.status, data?.message || 'Invalid OTP');
        }

        otpVerified = true;
        verifyOtpBtn.textContent = '✓ Verified';
        verifyOtpBtn.classList.add('verified');
        sendOtpBtn.style.display = 'none';
        otpInput.setAttribute('disabled', true);
        updateSubmitButton();
        showError('otpError', 'OTP verified successfully', 'success');
    } catch (error) {
        showError('otpError', error.message || 'Error verifying OTP');
    } finally {
        toggleLoading(verifyOtpBtn, false);
    }
});

// Form Validation
form.addEventListener('input', () => updateSubmitButton());

function updateSubmitButton() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const isValid = (
        document.getElementById('firstName').value &&
        document.getElementById('lastName').value &&
        validateEmail(emailInput.value) &&
        password &&
        password === confirmPassword &&
        document.getElementById('agreedToTerms').checked &&
        profilePicInput.files.length > 0 &&
        otpVerified
    );

    submitBtn.disabled = !isValid;
    submitBtn.style.backgroundColor = isValid ? '#28a745' : '#a8a8a8';
}

// Form Submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Final validation check
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    if (password !== confirmPassword) {
        showError('confirmPasswordError', 'Passwords do not match');
        return;
    }

    try {
        toggleLoading(submitBtn, true, 'Registering...');
        
        const formData = new FormData();
        formData.append('profilePic', profilePicInput.files[0]);
        formData.append('firstName', document.getElementById('firstName').value);
        formData.append('lastName', document.getElementById('lastName').value);
        formData.append('email', emailInput.value);
        formData.append('password', password);
        formData.append('otp', otpInput.value);
        formData.append('agreedToTerms', true);

        const response = await fetch('/api/v1/users/register', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new ApiError(response.status, data?.message || 'Registration failed');
        }

        window.location.href = '/success-page';
    } catch (error) {
        showError('submitError', error.message || 'Error submitting form');
    } finally {
        toggleLoading(submitBtn, false);
    }
});

// Utility Functions
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showError(fieldId, message, type = 'error') {
    const errorField = document.getElementById(fieldId);
    if (errorField) {
        errorField.textContent = message;
        errorField.style.color = type === 'success' ? '#28a745' : '#e74c3c';
        errorField.style.display = 'block';
    }
}

function toggleLoading(element, isLoading, loadingText = '') {
    if (isLoading) {
        element.disabled = true;
        element.innerHTML = loadingText + '<div class="loading-spinner"></div>';
    } else {
        element.disabled = false;
        element.innerHTML = element.dataset.originalText;
    }
}

class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}