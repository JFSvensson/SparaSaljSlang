(function () {
  'use strict';

  const form = document.getElementById('login-form');
  const status = document.getElementById('login-status');

  async function getCsrfToken() {
    const response = await fetch('/api/csrf-token');
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || 'Kunde inte starta inloggning');
    }
    return body.token;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    status.textContent = 'Loggar in...';
    status.className = 'status-msg';

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ username, password }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Inloggning misslyckades');

      window.location.href = '/index.html';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Inloggning misslyckades';
      status.className = 'status-msg error';
    }
  });
})();
