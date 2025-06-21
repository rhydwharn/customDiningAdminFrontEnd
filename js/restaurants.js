function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const API_BASE_URL = 'https://custom-dining.onrender.com';

// Global state
let currentPage = 1;
const itemsPerPage = 9; // 3x3 grid
let totalRestaurants = 0;
let restaurants = [];
let restaurantOwners = [];

function getPaginatedItems(items, page = 1, perPage = itemsPerPage) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return items.slice(start, end);
}

let allRestaurants = [];

async function fetchRestaurants() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        if (restaurantsTableBody) {
            restaurantsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2 mb-0">Loading restaurants...</p>
                    </td>
                </tr>`;
        }

        // Make the API request to get restaurants
        const response = await fetch(`${API_BASE_URL}/api/restaurants`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // If user is not authorized, redirect to login
        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }

        // Convert the response to JSON
        const responseData = await response.json();

        // The API can return data in different formats, so we need to handle them all
        let allRestaurants = [];
        
        if (responseData?.data?.restaurants) {
            // Format: { data: { restaurants: [...] } }
            allRestaurants = responseData.data.restaurants;
        } else if (responseData?.data) {
            // Format: { data: [...] }
            allRestaurants = Array.isArray(responseData.data) ? responseData.data : [responseData.data];
        } else if (Array.isArray(responseData)) {
            // Format: [...]
            allRestaurants = responseData;
        }
        
        // Update the UI with the fetched restaurants
        updateRestaurantsList(allRestaurants);
        
    } catch (error) {
        // If something goes wrong, show an error message
        console.error('Error fetching restaurants');
        showNotification('Failed to load restaurants. Please try again.', 'error');
    }
}

function updateRestaurantsList(restaurantsList) {
    allRestaurants = restaurantsList;
    totalRestaurants = allRestaurants.length;
    restaurants = getPaginatedItems(allRestaurants, currentPage);
    
    if (restaurantsTableBody) {
        renderRestaurants();
    }
    
    updatePagination();
}

function renderRestaurants() {
    if (!restaurantsTableBody) return;
    
    if (restaurantsTableBody.querySelector('.spinner-border')) {
        restaurantsTableBody.innerHTML = '';
    }
    
    if (!allRestaurants.length) {
        restaurantsTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5">
                    <i class="fas fa-utensils fa-3x text-muted mb-3"></i>
                    <p class="h5 text-muted">No restaurants found</p>
                    <p class="text-muted">Add a new restaurant to get started</p>
                </td>
            </tr>`;
        return;
    }

    const restaurantsArray = Array.isArray(restaurants) ? restaurants : [];
    
    const tableRows = restaurantsArray.map(restaurant => {
        if (!restaurant) return '';
        
        const name = restaurant.restaurantName || 'Unnamed Restaurant';
        const location = restaurant.location || 'Location not specified';
        const cuisineType = restaurant.cuisineType || 'Various Cuisines';
        const contactEmail = restaurant.contactEmail || 'No email';
        const ownerEmail = restaurant.owner?.email || 'No owner';
        const status = restaurant.status || 'pending';
        const restaurantId = restaurant.restaurantId || restaurant.id || '';
        
        
        // Create status badge
        const statusBadge = `
            <span class="badge rounded-pill ${status === 'approved' ? 'bg-success' : status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}">
                <i class="fas ${status === 'approved' ? 'fa-check-circle' : status === 'rejected' ? 'fa-times-circle' : 'fa-clock'} me-1"></i>
                ${status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        `;
        
        // Action buttons
        let actionButtons = '';
        if (status === 'pending') {
            actionButtons = `
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-success" 
                            onclick="approveRestaurant('${restaurantId}')"
                            data-bs-toggle="tooltip" title="Approve"
                            data-restaurant-id="${restaurantId}">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button type="button" class="btn btn-danger" 
                            onclick="declineRestaurant('${restaurantId}')"
                            data-bs-toggle="tooltip" title="Decline"
                            data-restaurant-id="${restaurantId}">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>`;
        } else if (status === 'approved') {
            actionButtons = `
                <button type="button" class="btn btn-primary btn-sm" 
                        onclick="viewRestaurant('${restaurantId}')"
                        data-bs-toggle="tooltip" title="View">
                    <i class="fas fa-eye me-1"></i> View
                </button>`;
        } else if (status === 'rejected') {
            actionButtons = `
                <button type="button" class="btn btn-secondary btn-sm" disabled
                        data-bs-toggle="tooltip" title="Viewing not available for rejected restaurants">
                    <i class="fas fa-eye-slash me-1"></i> View Unavailable
                </button>`;
        }
        
        return `
            <tr class="align-middle">
                <td>
                    <div class="d-flex align-items-center">
                        <div class="me-2">
                            <i class="fas fa-utensils text-primary"></i>
                        </div>
                        <div>
                            <div class="fw-semibold">${name}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <i class="fas fa-map-marker-alt text-muted me-2"></i>
                        <span>${location}</span>
                    </div>
                </td>
                <td>${cuisineType}</td>
                <td>
                    <a href="mailto:${contactEmail}" class="text-decoration-none">
                        <i class="fas fa-envelope me-1 text-muted"></i>
                        ${contactEmail}
                    </a>
                </td>
                <td>
                    ${ownerEmail.includes('@') ? 
                        `<a href="mailto:${ownerEmail}" class="text-decoration-none">
                            <i class="fas fa-user me-1 text-muted"></i>
                            ${ownerEmail}
                        </a>` : 
                        `<span class="text-muted">${ownerEmail}</span>`
                    }
                </td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-center">${actionButtons}</td>
            </tr>
        `;
    });

    // Join all rows and update table body
    restaurantsTableBody.innerHTML = tableRows.join('');
    
    // Initialize tooltips if Bootstrap is available
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.forEach(function(tooltipTriggerEl) {
            new bootstrap.Tooltip(tooltipTriggerEl, {
                trigger: 'hover',
                placement: 'top',
                container: 'body'
            });
        });
    } else {
        console.warn('Bootstrap tooltips not available. Make sure Bootstrap JS is loaded.');
    }
}

