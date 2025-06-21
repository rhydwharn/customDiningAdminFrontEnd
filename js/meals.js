// API base URL
const API_BASE_URL = 'https://custom-dining.onrender.com/api';

// Utility function to format price
function formatPrice(price) {
    if (price === undefined || price === null) return 'N/A';
    // Remove any non-numeric characters and convert to number
    const num = parseFloat(price.toString().replace(/[^0-9.-]+/g, ""));
    if (isNaN(num)) return 'N/A';
    // Format as Nigerian Naira
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

// Utility function for debouncing
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

// DOM Elements
const mealsContainer = document.querySelector('.content');
const mealsTbody = document.getElementById('meals-tbody');
const searchInput = document.getElementById('mealSearch'); // Use the filter search input
const restaurantFilter = document.getElementById('restaurantFilter');
const categoryFilter = document.getElementById('categoryFilter');
const statusFilter = document.getElementById('statusFilter');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
const mealModal = document.getElementById('meal-modal');
const closeModalBtn = document.getElementById('close-modal');
const mealForm = document.getElementById('meal-form');
const modalTitle = document.getElementById('modal-title');
const addMealBtn = document.querySelector('[data-bs-target="#meal-modal"]');

// Create meal details modal if it doesn't exist
let mealDetailsModal = document.getElementById('meal-details-modal');
if (!mealDetailsModal) {
    const modalHTML = `
    <div class="modal fade" id="meal-details-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="meal-details-title">Meal Details</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body" id="meal-details-body">
                    <div class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2">Loading meal details...</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    mealDetailsModal = document.getElementById('meal-details-modal');
}

// Global variables
let currentPage = 1;
const itemsPerPage = 9; // 3x3 grid
let totalMeals = 0;
let meals = [];
let restaurants = [];
let restaurantMap = new Map(); // For quick restaurant lookup

// Utility function to show notifications
function showNotification(message, type = 'info') {
    // Check if notification container exists, if not create it
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.top = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '9999';
        document.body.appendChild(notificationContainer);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show`;
    notification.role = 'alert';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
            // Remove container if empty
            if (notificationContainer.children.length === 0) {
                notificationContainer.remove();
            }
        }, 150);
    }, 5000);
}

