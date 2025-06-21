const API_BASE_URL = (window.API_CONFIG?.BASE_URL || 'https://custom-dining.onrender.com').replace(/\/+$/, '');

// DOM Elements
const usersTableBody = document.getElementById('users-table-body');
const searchInput = document.getElementById('search-input');
const firstPageBtn = document.getElementById('first-page-btn');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const lastPageBtn = document.getElementById('last-page-btn');
const pageInfo = document.getElementById('page-info');
const showingInfo = document.getElementById('showing-info');

let tooltipList = [];

function initTooltips() {
    tooltipList.forEach(tooltip => tooltip.dispose());
    
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipList = tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
}

// Pagination state
let currentPage = 1;
const itemsPerPage = 100;
let totalPages = 1;
let totalUsers = 0;
let users = [];
let searchQuery = '';

async function fetchUsers(page = 1, query = '') {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        if (query !== undefined) {
            searchQuery = query;
            currentPage = 1;
        }

        // Show loading state
        if (usersTableBody) {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2 mb-0">Loading users...</p>
                    </td>
                </tr>`;
        }

        // Build the URL with query parameters
        const params = new URLSearchParams({
            page: currentPage,
            limit: itemsPerPage,
            ...(searchQuery && { search: searchQuery })
        });

        const response = await fetch(`${API_BASE_URL}/api/admin/users?${params}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin',
            mode: 'cors'
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }

        const data = await response.json().catch(error => {
            console.error('Error parsing JSON:', error);
            throw new Error('Invalid response from server');
        });

        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch users');
        }

        // Handle the API response format
        users = Array.isArray(data.data?.users) ? data.data.users : (Array.isArray(data.data) ? data.data : []);
        totalUsers = data.count || data.pagination?.total || 0;
        totalPages = Math.ceil(totalUsers / itemsPerPage);
        
        renderUsers();
        updatePagination();
        initTooltips(); // Initialize tooltips after rendering
    } catch (error) {
        console.error('Error fetching users:', error);
        showNotification(error.message || 'Failed to load users. Please try again.', 'error');
        
        // Show error state in table
        if (usersTableBody) {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <i class="fas fa-exclamation-circle fa-3x text-danger mb-3"></i>
                        <p class="h5">Error loading users</p>
                        <p class="text-muted">${error.message || 'Please try again later'}</p>
                        <button class="btn btn-primary mt-2" onclick="fetchUsers()">
                            <i class="fas fa-sync-alt me-2"></i>Retry
                        </button>
                    </td>
                </tr>`;
        }
    }
}

// Render users in the table
function renderUsers() {
    if (!usersTableBody) {
        console.error('usersTableBody not found in DOM');
        return;
    }

    if (!users.length) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5">
                    <i class="fas fa-users-slash fa-3x text-muted mb-3"></i>
                    <p class="h5 text-muted">No users found</p>
                    <p class="text-muted">Try adjusting your search or add a new user</p>
                </td>
            </tr>`;
        return;
    }

    usersTableBody.innerHTML = users.map(user => {
        const name = user.username || user.name || 'Unnamed User';
        const email = user.email || 'No email';
        const role = user.role || 'user';
        const isActive = user.isActive !== false; // Default to true if not specified
        const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
        const userId = user.id || '';

        // Role badge
        const roleBadge = `
            <span class="badge ${role === 'admin' ? 'bg-danger' : role === 'restaurant' ? 'bg-info' : 'bg-success'}">
                ${role.charAt(0).toUpperCase() + role.slice(1)}
            </span>
        `;

        // Status badge
        const statusBadge = `
            <span class="badge ${user.isEmailVerified ? 'bg-success' : 'bg-warning'}">
                <i class="fas ${user.isEmailVerified ? 'fa-check-circle' : 'fa-envelope'} me-1"></i>
                ${user.isEmailVerified ? 'Active' : 'Pending Email'}
            </span>
        `;

        // Action buttons have been removed

        return `
            <tr>
                <td class="align-middle">
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle me-3">
                            ${name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="fw-semibold">${name}</div>
                            <small class="text-muted">${role}</small>
                        </div>
                    </div>
                </td>
                <td class="align-middle">
                    ${email ? `<a href="mailto:${email}" class="text-decoration-none">${email}</a>` : 'N/A'}
                </td>
                <td class="align-middle">
                    ${roleBadge}
                </td>
                <td class="align-middle text-center">
                    ${statusBadge}
                </td>
                <td class="align-middle text-center">
                    <small class="text-muted">${createdAt}</small>
                </td>
            </tr>
        `;
    }).join('');
}