// Update pagination controls
function updatePagination() {
    const totalPages = Math.ceil(totalRestaurants / itemsPerPage);
    const startItem = totalRestaurants > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const endItem = Math.min(currentPage * itemsPerPage, totalRestaurants);
    
    // Update page info
    pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    showingInfo.textContent = `Showing ${startItem} to ${endItem} of ${totalRestaurants} entries`;
    
    // Update button states
    firstPageBtn.classList.toggle('disabled', currentPage === 1);
    prevPageBtn.classList.toggle('disabled', currentPage === 1);
    nextPageBtn.classList.toggle('disabled', currentPage >= totalPages || totalPages === 0);
    lastPageBtn.classList.toggle('disabled', currentPage >= totalPages || totalPages === 0);
    
    // Update ARIA attributes
    firstPageBtn.setAttribute('aria-disabled', currentPage === 1);
    prevPageBtn.setAttribute('aria-disabled', currentPage === 1);
    nextPageBtn.setAttribute('aria-disabled', currentPage >= totalPages || totalPages === 0);
    lastPageBtn.setAttribute('aria-disabled', currentPage >= totalPages || totalPages === 0);
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Global functions (needed for inline event handlers)
window.viewRestaurant = async function(restaurantId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('No token found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        // Show loading state
        const modalContent = document.getElementById('restaurantDetailsContent');
        modalContent.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading restaurant details...</p>
            </div>`;

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('restaurantDetailsModal'));
        modal.show();

        // Fetch restaurant details
        const response = await fetch(`${API_BASE_URL}/api/restaurants/${restaurantId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (response.status === 401) {

            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch restaurant details');
        }

        const responseData = await response.json();
        let restaurant;
        if (responseData && responseData.data) {
            // Handle both single restaurant and nested data structure
            restaurant = responseData.data.restaurant || responseData.data;
        } else {
            restaurant = responseData;
        }

        if (!restaurant) {
            throw new Error('No restaurant data found');
        }
        
        // Format the details HTML based on the API response
        const detailsHTML = `
            <div class="modal-header">
                <h5 class="modal-title">${restaurant.restaurantName || 'Restaurant Details'}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="mb-4">
                    <div class="d-flex align-items-center mb-3">
                        <i class="fas fa-utensils text-muted me-2"></i>
                        <span>${restaurant.cuisineType || 'N/A'}</span>
                    </div>
                    
                    <div class="d-flex align-items-center mb-3">
                        <i class="fas fa-map-marker-alt text-muted me-2"></i>
                        <span>${restaurant.location || 'Location not specified'}</span>
                    </div>
                    
                    <div class="d-flex align-items-center mb-3">
                        <i class="fas fa-envelope text-muted me-2"></i>
                        <a href="mailto:${restaurant.contactEmail || ''}" class="text-decoration-none">
                            ${restaurant.contactEmail || 'No email'}
                        </a>
                    </div>
                    
                    <div class="d-flex align-items-center mb-3">
                        <i class="fas fa-user text-muted me-2"></i>
                        <span>Owner: ${restaurant.owner?.username || 'N/A'}</span>
                    </div>
                    
                    ${restaurant.approvedByAdmin ? `
                        <div class="d-flex align-items-center">
                            <i class="fas fa-user-shield text-muted me-2"></i>
                            <span>Approved by: ${restaurant.approvedByAdmin.username || 'N/A'}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Update modal content
        modalContent.innerHTML = detailsHTML;
        
        // No edit functionality for now
        
    } catch (error) {
        console.error('Error loading restaurant details:', error);
        const modalContent = document.getElementById('restaurantDetailsContent');
        modalContent.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle me-2"></i>
                Failed to load restaurant details. Please try again later.
            </div>`;
    }
};

// Show rejection reason modal
function showRejectionModal(restaurantId) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'rejectionModal';
        modal.tabIndex = '-1';
        modal.setAttribute('aria-hidden', 'true');
        
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Rejection Reason</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="rejectionReason" class="form-label">Please provide a reason for rejection:</label>
                            <textarea class="form-control" id="rejectionReason" rows="3" required></textarea>
                            <div class="invalid-feedback">Please provide a reason for rejection.</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-danger" id="confirmReject">Reject Restaurant</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
        
        const confirmBtn = modal.querySelector('#confirmReject');
        const textarea = modal.querySelector('#rejectionReason');
        
        // Handle confirmation
        confirmBtn.addEventListener('click', () => {
            if (!textarea.value.trim()) {
                textarea.classList.add('is-invalid');
                return;
            }
            modalInstance.hide();
            resolve(textarea.value.trim());
            modal.remove();
        });
        
        // Clean up when modal is closed
        modal.addEventListener('hidden.bs.modal', () => {
            if (document.body.contains(modal)) {
                resolve(null);
                modal.remove();
            }
        });
    });
}

// Update restaurant status
async function updateRestaurantStatus(restaurantId, status, rejectionReason = '') {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return null;
        }

        const response = await fetch(`${API_BASE_URL}/api/admin/restaurants/${restaurantId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                status,
                ...(status === 'rejected' && { rejectionReason })
            })
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return null;
        }

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to update restaurant status');
        }

        return data;
    } catch (error) {
        console.error('Error updating restaurant status:', error);
        throw error;
    }
}

