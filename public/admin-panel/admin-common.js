document.addEventListener('DOMContentLoaded', function() {
    // Make entire nav items clickable
    document.querySelectorAll('.nav-item').forEach(navItem => {
        navItem.style.cursor = 'pointer';
        
        navItem.addEventListener('click', function(e) {
            // Prevent double navigation if clicking directly on the link
            if (!e.target.closest('a')) {
                const link = this.querySelector('a');
                if (link) {
                    window.location.href = link.href;
                }
            }
        });
    });

    // Keep your existing active state functionality
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Mobile menu toggle (keep existing if not already handled)
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
});