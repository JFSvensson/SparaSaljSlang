// SparaSäljSlang — Main page logic
// Handles upload and vote/choice for a single item at a time.

(function () {
  'use strict';

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
  const choiceButtons = document.querySelectorAll('.choice-buttons .btn');

  /** @type {{ id: number; filename: string; original_name: string }[]} */
  let items = [];
  let currentIndex = 0;
  let currentItemId = -1;

  // ── Helpers ──────────────────────────────────────────────────────

  function setStatus(msg, type) {
    if (!uploadStatus) return;
    uploadStatus.textContent = msg;
    uploadStatus.className = 'status-msg' + (type ? ' ' + type : '');
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
      const res = await fetch('/api/items');
      if (!res.ok) throw new Error('Kunde inte hämta föremål');
      items = await res.json();
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
        const res = await fetch('/api/items', { method: 'POST', body: formData });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || 'Uppladdning misslyckades');
        }
        const newItem = await res.json();
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
        const res = await fetch('/api/items/' + currentItemId + '/choices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ choice }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || 'Kunde inte spara val');
        }
        const data = await res.json();
        updateBars(data.counts.save, data.counts.sell, data.counts.throw);
        if (voteResult) voteResult.classList.remove('hidden');
      } catch (err) {
        setStatus(String(err), 'error');
        choiceButtons.forEach((b) => b.removeAttribute('disabled'));
      }
    });
  });

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