// Fetch meals from API
async function fetchMeals(page = 1, filters = {}) {
    try {
        console.log('Starting fetchMeals', { page, filters });
        
        // Show loading state
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            console.log('No token found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }
        
        // Build query parameters
        const params = new URLSearchParams({
            page: page,
            limit: itemsPerPage,
            ...(filters.search && { search: filters.search }),
            ...(filters.restaurant && { restaurant: filters.restaurant }),
            ...(filters.status && { status: filters.status })
        });
        
        const url = `${API_BASE_URL}/meals?${params.toString()}`;
        console.log('Fetching meals from:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Error: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('API Response:', data);
        
        if (!data.data) {
            throw new Error('Invalid API response: no data field');
        }

        meals = data.data;
        totalMeals = data.total || data.data.length;
        
        // Apply client-side filtering
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            meals = meals.filter(meal => 
                (meal.name && meal.name.toLowerCase().includes(searchTerm)) ||
                (meal.description && meal.description.toLowerCase().includes(searchTerm)) ||
                (meal.restaurant?.name && meal.restaurant.name.toLowerCase().includes(searchTerm))
            );
        }
        
        if (filters.restaurantId) {
            meals = meals.filter(meal => meal.restaurantId === filters.restaurantId);
        }
        
        // Update total after filtering
        totalMeals = meals.length;
        
        // Reset to first page if current page is invalid
        const totalPages = Math.ceil(totalMeals / itemsPerPage);
        if (currentPage > totalPages && totalPages > 0) {
            currentPage = 1;
        }
        
        renderMeals();
        updatePagination();
    } catch (error) {
        console.error('Error fetching meals:', error);
        if (mealsTbody) {
            mealsTbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            ${error.message || 'Failed to load meals'}
                            <button class="btn btn-primary mt-2" onclick="fetchMeals(currentPage, getCurrentFilters())">
                                <i class="fas fa-sync-alt me-2"></i> Retry
                            </button>
                        </div>
                    </td>
                </tr>`;
        }
    }
}

// Fetch restaurants for the filter dropdown
async function fetchRestaurants() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('No token found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        const response = await fetch(`${API_BASE_URL}/restaurants`, {
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
            throw new Error(errorData.message || 'Failed to fetch restaurants');
        }

        const responseData = await response.json();
        restaurants = Array.isArray(responseData.data) ? responseData.data : [];
        
        // Clear and rebuild restaurant map
        restaurantMap.clear();
        restaurants.forEach(restaurant => {
            if (restaurant.id) {
                restaurantMap.set(restaurant.id, restaurant);
            }
        });
        
        // Update restaurant filter dropdown
        const restaurantSelects = [restaurantFilter, document.getElementById('meal-restaurant')];
        restaurantSelects.forEach(select => {
            if (select) {
                const currentValue = select.value;
                select.innerHTML = `
                    <option value="">${select.id === 'meal-restaurant' ? 'Select Restaurant' : 'All Restaurants'}</option>
                    ${restaurants.map(restaurant => 
                        `<option value="${restaurant.id}">${restaurant.restaurantName || restaurant.name || 'Unnamed Restaurant'}</option>`
                    ).join('')}
                `;
                // Restore the selected value if it still exists
                if (currentValue && restaurants.some(r => r.id === currentValue)) {
                    select.value = currentValue;
                }
            }
        });
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        showNotification(error.message || 'Failed to load restaurants', 'error');
    }
}

// Render meals in the grid
function renderMeals() {
    if (!mealsTbody) return;
    
    if (meals.length === 0) {
        mealsTbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <i class="fas fa-utensils fa-2x text-muted mb-2"></i>
                    <p class="mb-0">No meals found. Try adjusting your filters.</p>
                </td>
            </tr>`;
        return;
    }
    
    const mealRows = meals.map(meal => `
        <tr>
            <td>
                <img src="${meal.imageUrl || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2280%22%20height%3D%2260%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2060%22%20preserveAspectRatio%3D%22none%22%3E%3Crect%20width%3D%2280%22%20height%3D%2260%22%20fill%3D%22%23f0f0f0%22%2F%3E%3Ctext%20x%3D%2240%22%20y%3D%2230%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2210%22%20text-anchor%3D%22middle%22%20alignment-baseline%3D%22middle%22%20fill%3D%22%23999%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E'}" 
                     class="img-thumbnail" alt="${meal.name}" 
                     style="width: 80px; height: 60px; object-fit: cover;">
            </td>
            <td>
                <div class="fw-bold">${meal.name || 'Unnamed Meal'}</div>
                <div class="small text-muted">${meal.description ? meal.description.substring(0, 50) + '...' : ''}</div>
            </td>
            <td>${meal.restaurant?.name || 'N/A'}</td>
            <td>${meal.category || 'Uncategorized'}</td>
            <td>${formatPrice(meal.price)}</td>
            <td class="text-center">
                <span class="badge ${meal.isAvailable ? 'bg-success' : 'bg-secondary'}">
                    ${meal.isAvailable ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-1" title="View" onclick="viewMeal('${meal.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" title="Edit" onclick="editMeal('${meal.id}')">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    mealsTbody.innerHTML = mealRows;
}

// Update pagination controls
function updatePagination() {
    const totalPages = Math.ceil(totalMeals / itemsPerPage) || 1;
    
    // Update page info
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    // Update pagination buttons
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage === 1;
        prevPageBtn.classList.toggle('disabled', currentPage === 1);
    }
    
    if (nextPageBtn) {
        const nextDisabled = currentPage === totalPages || totalPages === 0;
        nextPageBtn.disabled = nextDisabled;
        nextPageBtn.classList.toggle('disabled', nextDisabled);
    }
    
    // Update showing info - removed showingInfo reference as the element doesn't exist
    // You can uncomment and use this if you add a showingInfo element to your HTML
    /*
    const startItem = totalMeals > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const endItem = Math.min(currentPage * itemsPerPage, totalMeals);
    const showingInfo = document.getElementById('showing-info');
    if (showingInfo) {
        showingInfo.textContent = totalMeals > 0 
            ? `Showing ${startItem} to ${endItem} of ${totalMeals} entries`
            : 'No entries to display';
    }
    */
}

// Get current filters
function getCurrentFilters() {
    return {
        search: searchInput.value.trim(),
        restaurant: restaurantFilter.value,
        status: statusFilter.value,
        sort: sortSelect.value,
        pageSize: parseInt(pageSizeSelect.value),
        dietaryTags: document.getElementById('dietary-tags-filter')?.value,
        excludeAllergens: document.getElementById('exclude-allergens-filter')?.value,
        minPrice: document.getElementById('min-price')?.value,
        maxPrice: document.getElementById('max-price')?.value,
        cuisineType: document.getElementById('cuisine-type-filter')?.value
    };
}

// Event Listeners
const debouncedSearch = debounce(() => {
    currentPage = 1;
    const filters = getCurrentFilters();
    fetchMeals(currentPage, filters);
}, 300);

// Search input
if (searchInput) {
    searchInput.addEventListener('input', debouncedSearch);
}

// Restaurant filter
if (restaurantFilter) {
    restaurantFilter.addEventListener('change', () => {
        currentPage = 1;
        const filters = getCurrentFilters();
        renderMeals();
        updatePagination();
    });
}

// Category filter
if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
        currentPage = 1;
        const filters = getCurrentFilters();
        renderMeals();
        updatePagination();
    });
}

// Pagination
if (prevPageBtn) {
    prevPageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            renderMeals();
            updatePagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

if (nextPageBtn) {
    nextPageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const totalPages = Math.ceil(totalMeals / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderMeals();
            updatePagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

// Modal functions
function openModal(meal = null) {
    if (meal) {
        // Edit mode
        modalTitle.textContent = 'Edit Meal';
        document.getElementById('meal-id').value = meal.id;
        document.getElementById('meal-name').value = meal.name;
        document.getElementById('meal-description').value = meal.description || '';
        document.getElementById('meal-price').value = meal.price || '';
        
        if (meal.restaurant?.id) {
            document.getElementById('meal-restaurant').value = meal.restaurant.id;
        }
        
        if (meal.category) {
            document.getElementById('meal-category').value = meal.category;
        }
        
        if (meal.imageUrl) {
            document.getElementById('meal-image').value = meal.imageUrl;
        }
    } else {
        // Add new mode
        modalTitle.textContent = 'Add New Meal';
        mealForm.reset();
    }
    
    mealModal.style.display = 'flex';
}


// Close modal function
function closeModal() {
    if (mealModal) {
        mealModal.style.display = 'none';
    }
    if (mealForm) {
        mealForm.reset();
    }
}

// Reset filters function
function resetFilters() {
    if (searchInput) searchInput.value = '';
    if (restaurantFilter) restaurantFilter.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (statusFilter) statusFilter.value = 'all';
    
    currentPage = 1;
    fetchMeals(currentPage, getCurrentFilters());
}

// Form submission
mealForm.addEventListener('submit', handleMealSubmit);

// Handle form submission
async function handleMealSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(mealForm);
    const mealData = {
        name: formData.get('meal-name'),
        description: formData.get('meal-description'),
        price: parseFloat(formData.get('meal-price')),
        category: formData.get('meal-category'),
        isAvailable: formData.get('isAvailable') === 'on',
        restaurant: formData.get('meal-restaurant'),
        // Add other form fields as needed
    };
    
    // Handle image upload if needed
    const imageFile = document.getElementById('meal-image')?.files[0];
    if (imageFile) {
        // Handle image upload logic here
    }
    
    const mealId = document.getElementById('meal-id').value;
    const isEdit = !!mealId;
    
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const url = isEdit 
            ? `${API_BASE_URL}/meals/${mealId}`
            : `${API_BASE_URL}/meals`;
            
        const response = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mealData)
        });

        if (!response.ok) {
            throw new Error(isEdit ? 'Failed to update meal' : 'Failed to create meal');
        }

        closeModal();
        fetchMeals(currentPage, getCurrentFilters());
        showNotification(`Meal ${isEdit ? 'updated' : 'created'} successfully`, 'success');
        
    } catch (error) {
        console.error(`Error ${isEdit ? 'updating' : 'creating'} meal:`, error);
        showNotification(`Failed to ${isEdit ? 'update' : 'create'} meal. Please try again.`, 'danger');
    }
}

// Initialize the page
async function init() {
    try {
        // Show loading state
        if (mealsTbody) {
            mealsTbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2 mb-0">Loading meals...</p>
                    </td>
                </tr>`;
        }

        // Check authentication
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        // Load data
        await Promise.all([
            fetchRestaurants(),
            fetchMeals()
        ]);

        // Initialize event listeners
        if (searchInput) {
            // Add event listener to both search inputs
            searchInput.addEventListener('input', debouncedSearch);
            const topSearch = document.getElementById('meal-search');
            if (topSearch) {
                topSearch.addEventListener('input', (e) => {
                    searchInput.value = e.target.value;
                    debouncedSearch();
                });
            }
        }
        
        // Add change listeners to filter controls
        [restaurantFilter, categoryFilter, statusFilter].forEach(filter => {
            if (filter) {
                filter.addEventListener('change', () => {
                    currentPage = 1;
                    fetchMeals(currentPage, getCurrentFilters());
                });
            }
        });

        // Pagination event listeners
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (currentPage > 1) {
                    currentPage--;
                    fetchMeals(currentPage, getCurrentFilters());
                }
            });
        }

        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const totalPages = Math.ceil(totalMeals / itemsPerPage);
                if (currentPage < totalPages) {
                    currentPage++;
                    fetchMeals(currentPage, getCurrentFilters());
                }
            });
        }
        
        // Initialize modal
        if (addMealBtn) {
            addMealBtn.addEventListener('click', () => {
                openModal();
            });
        }

        // Close modal when clicking outside
        if (mealModal) {
            mealModal.addEventListener('click', (e) => {
                if (e.target === mealModal) closeModal();
            });
        }
        
        // Close modal button
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModal);
        }

        // Form submission
        if (mealForm) {
            mealForm.addEventListener('submit', handleMealSubmit);
        }
        
        // Initialize advanced search
        if (typeof initAdvancedSearch === 'function') {
            initAdvancedSearch();
        }
        
        // Add reset filters button event listener
        const resetFiltersBtn = document.getElementById('reset-filters');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', resetFilters);
        }
    } catch (error) {
        console.error('Error initializing page:', error);
        if (mealsContainer) {
            mealsContainer.innerHTML = `
                <div class="alert alert-danger">
                    <h4>Error Loading Page</h4>
                    <p>${error.message || 'An error occurred while loading the page.'}</p>
                    <button onclick="window.location.reload()" class="btn btn-primary mt-2">Reload Page</button>
                </div>`;
        }
        throw error; // Re-throw to be caught by the global error handler
    }
}

