// API base URL from config
const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'https://custom-dining.onrender.com';

// Function to fetch data from API with authentication
async function fetchWithAuth(endpoint, options = {}) {
    try {
        // Get token from localStorage or sessionStorage
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        
        if (!token) {
            console.error('No authentication token found');
            window.location.href = 'login.html';
            return Promise.reject(new Error('No authentication token'));
        }
        
        // Set headers
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };
        
        // Remove any leading slashes to prevent double slashes
        const cleanEndpoint = endpoint.replace(/^\/+/, '');
        
        // Construct the full URL
        const url = `${API_BASE_URL}/${cleanEndpoint}`;
        console.log('API Request:', { method: options.method || 'GET', url });
        
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText };
            }
            
            console.error('API Error:', {
                status: response.status,
                statusText: response.statusText,
                endpoint: cleanEndpoint,
                error: errorData
            });
            
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('API Response:', { endpoint: cleanEndpoint, data });
        return data;
        
    } catch (error) {
        console.error('Error in fetchWithAuth:', error);
        throw error; // Re-throw to let the caller handle it
    }
}

// Function to format numbers with commas
function formatNumber(num) {
    return num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0';
}

// Load dashboard stats from API
async function loadDashboardStats() {
    try {
        // Show loading states
        document.getElementById('total-users').textContent = 'Loading...';
        document.getElementById('total-restaurants').textContent = 'Loading...';
        document.getElementById('total-meals').textContent = 'Loading...';
        
        // Fetch all data in parallel using the working endpoints from curl
        const [usersResponse, restaurantsResponse, mealsResponse] = await Promise.all([
            fetchWithAuth('api/admin/users?page=1&limit=100', { credentials: 'same-origin', mode: 'cors' }),
            fetchWithAuth('api/restaurants/', { credentials: 'same-origin', mode: 'cors' }),
            fetchWithAuth('api/meals/', { credentials: 'same-origin', mode: 'cors' })
        ]);
        
        // Extract counts based on the actual API response format
        const totalUsers = usersResponse?.count || usersResponse?.data?.users?.length || 0;
        const totalRestaurants = restaurantsResponse?.results || restaurantsResponse?.data?.restaurants?.length || 0;
        const totalMeals = mealsResponse?.data?.length || 0;
        
        // Update UI with counts
        document.getElementById('total-users').textContent = formatNumber(totalUsers);
        document.getElementById('total-restaurants').textContent = formatNumber(totalRestaurants);
        document.getElementById('total-meals').textContent = formatNumber(totalMeals);
        
        // Log the data for debugging
        console.log('Dashboard data loaded:', { 
            users: totalUsers, 
            restaurants: totalRestaurants, 
            meals: totalMeals,
            usersResponse,
            restaurantsResponse,
            mealsResponse
        });
        
        // Load recent activity
        loadRecentActivity();
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        // Show error message
        document.getElementById('total-users').textContent = 'Error';
        document.getElementById('total-restaurants').textContent = 'Error';
        document.getElementById('total-meals').textContent = 'Error';
        
        // Try to load with alternative endpoints if the first attempt fails
        try {
            console.log('Trying alternative endpoints...');
            const [users, restaurants, meals] = await Promise.all([
                fetchWithAuth('/api/admin/users?page=1&limit=100'),
                fetchWithAuth('/api/restaurants'),
                fetchWithAuth('/api/meals')
            ]);
            
            const altUsers = Array.isArray(users?.data) ? users.data.length : 0;
            const altRestaurants = Array.isArray(restaurants?.data) ? restaurants.data.length : 0;
            const altMeals = Array.isArray(meals?.data) ? meals.data.length : 0;
            
            document.getElementById('total-users').textContent = formatNumber(altUsers);
            document.getElementById('total-restaurants').textContent = formatNumber(altRestaurants);
            document.getElementById('total-meals').textContent = formatNumber(altMeals);
            
        } catch (altError) {
            console.error('Error with alternative endpoints:', altError);
        }
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const activityList = document.getElementById('recent-activity');
        if (!activityList) return;
        
        // Show loading state
        activityList.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 mb-0">Loading recent activity...</p>
            </div>`;
        
        try {
            // Fetch recent users and restaurants using working endpoints
            const [usersResponse, restaurantsResponse] = await Promise.all([
                fetchWithAuth('api/admin/users?page=1&limit=100', { credentials: 'same-origin', mode: 'cors' }),
                fetchWithAuth('api/restaurants/', { credentials: 'same-origin', mode: 'cors' })
            ]);
            
            // Get the most recent 3 items from the nested data structure
            const allUsers = usersResponse?.data?.users || [];
            const allRestaurants = restaurantsResponse?.data?.restaurants || [];
            
            // Sort by createdAt and take first 3
            const recentUsers = [...allUsers]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 3);
                
            const recentRestaurants = [...allRestaurants]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 3);
            
            // Clear loading state
            activityList.innerHTML = '';
            
            // Add recent users to activity
            recentUsers.slice(0, 3).forEach(user => {
                if (!user) return;
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item';
                activityItem.innerHTML = `
                    <div class="activity-icon">
                        <i class="fas fa-user-plus"></i>
                    </div>
                    <div class="activity-details">
                        <p>New user registered: ${user.email || 'Unknown'}</p>
                        <span class="activity-time">${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Just now'}</span>
                        <div class="badge bg-${user.role === 'admin' ? 'danger' : user.role === 'restaurant' ? 'info' : 'success'} mt-1">
                            ${user.role || 'user'}
                        </div>
                    </div>
                `;
                activityList.appendChild(activityItem);
            });
            
            // Add recent restaurants to activity
            recentRestaurants.slice(0, 3).forEach(restaurant => {
                if (!restaurant) return;
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item';
                activityItem.innerHTML = `
                    <div class="activity-icon">
                        <i class="fas fa-utensils"></i>
                    </div>
                    <div class="activity-details">
                        <p>New restaurant: <strong>${restaurant.restaurantName || restaurant.name || 'Unnamed'}</strong></p>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-${restaurant.status === 'approved' ? 'success' : 'warning'}">
                                ${restaurant.status || 'pending'}
                            </span>
                            <small class="text-muted">${restaurant.location || 'No location'}</small>
                        </div>
                        <span class="activity-time">${restaurant.createdAt ? new Date(restaurant.createdAt).toLocaleString() : 'Recently'}</span>
                    </div>
                `;
                activityList.appendChild(activityItem);
            });
            
            // Show message if no activity
            if (activityList.children.length === 0) {
                activityList.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                        <p class="text-muted mb-0">No recent activity found</p>
                    </div>`;
            }
            
        } catch (fetchError) {
            console.error('Error fetching activity data:', fetchError);
            activityList.innerHTML = `
                <div class="alert alert-warning mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Could not load recent activity. Please try again later.
                </div>`;
        }
        
    } catch (error) {
        console.error('Error in loadRecentActivity:', error);
    }
}

