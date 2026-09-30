// SparaSäljSlang — Main page logic
// Handles upload and vote/choice for a single item at a time.

(function () {
  'use strict';

  const api = window.__appApi;
  const ui = window.__ui;
  const components = window.__components;
  const uploadForm = /** @type {HTMLFormElement} */ (document.getElementById('upload-form'));
  const imageInput = /** @type {HTMLInputElement} */ (document.getElementById('image-input'));
  const uploadDropzone = document.getElementById('upload-dropzone');
  const fileLabelText = document.getElementById('file-label-text');
  const imagePreview = document.getElementById('image-preview');
  const imagePreviewImage = /** @type {HTMLImageElement} */ (document.getElementById('image-preview-image'));
  const uploadStatus = document.getElementById('upload-status');
  const viewerStatus = document.getElementById('viewer-status');
  const uploadButton = uploadForm && uploadForm.querySelector('button[type="submit"]');
  const viewerSection = document.getElementById('viewer-section');
  const emptySection = document.getElementById('empty-section');
  const itemImage = /** @type {HTMLImageElement} */ (document.getElementById('item-image'));
  const itemName = document.getElementById('item-name');
  const voteResult = document.getElementById('vote-result');
  const nextBtn = document.getElementById('next-btn');
  const deleteCurrentBtn = document.getElementById('delete-current-btn');
  const sellDirectButton = document.getElementById('sell-direct-btn');
  const listingDraftLink = document.getElementById('listing-draft-link');
  const logoutBtn = document.getElementById('logout-btn');
  const choiceButtons = document.querySelectorAll('.choice-buttons [data-choice]');
  const voteProgress = document.getElementById('vote-progress');
  const summaryItems = document.getElementById('summary-items');
  const summaryVotes = document.getElementById('summary-votes');
  const summarySave = document.getElementById('summary-save');
  const summarySell = document.getElementById('summary-sell');
  const summaryThrow = document.getElementById('summary-throw');
  const summaryDetail = document.getElementById('summary-detail');

  /** @type {{ id: number; filename: string; original_name: string }[]} */
  let items = [];
  let currentIndex = 0;
  let currentItemId = -1;
  let selectedFile = null;
  let previewUrl = null;
  let canManageItems = false;
  const maxUploadBytes = 10 * 1024 * 1024;
  const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

  // ── Helpers ──────────────────────────────────────────────────────

  function setStatus(msg, type) {
    ui.setStatus(viewerStatus || uploadStatus, msg, type);
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
    updateBars(item.save_count, item.sell_count, item.throw_count);
    if (voteResult) voteResult.classList.remove('hidden');
    const votingClosed = item.sell_direct === 1 || item.voter_count >= item.required_votes;
    choiceButtons.forEach((btn) => {
      btn.disabled = Boolean(item.my_choice) || votingClosed;
    });
    if (voteProgress) {
      if (item.sell_direct === 1) {
        voteProgress.textContent = 'Direktförsäljning vald. Annonsutkastet kan granskas.';
      } else if (item.sell_ready) {
        voteProgress.textContent = 'Säljbeslutet är klart och ett annonsutkast har skapats.';
      } else if (votingClosed) {
        voteProgress.textContent = `Omröstningen avslutad (${item.voter_count}/${item.required_votes}). Alla väljare behövde välja Sälj för att skapa ett utkast.`;
      } else if (item.my_choice) {
        voteProgress.textContent = `Du har röstat. ${item.voter_count} av ${item.required_votes} väljare har röstat.`;
      } else {
        voteProgress.textContent = `${item.voter_count} av ${item.required_votes} väljare har röstat. En röst per konto.`;
      }
    }
    if (sellDirectButton) {
      sellDirectButton.classList.toggle('hidden', item.sell_ready || item.sell_direct === 1);
    }
    if (listingDraftLink) listingDraftLink.classList.toggle('hidden', !item.sell_ready && item.sell_direct !== 1);
    setStatus('');
  }

  function showEmpty() {
    if (viewerSection) viewerSection.classList.add('hidden');
    if (emptySection) emptySection.classList.remove('hidden');
  }

  function renderSummary(summary) {
    if (summaryItems) summaryItems.textContent = String(summary.total_items);
    if (summaryVotes) summaryVotes.textContent = String(summary.total_votes);
    if (summarySave) summarySave.textContent = String(summary.save_items);
    if (summarySell) summarySell.textContent = String(summary.sell_items);
    if (summaryThrow) summaryThrow.textContent = String(summary.throw_items);
    if (summaryDetail) {
      const parts = [];
      if (summary.tied_items) parts.push(`${summary.tied_items} oavgjorda`);
      if (summary.undecided_items) parts.push(`${summary.undecided_items} utan röster`);
      summaryDetail.textContent = parts.join(' · ');
    }
  }

  async function loadSummary() {
    try {
      renderSummary(await api.get('/items/summary'));
    } catch (err) {
      console.warn('Could not load decision summary', err);
    }
  }

  function clearSelectedFile() {
    selectedFile = null;
    if (imageInput) imageInput.value = '';
    if (fileLabelText) fileLabelText.textContent = 'Välj en bild…';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    if (imagePreviewImage) imagePreviewImage.removeAttribute('src');
    if (imagePreview) imagePreview.classList.add('hidden');
  }

  function selectFile(file) {
    if (!allowedImageTypes.has(file.type)) {
      setStatus('Välj en PNG-, JPEG-, GIF- eller WebP-bild.', 'error');
      return;
    }
    if (file.size > maxUploadBytes) {
      setStatus('Bilden får vara högst 10 MB.', 'error');
      return;
    }

    selectedFile = file;
    if (fileLabelText) fileLabelText.textContent = file.name;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    if (imagePreviewImage) imagePreviewImage.src = previewUrl;
    if (imagePreview) imagePreview.classList.remove('hidden');
    setStatus('');
  }

  // ── Load items ────────────────────────────────────────────────────

  async function loadItems() {
    try {
      const session = await api.get('/session');
      canManageItems = session.is_administrator;
      if (deleteCurrentBtn) deleteCurrentBtn.classList.toggle('hidden', !canManageItems);
      const uploadLink = document.querySelector('nav a[href="upload.html"]');
      if (uploadLink) uploadLink.classList.toggle('hidden', !canManageItems);
      if (uploadForm && !canManageItems) {
        const uploadSection = uploadForm.closest('section');
        if (uploadSection) uploadSection.classList.add('hidden');
        setStatus('Endast administratören kan ladda upp föremål.', 'error');
      }
      items = await api.get('/items');
      if (items.length === 0) {
        showEmpty();
      } else {
        currentIndex = 0;
        await showItemById(items[currentIndex].id);
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
        selectFile(imageInput.files[0]);
      } else {
        clearSelectedFile();
      }
    });
  }

  if (uploadDropzone) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      uploadDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadDropzone.classList.add('is-dragging');
      });
    });
    ['dragleave', 'drop'].forEach((eventName) => {
      uploadDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadDropzone.classList.remove('is-dragging');
      });
    });
    uploadDropzone.addEventListener('drop', (event) => {
      const file = event.dataTransfer && event.dataTransfer.files[0];
      if (file) selectFile(file);
    });
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedFile) {
        setStatus('Välj en bild först.', 'error');
        return;
      }
      const formData = new FormData();
      formData.append('image', selectedFile);
      setStatus('Laddar upp…');
      if (uploadButton) uploadButton.setAttribute('disabled', 'true');
      try {
        formData.append('requiredVotes', document.getElementById('required-votes').value);
        const newItem = await api.post('/items', formData);
        setStatus('Uppladdning klar!', 'success');
        clearSelectedFile();
        items.unshift(newItem);
        await showItemById(newItem.id);
        loadSummary();
      } catch (err) {
        setStatus(String(err), 'error');
      } finally {
        if (uploadButton) uploadButton.removeAttribute('disabled');
      }
    });
  }

  // ── Choices ───────────────────────────────────────────────────────

  async function showItemById(id) {
    showItem(await api.get('/items/' + id));
  }

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
        if (data.sell_ready && data.listing_draft) {
          window.location.href = '/listings.html?draft=' + data.listing_draft.id;
          return;
        }
        await showItemById(currentItemId);
        loadSummary();
      } catch (err) {
        setStatus(String(err), 'error');
        choiceButtons.forEach((b) => b.removeAttribute('disabled'));
      }
    });
  });

  if (sellDirectButton) {
    sellDirectButton.addEventListener('click', async () => {
      if (currentItemId === -1) return;
      if (!confirm('Skapa ett annonsutkast direkt utan omröstning? Utkastet publiceras inte automatiskt.')) return;
      sellDirectButton.setAttribute('disabled', 'true');
      try {
        const result = await api.post('/items/' + currentItemId + '/sell-direct', {});
        window.location.href = '/listings.html?draft=' + result.listing_draft.id;
      } catch (error) {
        setStatus(String(error), 'error');
        sellDirectButton.removeAttribute('disabled');
      }
    });
  }

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
        loadSummary();
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
    nextBtn.addEventListener('click', async () => {
      currentIndex = (currentIndex + 1) % items.length;
      try {
        await showItemById(items[currentIndex].id);
      } catch (error) {
        setStatus(String(error), 'error');
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────
  loadSummary();
  loadItems();
})();
