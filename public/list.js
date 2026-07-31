// SparaSäljSlang — List page logic
// Displays all uploaded items with their vote tallies.

(function () {
  'use strict';

  const api = window.__appApi;
  const ui = window.__ui;
  const components = window.__components;
  const itemsGrid = document.getElementById('items-grid');
  const listStatus = document.getElementById('list-status');

  const modal = document.getElementById('modal');
  const modalClose = document.getElementById('modal-close');
  const modalBackdrop = modal ? modal.querySelector('.modal-backdrop') : null;
  const modalImage = /** @type {HTMLImageElement} */ (document.getElementById('modal-image'));
  const modalName = document.getElementById('modal-name');
  const modalVerdict = document.getElementById('modal-verdict');
  const modalDelete = document.getElementById('modal-delete');
  const modalBarSave = document.getElementById('modal-bar-save');
  const modalBarSell = document.getElementById('modal-bar-sell');
  const modalBarThrow = document.getElementById('modal-bar-throw');
  const modalCountSave = document.getElementById('modal-count-save');
  const modalCountSell = document.getElementById('modal-count-sell');
  const modalCountThrow = document.getElementById('modal-count-throw');

  let currentItemId = -1;
  let modalController = null;

  // ── Helpers ──────────────────────────────────────────────────────

  function setStatus(msg, type) {
    ui.setStatus(listStatus, msg, type);
  }

  function verdict(save, sell, throwCount) {
    const max = Math.max(save, sell, throwCount);
    if (max === 0) return { text: 'Inga röster ännu', cls: 'verdict-tie' };
    const leaders = [save, sell, throwCount].filter((v) => v === max).length;
    if (leaders > 1) return { text: 'Oavgjort', cls: 'verdict-tie' };
    if (save === max) return { text: '💚 Spara!', cls: 'verdict-save' };
    if (sell === max) return { text: '💰 Sälj!', cls: 'verdict-sell' };
    return { text: '🗑️ Släng!', cls: 'verdict-throw' };
  }

  function updateModalBars(save, sell, throwCount) {
    const total = save + sell + throwCount || 1;
    if (modalBarSave) modalBarSave.style.width = (save / total * 100) + '%';
    if (modalBarSell) modalBarSell.style.width = (sell / total * 100) + '%';
    if (modalBarThrow) modalBarThrow.style.width = (throwCount / total * 100) + '%';
    if (modalCountSave) modalCountSave.textContent = String(save);
    if (modalCountSell) modalCountSell.textContent = String(sell);
    if (modalCountThrow) modalCountThrow.textContent = String(throwCount);

    const v = verdict(save, sell, throwCount);
    if (modalVerdict) {
      modalVerdict.textContent = v.text;
      modalVerdict.className = 'modal-verdict ' + v.cls;
    }
  }

  function openModal(item) {
    currentItemId = item.id;
    if (modalImage) {
      modalImage.src = '/uploads/' + item.filename;
      modalImage.alt = item.original_name;
    }
    if (modalName) modalName.textContent = item.original_name;
    updateModalBars(item.save_count, item.sell_count, item.throw_count);
    modalController?.open();
  }

  function closeModal() {
    modalController?.close();
    currentItemId = -1;
  }

  if (modal) {
    modalController = components.createModal(modal, modalClose, modalBackdrop);
  }

  // ── Delete ────────────────────────────────────────────────────────

  if (modalDelete) {
    modalDelete.addEventListener('click', async () => {
      if (currentItemId === -1) return;
      if (!confirm('Vill du verkligen ta bort detta föremål?')) return;
      try {
        await api.delete('/items/' + currentItemId);
        closeModal();
        loadItems();
      } catch (err) {
        setStatus(String(err), 'error');
      }
    });
  }

  // ── Build grid ────────────────────────────────────────────────────

  function buildGrid(items) {
    if (!itemsGrid) return;
    itemsGrid.innerHTML = '';

    if (items.length === 0) {
      setStatus('Inga föremål ännu. Ladda upp det första på startsidan!');
      return;
    }

    setStatus('');
    items.forEach((item) => {
      const v = verdict(item.save_count, item.sell_count, item.throw_count);

      const card = document.createElement('div');
      card.className = 'item-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', item.original_name);

      const img = document.createElement('img');
      img.src = '/uploads/' + item.filename;
      img.alt = item.original_name;
      img.loading = 'lazy';

      const body = document.createElement('div');
      body.className = 'item-card-body';

      const name = document.createElement('p');
      name.className = 'item-card-name';
      name.textContent = item.original_name;

      const verdictEl = document.createElement('p');
      verdictEl.className = 'item-card-verdict ' + v.cls;
      verdictEl.textContent = v.text;

      body.append(name, verdictEl);
      card.append(img, body);

      card.addEventListener('click', () => openModal(item));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') openModal(item);
      });

      itemsGrid.appendChild(card);
    });
  }

  // ── Load items ────────────────────────────────────────────────────

  async function loadItems() {
    setStatus('Hämtar föremål…');
    try {
      const items = await api.get('/items');
      buildGrid(items);
    } catch (err) {
      setStatus(String(err), 'error');
    }
  }

  // ── Init ──────────────────────────────────────────────────────────
  loadItems();
})();
