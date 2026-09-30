(function () {
  'use strict';

  const api = window.__appApi;
  const components = window.__components;
  const votersList = document.getElementById('voters-list');
  const votersStatus = document.getElementById('voters-status');
  const registrationState = document.getElementById('registration-state');
  const rotateButton = document.getElementById('rotate-invite');
  const disableButton = document.getElementById('disable-registration');
  const inviteInput = document.getElementById('new-invite-code');
  const inviteWrap = document.getElementById('new-invite-wrap');
  const copyButton = document.getElementById('copy-invite');
  const inviteStatus = document.getElementById('invite-status');
  const revokeModal = document.getElementById('revoke-modal');
  const revokeMessage = document.getElementById('revoke-message');
  const revokeStatus = document.getElementById('revoke-status');
  const revokeConfirm = document.getElementById('revoke-confirm');
  const revokeController = components.createModal(
    revokeModal,
    document.getElementById('revoke-close'),
    revokeModal.querySelector('.modal-backdrop')
  );

  let selectedVoter = null;

  function setStatus(element, message, type) {
    window.__ui.setStatus(element, message, type);
  }

  function renderVoters(voters) {
    votersList.replaceChildren();
    if (voters.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'login-help';
      empty.textContent = 'Inga väljarkonton har registrerats.';
      votersList.appendChild(empty);
      return;
    }

    voters.forEach((voter) => {
      const row = document.createElement('div');
      row.className = 'voter-row';
      const details = document.createElement('div');
      const username = document.createElement('strong');
      username.textContent = voter.username;
      const created = document.createElement('p');
      created.className = 'login-help';
      created.textContent = `Skapades ${new Date(voter.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('sv-SE')}`;
      details.append(username, created);

      const revokeButton = document.createElement('button');
      revokeButton.className = 'btn btn-throw';
      revokeButton.type = 'button';
      revokeButton.textContent = 'Återkalla';
      revokeButton.addEventListener('click', () => {
        selectedVoter = voter;
        revokeMessage.textContent = `Kontot ${voter.username} förlorar åtkomst direkt. Tidigare röster och beslut ändras inte.`;
        setStatus(revokeStatus, '');
        revokeController.open();
      });
      row.append(details, revokeButton);
      votersList.appendChild(row);
    });
  }

  async function loadSettings() {
    const [voters, authOptions] = await Promise.all([
      api.get('/admin/voters'),
      fetch('/api/auth-options').then(async (response) => {
        if (!response.ok) throw new Error('Kunde inte läsa registreringsinställningar.');
        return response.json();
      }),
    ]);
    renderVoters(voters);
    registrationState.textContent = authOptions.registration_enabled
      ? 'Registrering är aktiv. Enbart den senast utfärdade koden fungerar.'
      : 'Registrering är avstängd. Tidigare inbjudningskoder fungerar inte längre.';
    disableButton.disabled = !authOptions.registration_enabled;
  }

  rotateButton.addEventListener('click', async () => {
    if (!confirm('Skapa en ny inbjudningskod? Den gamla koden slutar fungera direkt.')) return;
    rotateButton.disabled = true;
    setStatus(inviteStatus, 'Skapar ny kod...');
    try {
      const result = await api.post('/admin/registration-invite/rotate', {});
      inviteInput.value = result.invite_code;
      inviteWrap.classList.remove('hidden');
      copyButton.classList.remove('hidden');
      setStatus(inviteStatus, 'Ny kod skapad. Kopiera den nu – den visas inte igen.', 'success');
      await loadSettings();
    } catch (error) {
      setStatus(inviteStatus, String(error), 'error');
    } finally {
      rotateButton.disabled = false;
    }
  });

  disableButton.addEventListener('click', async () => {
    if (!confirm('Stänga av registrering? Den aktuella koden slutar fungera direkt.')) return;
    disableButton.disabled = true;
    setStatus(inviteStatus, 'Stänger av registrering...');
    try {
      await api.post('/admin/registration-invite/disable', {});
      inviteInput.value = '';
      inviteWrap.classList.add('hidden');
      copyButton.classList.add('hidden');
      setStatus(inviteStatus, 'Registrering avstängd. Du kan aktivera den igen genom att skapa en ny kod.', 'success');
      await loadSettings();
    } catch (error) {
      setStatus(inviteStatus, String(error), 'error');
    } finally {
      disableButton.disabled = false;
    }
  });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(inviteInput.value);
      setStatus(inviteStatus, 'Koden kopierades.', 'success');
    } catch (error) {
      setStatus(inviteStatus, `Kunde inte kopiera automatiskt: ${String(error)}. Markera och kopiera koden manuellt.`, 'error');
    }
  });

  document.getElementById('revoke-cancel').addEventListener('click', () => revokeController.close());

  revokeConfirm.addEventListener('click', async () => {
    if (!selectedVoter) return;
    revokeConfirm.disabled = true;
    setStatus(revokeStatus, 'Återkallar konto...');
    try {
      await api.delete('/admin/voters/' + encodeURIComponent(selectedVoter.id));
      revokeController.close();
      setStatus(votersStatus, `Kontot ${selectedVoter.username} återkallades.`, 'success');
      selectedVoter = null;
      await loadSettings();
    } catch (error) {
      setStatus(revokeStatus, String(error), 'error');
    } finally {
      revokeConfirm.disabled = false;
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await api.post('/logout', {});
      window.location.href = '/login.html';
    } catch (error) {
      setStatus(votersStatus, String(error), 'error');
    }
  });

  api.get('/session')
    .then((session) => {
      if (!session.is_administrator) {
        window.location.replace('/index.html');
        return;
      }
      loadSettings().catch((error) => {
        setStatus(votersStatus, String(error), 'error');
      });
    })
    .catch((error) => {
      setStatus(votersStatus, String(error), 'error');
    });
})();
