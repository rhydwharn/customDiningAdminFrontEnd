// This is where our authentication API is hosted
const AUTH_BASE_URL = 'https://custom-dining.onrender.com';

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logout');
    
        function checkAuth() {
        const token = localStorage.getItem('token');
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        if (!token && currentPage !== 'login.html') {
            window.location.href = 'login.html';
            return false;
        }
        
        if (token && currentPage === 'login.html') {
            window.location.href = 'index.html';
            return false;
        }
        
        if (token) {
            updateUserDisplay();
            return true;
        }
        
        return false;
    }
    
    function updateUserDisplay() {
        const userMenuElements = document.querySelectorAll('.user-menu');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const displayName = user.name || 'Admin';
        
        // Create initials from name (e.g., "John Doe" -> "JD")
        const initials = displayName
            .split(' ')
            .map(name => name[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        
        userMenuElements.forEach(menu => {
            const nameSpan = menu.querySelector('span');
            if (nameSpan) {
                nameSpan.textContent = displayName;
            }
            
            // Update the avatar with the user's initials
            const avatarDiv = menu.querySelector('.avatar');
            if (avatarDiv) {
                avatarDiv.textContent = initials;
            }
        });
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email')?.value;
            const password = document.getElementById('password')?.value;
            const loginButton = document.getElementById('loginButton');
            
            if (!email || !password) {
                showNotification('Please enter both email and password', 'error');
                return;
            }
            
            // Safely handle login button states
            if (loginButton) {
                const loginButtonText = loginButton.querySelector('.button-text');
                const loginButtonSpinner = loginButton.querySelector('.spinner-border');
                
                // Show loading state
                loginButton.disabled = true;
                if (loginButtonText) loginButtonText.textContent = 'Signing in...';
                if (loginButtonSpinner) loginButtonSpinner.classList.remove('d-none');
            }
            
            try {
                const response = await fetch(`${AUTH_BASE_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Login failed. Please check your credentials.');
                }
                
                if (!data.token) {
                    throw new Error('No authentication token received');
                }
                
                const token = data.token;
                localStorage.setItem('token', token);
                
                try {
                    // Extract user data from JWT token
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    
                    const user = {
                        _id: payload.id || payload.userId || payload.sub,
                        email: payload.email || email,
                        role: payload.role || 'admin',
                        name: payload.name || email.split('@')[0] || 'Admin'
                    };
                    
                    localStorage.setItem('user', JSON.stringify(user));
                    updateUserDisplay();
                    window.location.href = 'index.html';
                    
                } catch (tokenError) {
                    console.error('Error processing token:', tokenError);
                    throw new Error('Failed to process authentication');
                }
                
            } catch (error) {
                console.error('Login error:', error);
                showNotification(error.message || 'Login failed. Please try again.', 'error');
                
                // Reset button state if it exists
                if (loginButton) {
                    const loginButtonText = loginButton.querySelector('.button-text');
                    const loginButtonSpinner = loginButton.querySelector('.spinner-border');
                    
                    loginButton.disabled = false;
                    if (loginButtonText) loginButtonText.textContent = 'Sign In';
                    if (loginButtonSpinner) loginButtonSpinner.classList.add('d-none');
                }
            }
        });
    }
    
    function handleLogout() {
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            if (!window.location.pathname.endsWith('login.html')) {
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = 'login.html';
        }
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Check authentication status
    checkAuth();
});