// Approve restaurant
window.approveRestaurant = async function(restaurantId) {
    if (!confirm('Are you sure you want to approve this restaurant?')) {
        return;
    }
    
    try {
        // Show loading state
        const approveBtn = document.querySelector(`button[onclick*="approveRestaurant('${restaurantId}')"]`);
        const originalText = approveBtn.innerHTML;
        approveBtn.disabled = true;
        approveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Approving...';
        
        const result = await updateRestaurantStatus(restaurantId, 'approved');
        
        if (result) {
            // Update the restaurant in the local state
            const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
            if (restaurant) {
                restaurant.status = 'approved';
                renderRestaurants();
                showNotification('Restaurant approved successfully', 'success');
            }
        }
    } catch (error) {
        console.error('Error approving restaurant:', error);
        showNotification(error.message || 'Failed to approve restaurant', 'error');
    } finally {
        // Reset button state
        const approveBtn = document.querySelector(`button[onclick*="approveRestaurant('${restaurantId}')"]`);
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.innerHTML = originalText;
        }
    }
};

// Decline restaurant
window.declineRestaurant = async function(restaurantId) {
    try {
        // Show modal for rejection reason
        const rejectionReason = await showRejectionModal(restaurantId);
        
        if (!rejectionReason) {
            return; // User cancelled
        }
        
        if (!confirm('Are you sure you want to reject this restaurant?')) {
            return;
        }
        
        // Show loading state
        const declineBtn = document.querySelector(`button[onclick*="declineRestaurant('${restaurantId}')"]`);
        const originalText = declineBtn.innerHTML;
        declineBtn.disabled = true;
        declineBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Rejecting...';
        
        const result = await updateRestaurantStatus(restaurantId, 'rejected', rejectionReason);
        
        if (result) {
            // Update the restaurant in the local state
            const restaurant = restaurants.find(r => r.restaurantId === restaurantId);
            if (restaurant) {
                restaurant.status = 'rejected';
                renderRestaurants();
                showNotification('Restaurant rejected successfully', 'success');
            }
        }
    } catch (error) {
        console.error('Error rejecting restaurant:', error);
        showNotification(error.message || 'Failed to reject restaurant', 'error');
    } finally {
        // Reset button state
        const declineBtn = document.querySelector(`button[onclick*="declineRestaurant('${restaurantId}')"]`);
        if (declineBtn) {
            declineBtn.disabled = false;
            declineBtn.innerHTML = originalText;
        }
    }
};

