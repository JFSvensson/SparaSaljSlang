// SparaSäljSlang — Main page logic
// Handles upload and vote/choice for a single item at a time.

(function () {
  'use strict';

  const api = window.__appApi;
  const ui = window.__ui;
  const components = window.__components;
  const uploadForm = /** @type {HTMLFormElement} */ (document.getElementById('upload-form'));
  const imageInput = /** @type {HTMLInputElement} */ (document.getElementById('image-input'));
  const fileLabelText = document.getElementById('file-label-text');
  const uploadStatus = document.getElementById('upload-status');
  const viewerSection = document.getElementById('viewer-section');
  const emptySection = document.getElementById('empty-section');
  const itemImage = /** @type {HTMLImageElement} */ (document.getElementById('item-image'));
  const itemName = document.getElementById('item-name');
  const voteResult = document.getElementById('vote-result');
  const nextBtn = document.getElementById('next-btn');
  const deleteCurrentBtn = document.getElementById('delete-current-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const choiceButtons = document.querySelectorAll('.choice-buttons .btn');

  /** @type {{ id: number; filename: string; original_name: string }[]} */
  let items = [];
  let currentIndex = 0;
  let currentItemId = -1;

  // ── Helpers ──────────────────────────────────────────────────────

  function setStatus(msg, type) {
    ui.setStatus(uploadStatus, msg, type);
  }

  function updateBars(save, sell, throwCount) {
    const total = save + sell + throwCount || 1;
    const barSave = document.getElementById('bar-save');
    const barSell = document.getElementById('bar-sell');
    const barThrow = document.getElementById('bar-throw');
    const cntSave = document.getElementById('count-save');
    const cntSell = document.getElementById('count-sell');
    const cntThrow = document.getElementById('count-throw');
    if (barSave) barSave.style.width = (save / total * 100) + '%';
    if (barSell) barSell.style.width = (sell / total * 100) + '%';
    if (barThrow) barThrow.style.width = (throwCount / total * 100) + '%';
    if (cntSave) cntSave.textContent = String(save);
    if (cntSell) cntSell.textContent = String(sell);
    if (cntThrow) cntThrow.textContent = String(throwCount);
  }

  function showItem(item) {
    currentItemId = item.id;
    if (itemImage) {
      itemImage.src = '/uploads/' + item.filename;
      itemImage.alt = item.original_name;
    }
    if (itemName) itemName.textContent = item.original_name;
    if (viewerSection) viewerSection.classList.remove('hidden');
    if (emptySection) emptySection.classList.add('hidden');
    if (voteResult) voteResult.classList.add('hidden');
    choiceButtons.forEach((btn) => { btn.removeAttribute('disabled'); });
  }

  function showEmpty() {
    if (viewerSection) viewerSection.classList.add('hidden');
    if (emptySection) emptySection.classList.remove('hidden');
  }

  // ── Load items ────────────────────────────────────────────────────

  async function loadItems() {
    try {
      items = await api.get('/items');
      if (items.length === 0) {
        showEmpty();
      } else {
        currentIndex = 0;
        showItem(items[currentIndex]);
      }
    } catch (err) {
      setStatus(String(err), 'error');
      showEmpty();
    }
  }

  // ── Upload ────────────────────────────────────────────────────────

  if (imageInput && fileLabelText) {
    imageInput.addEventListener('change', () => {
      if (imageInput.files && imageInput.files[0]) {
        fileLabelText.textContent = imageInput.files[0].name;
      } else {
        fileLabelText.textContent = 'Välj en bild…';
      }
    });
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!imageInput || !imageInput.files || !imageInput.files[0]) {
        setStatus('Välj en bild först.', 'error');
        return;
      }
      const formData = new FormData();
      formData.append('image', imageInput.files[0]);
      setStatus('Laddar upp…');
      try {
        const newItem = await api.post('/items', formData);
        setStatus('Uppladdning klar!', 'success');
        uploadForm.reset();
        if (fileLabelText) fileLabelText.textContent = 'Välj en bild…';
        items.unshift(newItem);
        currentIndex = 0;
        showItem(newItem);
      } catch (err) {
        setStatus(String(err), 'error');
      }
    });
  }

  // ── Choices ───────────────────────────────────────────────────────

  choiceButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (currentItemId === -1) return;
      const choice = btn.getAttribute('data-choice');
      if (!choice) return;
      choiceButtons.forEach((b) => b.setAttribute('disabled', 'true'));
      try {
        const data = await api.post('/items/' + currentItemId + '/choices', { choice });
        updateBars(data.counts.save, data.counts.sell, data.counts.throw);
        if (voteResult) voteResult.classList.remove('hidden');
      } catch (err) {
        setStatus(String(err), 'error');
        choiceButtons.forEach((b) => b.removeAttribute('disabled'));
      }
    });
  });

  // ── Delete current item ──────────────────────────────────────────

  if (deleteCurrentBtn) {
    deleteCurrentBtn.addEventListener('click', async () => {
      if (currentItemId === -1) return;
      if (!confirm('Vill du verkligen ta bort detta föremål?')) return;

      deleteCurrentBtn.setAttribute('disabled', 'true');
      try {
        await api.delete('/items/' + currentItemId);

        items = items.filter((item) => item.id !== currentItemId);
        if (items.length === 0) {
          currentItemId = -1;
          showEmpty();
          return;
        }

        currentIndex = Math.min(currentIndex, items.length - 1);
        showItem(items[currentIndex]);
        setStatus('Föremålet togs bort.', 'success');
      } catch (err) {
        setStatus(String(err), 'error');
      } finally {
        deleteCurrentBtn.removeAttribute('disabled');
      }
    });
  }

  // ── Logout ───────────────────────────────────────────────────────

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await api.post('/logout', {});
        window.location.href = '/login.html';
      } catch (err) {
        setStatus(String(err), 'error');
      }
    });
  }

  // ── Next item ─────────────────────────────────────────────────────

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % items.length;
      showItem(items[currentIndex]);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────
  loadItems();
})();