// Add mobile menu toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    let backdrop = document.querySelector('.sidebar-backdrop');

    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
    }

    function closeSidebar() {
        sidebar.classList.remove('active');
        backdrop.style.display = 'none';
    }

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
            backdrop.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
        });
    }

    backdrop.addEventListener('click', closeSidebar);

    // Optionally close sidebar on navigation
    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeSidebar);
    });
});

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Load user info safely
    const userMenu = document.querySelector('.user-menu');
    if (userMenu) {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user && typeof user === 'object') {
                    const name = user.name || user.email?.split('@')[0] || 'Admin';
                    const nameParts = name.split(' ') || [];
                    const initials = nameParts.map(part => part[0]?.toUpperCase() || '').join('').substring(0, 2) || 'A';
                    
                    userMenu.innerHTML = `
                        <span>${name}</span>
                        <div class="avatar">${initials}</div>
                    `;
                } else {
                    console.error('Invalid user data format');
                    userMenu.innerHTML = `
                        <span>Admin</span>
                        <div class="avatar">A</div>
                    `;
                }
            } else {
                console.error('No user data found in localStorage');
                userMenu.innerHTML = `
                    <span>Admin</span>
                    <div class="avatar">A</div>
                `;
            }
        } catch (error) {
            console.error('Error parsing user data:', error);
            userMenu.innerHTML = `
                <span>Admin</span>
                <div class="avatar">A</div>
            `;
        }
    }
    
    // Load dashboard stats
    loadDashboardStats();
    
    // Toggle sidebar on mobile
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.querySelector('.top-bar .menu-toggle');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
    
    // Logout functionality
    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }
});
