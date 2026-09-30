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

    const condition = document.createElement('select');
    [
      ['', 'Välj skick'],
      ['new', 'Ny'],
      ['very_good', 'Mycket gott skick'],
      ['good', 'Gott skick'],
      ['used', 'Använt skick'],
      ['needs_repair', 'Renoverings-/reparationsbehov'],
    ].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      condition.appendChild(option);
    });
    condition.value = draft.condition;
    condition.required = true;

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

    const otherMarketplace = document.createElement('input');
    otherMarketplace.type = 'text';
    otherMarketplace.maxLength = 80;
    otherMarketplace.value = draft.marketplace_name;
    otherMarketplace.placeholder = 'Ange marknadsplatsens namn';
    otherMarketplace.required = marketplace.value === 'other';
    otherMarketplace.classList.toggle('hidden', !otherMarketplace.required);
    marketplace.addEventListener('change', () => {
      otherMarketplace.required = marketplace.value === 'other';
      otherMarketplace.classList.toggle('hidden', !otherMarketplace.required);
    });

    const completeness = document.createElement('p');
    completeness.className = 'listing-completeness';
    completeness.setAttribute('aria-live', 'polite');
    const updateCompleteness = (isComplete) => {
      completeness.classList.toggle('is-complete', isComplete);
      completeness.classList.toggle('is-incomplete', !isComplete);
      completeness.textContent = isComplete
        ? 'Utkastet är komplett och klart att kopiera för manuell publicering.'
        : 'Utkastet är ofullständigt. Fyll i rubrik, beskrivning, pris, skick och marknadsplats.';
    };
    updateCompleteness(draft.is_complete);

    const submit = document.createElement('button');
    submit.className = 'btn btn-upload';
    submit.type = 'submit';
    submit.textContent = 'Spara utkast';

    const copyButton = document.createElement('button');
    copyButton.className = 'btn';
    copyButton.type = 'button';
    copyButton.textContent = 'Kopiera annonstext';
    copyButton.disabled = !draft.is_complete;

    const feedback = document.createElement('p');
    feedback.className = 'status-msg';

    card.append(
      image,
      createField('Rubrik', title),
      createField('Beskrivning', description),
      createField('Skick', condition),
      createField('Pris i kronor', price),
      createField('Avsedd marknadsplats', marketplace),
      createField('Annan marknadsplats', otherMarketplace),
      completeness,
      submit,
      copyButton,
      feedback
    );
    copyButton.addEventListener('click', async () => {
      const marketplaceLabel = marketplace.value === 'other'
        ? otherMarketplace.value.trim()
        : marketplace.options[marketplace.selectedIndex].textContent;
      const listingText = [
        title.value.trim(),
        `Pris: ${Number(price.value)} kr`,
        `Skick: ${condition.options[condition.selectedIndex].textContent}`,
        `Marknadsplats: ${marketplaceLabel}`,
        '',
        description.value.trim(),
      ].join('\n');
      try {
        await navigator.clipboard.writeText(listingText);
        window.__ui.setStatus(feedback, 'Annonstexten kopierades.', 'success');
      } catch (error) {
        window.__ui.setStatus(feedback, `Kunde inte kopiera automatiskt: ${String(error)}.`, 'error');
      }
    });
    card.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      window.__ui.setStatus(feedback, 'Sparar utkast...');
      try {
        const savedDraft = await api.patch('/items/listings/' + draft.id, {
          title: title.value,
          description: description.value,
          price: Number(price.value),
          condition: condition.value,
          marketplace: marketplace.value,
          marketplaceName: otherMarketplace.value,
        });
        updateCompleteness(savedDraft.is_complete);
        copyButton.disabled = !savedDraft.is_complete;
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
      document.querySelectorAll('.admin-only').forEach((link) => {
        link.classList.toggle('hidden', !session.is_administrator);
      });
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