// Update pagination controls
function updatePagination() {
    // Update showing info
    const startItem = totalUsers > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const endItem = Math.min(currentPage * itemsPerPage, totalUsers);
    showingInfo.textContent = `Showing ${startItem} to ${endItem} of ${totalUsers} entries`;
    
    // Update page info
    pageInfo.textContent = currentPage;
    
    // Update button states
    const firstPageItem = document.getElementById('first-page');
    const prevPageItem = document.getElementById('prev-page');
    const nextPageItem = document.getElementById('next-page');
    const lastPageItem = document.getElementById('last-page');
    
    // Disable/enable pagination buttons
    firstPageBtn.disabled = currentPage === 1;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages || totalPages === 0;
    lastPageBtn.disabled = currentPage >= totalPages || totalPages === 0;
    
    // Update button classes based on state
    firstPageItem.classList.toggle('disabled', currentPage === 1);
    prevPageItem.classList.toggle('disabled', currentPage === 1);
    nextPageItem.classList.toggle('disabled', currentPage >= totalPages || totalPages === 0);
    lastPageItem.classList.toggle('disabled', currentPage >= totalPages || totalPages === 0);
}

// Event Listeners
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

const handleSearch = debounce((e) => {
    const searchTerm = e.target.value.trim();
    searchQuery = searchTerm;
    currentPage = 1;
    fetchUsers();
}, 500);

// Initialize search input
searchInput?.addEventListener('input', handleSearch);

// Pagination event listeners
function setupPagination() {
    // First page
    firstPageBtn?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage = 1;
            fetchUsers();
        }
    });

    // Previous page
    prevPageBtn?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchUsers();
        }
    });

    // Next page
    nextPageBtn?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchUsers();
        }
    });

    // Last page
    lastPageBtn?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage = totalPages;
            fetchUsers();
        }
    });
}

// Initialize pagination
setupPagination();

// Show notification function
function showNotification(message, type = 'info') {
    // Check if notification container exists, if not create it
    let notificationContainer = document.querySelector('.notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container position-fixed top-0 end-0 p-3';
        notificationContainer.style.zindex = '1100'; // Above modals
        document.body.appendChild(notificationContainer);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `toast show align-items-center text-white bg-${type} border-0`;
    notification.role = 'alert';
    notification.setAttribute('aria-live', 'assertive');
    notification.setAttribute('aria-atomic', 'true');
    
    notification.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 150);
    }, 5000);
    
    // Close button functionality
    const closeButton = notification.querySelector('[data-bs-dismiss="toast"]');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 150);
        });
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize tooltips
    initTooltips();
    
    // Load initial data
    fetchUsers();
});

// These functions handle user actions from the UI
window.editUser = function(userId) {
    // Placeholder for edit user functionality
    showNotification(`Edit user ${userId}`, 'info');
};

window.deleteUser = function(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        showNotification('User deleted successfully', 'success');
        fetchUsers();
    }
};

window.editUser = (userId) => {
    console.log('Edit user:', userId);
};

window.deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }


        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to delete user');
        }

        fetchUsers(currentPage, searchInput.value);
        showNotification('User deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification(error.message || 'Failed to delete user', 'error');
    }
};

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

document.getElementById('logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
});