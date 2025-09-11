document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const toggle = document.querySelector('.mobile-menu-toggle');
    const mobileNav = document.querySelector('.mobile-nav');

    if (toggle && mobileNav) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileNav.classList.toggle('active');
            document.body.classList.toggle('no-scroll');
        });

        document.addEventListener('click', (e) => {
            if (!mobileNav.contains(e.target) && !toggle.contains(e.target)) {
                mobileNav.classList.remove('active');
                document.body.classList.remove('no-scroll');
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                mobileNav.classList.remove('active');
                document.body.classList.remove('no-scroll');
            }
        });
    }

    // Check login status and handle auth buttons
    fetch("/api/v1/users/logincheck", { credentials: "include" })
        .then((response) => {
            if (response.status === 200) {
                // User is logged in
                document.querySelectorAll(".sign-in-btn").forEach((btn) => btn.remove());

                document.querySelectorAll(".sign-up-btn").forEach((btn) => {
                    btn.textContent = "Log Out";
                    // Remove previous listeners by replacing the node
                    const newBtn = btn.cloneNode(true);
                    btn.parentNode.replaceChild(newBtn, btn);

                    newBtn.addEventListener("click", () => {
                        fetch("/api/v1/users/logout", {
                            method: "POST",
                            credentials: "include",
                            headers: {
                                "Content-Type": "application/json",
                            },
                        })
                            .then((res) => res.json())
                            .then((data) => {
                                if (data.success) {
                                    location.reload();
                                } else {
                                    alert("Logout failed: " + (data.message || "Unknown error"));
                                }
                            })
                            .catch((error) => {
                                console.error("Logout failed:", error);
                                alert("Logout failed: " + error.message);
                            });
                    });
                });
            } else {
                // User not logged in
                bindAuthButtonLinks();
            }
        })
        .catch((error) => {
            console.error("Login check failed:", error);
            // On failure, treat as not logged in
            bindAuthButtonLinks();
        });

    function bindAuthButtonLinks() {
        document.querySelectorAll('.sign-in-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.href = './login.html';
            });
        });

        document.querySelectorAll('.sign-up-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.href = './registration.html';
            });
        });
    }

    // Loan history navigation
    const loanHistoryBtn = document.querySelector('#loan-history');
    if (loanHistoryBtn) {
        loanHistoryBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = './loan-history.html';
        });
    }
});


window.PRIMARY_CHAT_ADMIN_ID = '68083fb5d70405e5870c6594'; 