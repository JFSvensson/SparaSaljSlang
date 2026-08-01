// SparaSäljSlang — List page logic
// Displays all uploaded items with their vote tallies.

(function () {
  'use strict';

  const api = window.__appApi;
  const ui = window.__ui;
  const components = window.__components;
  const itemsGrid = document.getElementById('items-grid');
  const listStatus = document.getElementById('list-status');
  const nameFilter = /** @type {HTMLInputElement} */ (document.getElementById('filter-name'));
  const dateFilter = /** @type {HTMLSelectElement} */ (document.getElementById('filter-date'));
  const sortSelect = /** @type {HTMLSelectElement} */ (document.getElementById('sort-select'));
  const sortDirectionButton = document.getElementById('sort-direction');
  const bulkDeleteOpen = document.getElementById('bulk-delete-open');

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

  const bulkDeleteModal = document.getElementById('bulk-delete-modal');
  const bulkDeleteClose = document.getElementById('bulk-delete-close');
  const bulkDeleteBackdrop = bulkDeleteModal ? bulkDeleteModal.querySelector('.modal-backdrop') : null;
  const bulkDeleteCancel = document.getElementById('bulk-delete-cancel');
  const bulkDeleteConfirm = document.getElementById('bulk-delete-confirm');
  const bulkDeleteMessage = document.getElementById('bulk-delete-message');
  const bulkDeleteStatus = document.getElementById('bulk-delete-status');

  let currentItemId = -1;
  let modalController = null;
  let bulkDeleteController = null;
  let items = [];
  let sortField = 'save_count';
  let sortDirection = 'descending';
  let searchTerm = '';
  let daysSinceUpload = 0;
  const selectedItemIds = new Set();

  // ── Helpers ──────────────────────────────────────────────────────

  function setStatus(msg, type) {
    ui.setStatus(listStatus, msg, type);
  }

  function setBulkDeleteStatus(msg, type) {
    ui.setStatus(bulkDeleteStatus, msg, type);
  }

  function updateBulkDeleteButton() {
    if (!bulkDeleteOpen) return;
    const count = selectedItemIds.size;
    bulkDeleteOpen.textContent = `Ta bort valda (${count})`;
    if (count === 0) {
      bulkDeleteOpen.setAttribute('disabled', 'true');
    } else {
      bulkDeleteOpen.removeAttribute('disabled');
    }
  }

  function updateSortDirectionButton() {
    if (!sortDirectionButton) return;
    const isDescending = sortDirection === 'descending';
    sortDirectionButton.textContent = isDescending ? '↓' : '↑';
    sortDirectionButton.setAttribute(
      'aria-label',
      isDescending ? 'Sortera fallande' : 'Sortera stigande'
    );
    sortDirectionButton.setAttribute(
      'title',
      isDescending ? 'Sortera fallande' : 'Sortera stigande'
    );
  }

  function getVisibleItems() {
    const cutoff = daysSinceUpload
      ? Date.now() - daysSinceUpload * 24 * 60 * 60 * 1000
      : 0;
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase('sv-SE');
    const multiplier = sortDirection === 'descending' ? -1 : 1;
    return items
      .filter((item) => {
        const matchesName = item.original_name
          .toLocaleLowerCase('sv-SE')
          .includes(normalizedSearchTerm);
        const uploadedAt = new Date(item.created_at.replace(' ', 'T')).getTime();
        const matchesDate = !cutoff || uploadedAt >= cutoff;
        return matchesName && matchesDate;
      })
      .sort((first, second) => {
      const difference = (first[sortField] - second[sortField]) * multiplier;
      return difference || second.id - first.id;
    });
  }

  function renderVisibleItems() {
    buildGrid(getVisibleItems());
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

  if (bulkDeleteModal) {
    bulkDeleteController = components.createModal(bulkDeleteModal, bulkDeleteClose, bulkDeleteBackdrop);
  }

  if (bulkDeleteCancel) {
    bulkDeleteCancel.addEventListener('click', () => bulkDeleteController?.close());
  }

  if (bulkDeleteOpen) {
    bulkDeleteOpen.addEventListener('click', () => {
      const count = selectedItemIds.size;
      if (count === 0) return;
      if (bulkDeleteMessage) {
        bulkDeleteMessage.textContent = `Du håller på att ta bort ${count} föremål. Detta går inte att ångra.`;
      }
      setBulkDeleteStatus('');
      bulkDeleteController?.open();
    });
  }

  if (bulkDeleteConfirm) {
    bulkDeleteConfirm.addEventListener('click', async () => {
      const ids = [...selectedItemIds];
      if (ids.length === 0) {
        bulkDeleteController?.close();
        return;
      }

      bulkDeleteConfirm.setAttribute('disabled', 'true');
      setBulkDeleteStatus('Tar bort valda föremål...');
      try {
        const result = await api.post('/items/bulk-delete', { ids });
        const missingCount = result.missing_ids.length;
        const deletedCount = result.deleted_ids.length;
        bulkDeleteController?.close();
        setStatus(
          missingCount
            ? `Tog bort ${deletedCount} föremål. ${missingCount} fanns inte längre.`
            : `Tog bort ${deletedCount} föremål.`,
          'success'
        );
        selectedItemIds.clear();
        loadItems();
      } catch (err) {
        setBulkDeleteStatus(String(err), 'error');
      } finally {
        bulkDeleteConfirm.removeAttribute('disabled');
      }
    });
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

  function buildGrid(visibleItems) {
    if (!itemsGrid) return;
    itemsGrid.innerHTML = '';

    if (visibleItems.length === 0) {
      setStatus(
        items.length === 0
          ? 'Inga föremål ännu. Ladda upp det första på startsidan!'
          : 'Inga föremål matchar ditt filter.'
      );
      return;
    }

    setStatus('');
    visibleItems.forEach((item) => {
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

      const selectorWrap = document.createElement('label');
      selectorWrap.className = 'item-card-select';
      const selector = document.createElement('input');
      selector.type = 'checkbox';
      selector.checked = selectedItemIds.has(item.id);
      selector.setAttribute('aria-label', `Markera ${item.original_name}`);
      selector.addEventListener('click', (event) => event.stopPropagation());
      selector.addEventListener('keydown', (event) => event.stopPropagation());
      selector.addEventListener('change', () => {
        if (selector.checked) {
          selectedItemIds.add(item.id);
        } else {
          selectedItemIds.delete(item.id);
        }
        updateBulkDeleteButton();
      });
      const selectorText = document.createElement('span');
      selectorText.textContent = 'Markera';
      selectorWrap.append(selector, selectorText);

      const verdictEl = document.createElement('p');
      verdictEl.className = 'item-card-verdict ' + v.cls;
      verdictEl.textContent = v.text;

      body.append(name, selectorWrap, verdictEl);
      card.append(img, body);

      card.addEventListener('click', () => openModal(item));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') openModal(item);
      });

      itemsGrid.appendChild(card);
    });

    updateBulkDeleteButton();
  }

  // ── Load items ────────────────────────────────────────────────────

  async function loadItems() {
    setStatus('Hämtar föremål…');
    try {
      items = await api.get('/items');
      renderVisibleItems();
    } catch (err) {
      setStatus(String(err), 'error');
    }
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      sortField = sortSelect.value;
      renderVisibleItems();
    });
  }

  if (sortDirectionButton) {
    sortDirectionButton.addEventListener('click', () => {
      sortDirection = sortDirection === 'descending' ? 'ascending' : 'descending';
      updateSortDirectionButton();
      renderVisibleItems();
    });
  }

  if (nameFilter) {
    nameFilter.addEventListener('input', () => {
      searchTerm = nameFilter.value;
      renderVisibleItems();
    });
  }

  if (dateFilter) {
    dateFilter.addEventListener('change', () => {
      daysSinceUpload = Number(dateFilter.value);
      renderVisibleItems();
    });
  }

  // ── Init ──────────────────────────────────────────────────────────
  updateSortDirectionButton();
  updateBulkDeleteButton();
  loadItems();
})();