// View meal details
window.viewMeal = async function(mealId) {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        // Show loading state
        const modalBody = document.getElementById('meal-details-body');
        modalBody.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading meal details...</p>
            </div>`;

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('meal-details-modal'));
        modal.show();

        // Fetch meal details
        const response = await fetch(`${API_BASE_URL}/meals/${mealId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch meal details');
        }

        const data = await response.json();
        const meal = data.data || data;

        // Format the details HTML
        const detailsHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h4>${meal.name || 'N/A'}</h4>
                    <p class="text-muted">${meal.description || 'No description available'}</p>
                    
                    <div class="mb-3">
                        <h6>Nutritional Information</h6>
                        <ul class="list-unstyled">
                            <li><strong>Calories:</strong> ${meal.nutritionalInfo?.calories || 'N/A'}</li>
                            <li><strong>Protein:</strong> ${meal.nutritionalInfo?.protein ? `${meal.nutritionalInfo.protein}g` : 'N/A'}</li>
                            <li><strong>Carbs:</strong> ${meal.nutritionalInfo?.carbs ? `${meal.nutritionalInfo.carbs}g` : 'N/A'}</li>
                            <li><strong>Fat:</strong> ${meal.nutritionalInfo?.fat ? `${meal.nutritionalInfo.fat}g` : 'N/A'}</li>
                        </ul>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <h6>Dietary Information</h6>
                        <div class="d-flex flex-wrap gap-1">
                            ${(meal.dietaryTags && meal.dietaryTags.length > 0) 
                                ? meal.dietaryTags.map(tag => 
                                    `<span class="badge bg-info text-dark">${tag}</span>`).join(' ') 
                                : '<span class="text-muted">No dietary tags</span>'}
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <h6>Allergens</h6>
                        <div class="d-flex flex-wrap gap-1">
                            ${(meal.allergens && meal.allergens.length > 0) 
                                ? meal.allergens.map(allergen => 
                                    `<span class="badge bg-warning text-dark">${allergen}</span>`).join(' ')
                                : '<span class="text-muted">No allergens listed</span>'}
                        </div>
                    </div>
                    
                    <div class="mt-4">
                        <p class="mb-1"><small class="text-muted">Created: ${new Date(meal.createdAt).toLocaleDateString()}</small></p>
                        <p class="mb-0"><small class="text-muted">Last updated: ${new Date(meal.updatedAt).toLocaleDateString()}</small></p>
                    </div>
                </div>
            </div>`;

        // Update modal content
        document.getElementById('meal-details-title').textContent = meal.name || 'Meal Details';
        modalBody.innerHTML = detailsHTML;

    } catch (error) {
        console.error('Error fetching meal details:', error);
        const modalBody = document.getElementById('meal-details-body');
        modalBody.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Failed to load meal details: ${error.message}
            </div>`;
    }
};

// Initialize the page when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);