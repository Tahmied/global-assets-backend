
fetch('/api/v1/users/logincheck', { credentials: 'include' })
  .then(response => {
    if (response.status === 401) {
      window.location.href = './login.html';
    }
  })
  .catch(error => {
    console.error('Login check failed:', error);
  });