window.deleteRestaurant = async function(restaurantId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('No token found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        if (!confirm('Are you sure you want to delete this restaurant?')) {
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/restaurants/${restaurantId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to delete restaurant');
        }

        // Remove from local state
        restaurants = restaurants.filter(r => r.restaurantId !== restaurantId);
        totalRestaurants--;
        renderRestaurants();
        updatePagination();

        showNotification('Restaurant deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting restaurant:', error);
        showNotification('Failed to delete restaurant. Please try again.', 'error');
    }
};

// Pagination event handlers
const setupPagination = () => {
    const updateDisplay = () => {
        restaurants = getPaginatedItems(allRestaurants, currentPage);
        renderRestaurants();
        updatePagination();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (firstPageBtn) {
        firstPageBtn.addEventListener('click', () => {
            currentPage = 1;
            updateDisplay();
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                updateDisplay();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalRestaurants / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                updateDisplay();
            }
        });
    }
    
    if (lastPageBtn) {
        lastPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalRestaurants / itemsPerPage);
            currentPage = totalPages || 1;
            updateDisplay();
        });
    }
};

// Load restaurant owners for the dropdown
async function loadRestaurantOwners() {
    
    const ownerDropdown = document.getElementById('ownerId');
    if (!ownerDropdown) {
        return;
    }

    // Show loading state
    ownerDropdown.disabled = true;
    ownerDropdown.innerHTML = '<option value="">Loading owners...</option>';
    
    try {
        // Check authentication
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        // Get user data from localStorage
        let currentUser = null;
        const userDataStr = localStorage.getItem('user');
        
        // Try to parse user data
        if (userDataStr) {
            try {
                currentUser = JSON.parse(userDataStr);
        
            } catch (e) {
                // Removed console.error
            }
        }
        
        // If we don't have valid user data, try to get it from the token
        if (!currentUser || (!currentUser._id && !currentUser.id)) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                
                currentUser = {
                    _id: payload.userId || payload.sub,
                    email: payload.email || 'user@example.com',
                    role: payload.role || 'user',
                    name: payload.name || (payload.email ? payload.email.split('@')[0] : 'User')
                };
                
                // Save to localStorage for future use
                localStorage.setItem('user', JSON.stringify(currentUser));
            } catch (tokenError) {
                console.error('Error parsing token');
                showNotification('Session expired. Please log in again.', 'error');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }
        }
        
        // If we reach here, we have a valid currentUser
        
        // If current user is a restaurant owner, only show their own account
        if (currentUser.role === 'restaurant') {
            ownerDropdown.innerHTML = `
                <option value="${currentUser._id || currentUser.id}" selected>
                    ${currentUser.name || currentUser.email || 'Restaurant Owner'}
                </option>`;
            ownerDropdown.disabled = true; // Disable dropdown since there's only one option
            return;
        }
        
        // For admin users, fetch all users and filter for restaurants
        if (currentUser.role === 'admin') {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                });

                if (response.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = 'login.html';
                    return;
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || 'Failed to load users');
                }

                const responseData = await response.json();
                // Extract users from response
                const users = (responseData.data?.users && Array.isArray(responseData.data.users))
                    ? responseData.data.users
                    : [];
                
                // Filter for restaurant users and active accounts
                const restaurants = users.filter(user => 
                    user.role === 'restaurant' && (user.isActive === 1 || user.isActive === true)
                );
                
                // Clear existing options
                ownerDropdown.innerHTML = '';
                
                if (restaurants.length > 0) {
                    // Add a default option
                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = 'Select a restaurant';
                    defaultOption.disabled = true;
                    defaultOption.selected = true;
                    ownerDropdown.appendChild(defaultOption);
                    
                    // Add restaurants to dropdown
                    restaurants.forEach(restaurant => {
                        const option = document.createElement('option');
                        option.value = restaurant.id;
                        option.textContent = restaurant.username || restaurant.email || `Restaurant ${restaurant.id.substring(0, 6)}`;
                        ownerDropdown.appendChild(option);
                    });
                    
                    ownerDropdown.disabled = false;
                } else {
                    const noRestaurants = document.createElement('option');
                    noRestaurants.textContent = 'No restaurants found';
                    noRestaurants.disabled = true;
                    ownerDropdown.appendChild(noRestaurants);
                    ownerDropdown.disabled = true;
                }
            } catch (error) {
                console.error('Error loading restaurant owners:', error);
                ownerDropdown.innerHTML = '<option value="" disabled>Error loading owners</option>';
                showNotification('Failed to load restaurant owners. Please try again.', 'error');
            }
        } else {
            // For other roles, show an error
            ownerDropdown.innerHTML = '<option value="" disabled>Unauthorized</option>';
            showNotification('You do not have permission to add restaurants', 'error');
        }
        
    } catch (error) {
        console.error('Error loading restaurant owners:', error);
        const ownerDropdown = document.getElementById('ownerId');
        if (ownerDropdown) {
            ownerDropdown.innerHTML = '<option value="" disabled>Error loading owners</option>';
        }
        showNotification('Failed to load restaurant owners: ' + (error.message || 'Unknown error'), 'error');
    } finally {
        const ownerDropdown = document.getElementById('ownerId');
        if (ownerDropdown) {
            ownerDropdown.disabled = false;
        }
    }
}

