(function () {
  'use strict';

  const form = document.getElementById('register-form');
  const status = document.getElementById('register-status');

  async function getCsrfToken() {
    const response = await fetch('/api/csrf-token');
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Kunde inte starta registreringen');
    return body.token;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = 'Skapar konto...';
    status.className = 'status-msg';

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          username: document.getElementById('username').value.trim(),
          password: document.getElementById('password').value,
          inviteCode: document.getElementById('invite-code').value,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Registreringen misslyckades');
      window.location.href = '/index.html';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Registreringen misslyckades';
      status.className = 'status-msg error';
    }
  });
})();
