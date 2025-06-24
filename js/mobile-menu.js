// Mobile menu functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const body = document.body;
    
    // If no elements found, exit
    if (!menuToggle || !sidebar) return;
    
    // Create backdrop if it doesn't exist
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        document.body.insertBefore(backdrop, document.body.firstChild);
    }
    
    // Toggle menu function
    function toggleMenu(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        const isOpen = sidebar.classList.contains('active');
        
        if (isOpen) {
            // Close menu
            sidebar.classList.remove('active');
            backdrop.classList.remove('active');
            body.classList.remove('menu-open');
            
            // Enable body scroll after transition
            setTimeout(() => {
                backdrop.style.display = 'none';
                // Reset body position
                body.style.position = '';
                body.style.width = '';
            }, 300);
        } else {
            // Open menu
            backdrop.style.display = 'block';
            // Force reflow
            void backdrop.offsetWidth;
            backdrop.classList.add('active');
            sidebar.classList.add('active');
            body.classList.add('menu-open');
        }
        
        return false;
    }
    
    // Close menu function
    function closeMenu() {
        if (sidebar.classList.contains('active')) {
            toggleMenu();
        }
    }
    
    // Event listeners
    menuToggle.addEventListener('click', toggleMenu);
    
    // Close when clicking on backdrop
    backdrop.addEventListener('click', closeMenu);
    
    // Close when clicking on navigation links (only on mobile)
    const navLinks = sidebar.querySelectorAll('a:not(#logout)'); // Exclude logout link
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if (window.innerWidth < 992) {
                closeMenu();
            }
        });
    });
    
    // Close menu when window is resized to desktop
    function handleResize() {
        if (window.innerWidth >= 992) {
            closeMenu();
        } else {
            // Reset menu state on mobile
            if (sidebar.classList.contains('active')) {
                body.classList.add('menu-open');
            } else {
                body.classList.remove('menu-open');
            }
        }
    }
    
    // Handle escape key
    function handleKeyDown(e) {
        if (e.key === 'Escape' && window.innerWidth < 992) {
            closeMenu();
        }
    }
    
    // Add event listeners
    window.addEventListener('resize', handleResize, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    
    // Handle page visibility changes
    function handleVisibilityChange() {
        if (document.hidden) {
            closeMenu();
        }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up function
    function cleanup() {
        menuToggle.removeEventListener('click', toggleMenu);
        backdrop.removeEventListener('click', closeMenu);
        navLinks.forEach(link => {
            link.removeEventListener('click', closeMenu);
        });
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    
    // Clean up on page unload
    window.addEventListener('beforeunload', cleanup);
    
    // Initialize menu as closed
    backdrop.style.display = 'none';
    
    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
        if (window.innerWidth < 992 && 
            !sidebar.contains(event.target) && 
            !menuToggle.contains(event.target) &&
            sidebar.classList.contains('active')) {
            closeMenu();
        }
    });
});
