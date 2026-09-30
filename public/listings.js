(function () {
  'use strict';

  const api = window.__appApi;
  const container = document.getElementById('listing-drafts');
  const status = document.getElementById('listings-status');
  const logoutButton = document.getElementById('logout-btn');

  function setStatus(message, type) {
    window.__ui.setStatus(status, message, type);
  }

  function createField(labelText, control) {
    const label = document.createElement('label');
    label.className = 'form-field';
    label.append(document.createTextNode(labelText), control);
    return label;
  }

  function renderDraft(draft) {
    const card = document.createElement('form');
    card.className = 'listing-draft card';
    card.dataset.draftId = String(draft.id);

    const image = document.createElement('img');
    image.src = '/uploads/' + draft.filename;
    image.alt = draft.original_name;
    image.loading = 'lazy';

    const title = document.createElement('input');
    title.type = 'text';
    title.maxLength = 120;
    title.required = true;
    title.value = draft.title;

    const description = document.createElement('textarea');
    description.maxLength = 4000;
    description.rows = 5;
    description.value = draft.description;

    const price = document.createElement('input');
    price.type = 'number';
    price.min = '1';
    price.max = '1000000';
    price.step = '1';
    price.required = true;
    price.value = draft.price === null ? '' : String(draft.price);

    const marketplace = document.createElement('select');
    [
      ['blocket', 'Blocket'],
      ['tradera', 'Tradera'],
      ['other', 'Annan marknadsplats'],
    ].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      marketplace.appendChild(option);
    });
    marketplace.value = draft.marketplace;

    const submit = document.createElement('button');
    submit.className = 'btn btn-upload';
    submit.type = 'submit';
    submit.textContent = 'Spara utkast';

    const feedback = document.createElement('p');
    feedback.className = 'status-msg';

    card.append(
      image,
      createField('Rubrik', title),
      createField('Beskrivning', description),
      createField('Pris i kronor', price),
      createField('Avsedd marknadsplats', marketplace),
      submit,
      feedback
    );
    card.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      window.__ui.setStatus(feedback, 'Sparar utkast...');
      try {
        await api.patch('/items/listings/' + draft.id, {
          title: title.value,
          description: description.value,
          price: Number(price.value),
          marketplace: marketplace.value,
        });
        window.__ui.setStatus(feedback, 'Utkastet är sparat. Publicera det manuellt på marknadsplatsen.', 'success');
      } catch (error) {
        window.__ui.setStatus(feedback, String(error), 'error');
      } finally {
        submit.disabled = false;
      }
    });
    return card;
  }

  async function loadDrafts() {
    try {
      const session = await api.get('/session');
      const uploadLink = document.querySelector('nav a[href="upload.html"]');
      if (uploadLink) uploadLink.classList.toggle('hidden', !session.is_administrator);
      const drafts = await api.get('/items/listings');
      container.replaceChildren();
      if (drafts.length === 0) {
        setStatus('Inga annonsutkast ännu.');
        return;
      }
      drafts.forEach((draft) => container.appendChild(renderDraft(draft)));
      const requestedDraftId = new URLSearchParams(window.location.search).get('draft');
      const requestedDraft = requestedDraftId
        ? container.querySelector(`[data-draft-id="${CSS.escape(requestedDraftId)}"]`)
        : null;
      if (requestedDraft) {
        requestedDraft.scrollIntoView({ behavior: 'smooth', block: 'start' });
        requestedDraft.querySelector('input').focus();
      }
      setStatus('');
    } catch (error) {
      setStatus(String(error), 'error');
    }
  }

  logoutButton.addEventListener('click', async () => {
    try {
      await api.post('/logout', {});
      window.location.href = '/login.html';
    } catch (error) {
      setStatus(String(error), 'error');
    }
  });

  loadDrafts();
})();