// Handle add restaurant form submission
function setupAddRestaurantForm() {
    const form = document.getElementById('addRestaurantForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';
        
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = 'login.html';
                return;
            }

            // Get form data
            const formData = new FormData(form);
            const restaurantData = {
                name: formData.get('name'),
                location: formData.get('location'),
                contactEmail: formData.get('contactEmail'),
                contactNumber: formData.get('contactNumber'),
                website: formData.get('website'),
                description: formData.get('description'),
                openingHours: formData.get('openingHours'),
                cuisineType: formData.get('cuisineType'),
                capacity: parseInt(formData.get('capacity') || '0'),
                hasOutdoorSeating: formData.get('hasOutdoorSeating') === 'on',
                hasParking: formData.get('hasParking') === 'on',
                isVeganFriendly: formData.get('isVeganFriendly') === 'on',
                isVegetarianFriendly: formData.get('isVegetarianFriendly') === 'on',
                isGlutenFreeFriendly: formData.get('isGlutenFreeFriendly') === 'on',
                isHalal: formData.get('isHalal') === 'on',
                userId: formData.get('userId')
            };

            // Send request to create restaurant
            const response = await fetch(`${API_BASE_URL}/api/restaurants`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(restaurantData)
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || 'Failed to add restaurant');
            }

            // Close the modal and refresh the restaurants list
            const modal = bootstrap.Modal.getInstance(document.getElementById('addRestaurantModal'));
            if (modal) {
                modal.hide();
            }
            
            // Reset form
            form.reset();
            
            // Show success message
            showNotification('Restaurant added successfully!', 'success');
            
            // Refresh the restaurants list
            fetchRestaurants(currentPage);
            
        } catch (error) {
            console.error('Error adding restaurant:', error);
            showNotification(error.message || 'Failed to add restaurant. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
}

// DOM Elements
const searchInput = document.getElementById('search-restaurant');
const restaurantsTableBody = document.getElementById('restaurants-tbody');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const firstPageBtn = document.getElementById('first-page');
const lastPageBtn = document.getElementById('last-page');
const pageInfo = document.getElementById('page-info');
const showingInfo = document.getElementById('showing-info');
const logoutBtn = document.getElementById('logout');

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check if user is authenticated
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        // Add loading state
        if (restaurantsTableBody) {
            restaurantsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2 mb-0">Loading restaurants...</p>
                    </td>
                </tr>`;
        }
        
        // Load restaurant owners first
        await loadRestaurantOwners();
        
        // Initialize the add restaurant form
        setupAddRestaurantForm();
        
        // Initialize pagination
        setupPagination();
        
        // Setup search input if it exists
        if (searchInput) {
            const debouncedSearch = debounce(() => {
                currentPage = 1;
                fetchRestaurants();
            }, 300);
            
            searchInput.addEventListener('input', debouncedSearch);
        }

        // Logout functionality
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            });
        }
        
        // Initial fetch
        await fetchRestaurants();
    } catch (error) {
        console.error('Error initializing page:', error);
        showNotification('Failed to initialize page. Please try again.', 'error');
    }
});