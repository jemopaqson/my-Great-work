// ─── Anarchy Admin — CRUD Content Manager ────────────────────────────────
// Persists to localStorage. The main site reads localStorage on load,
// falling back to its hardcoded defaults if no saved data exists.
// ─────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'anarchy_documents';

// ─── Default Data (mirrors script.js documentsData) ──────────────────────
const DEFAULT_DATA = {
  'contents-paper': [],
  'pdfs-paper': [],
  'presentations-paper': [],
  'videos-paper': [],
  settings: {
    authorTag: '_ anarchy _',
    titleTop: 'The anarchy',
    titleBottom: 'files.',
    categories: {
      'contents-paper': 'Work Contents',
      'pdfs-paper': 'PDFs Library',
      'presentations-paper': 'Presentations',
      'videos-paper': 'Videos'
    },
    intro: {
      heading: 'Classified.',
      p1: "You've found the anarchy files. This is a collection of raw thoughts, digital artifacts, and visual rebellion.",
      p2: "Break the grid. Touch the paper. Uncover the truth.",
      btnText: "Enter The Desk"
    }
  }
};

const SECTION_LABELS = {
  'contents-paper': 'Work Contents',
  'pdfs-paper': 'PDFs',
  'presentations-paper': 'Presentations',
  'videos-paper': 'Videos',
};

// ─── State ────────────────────────────────────────────────────────────────
let activeSection = 'contents-paper';
let data = deepClone(DEFAULT_DATA); // will be overridden by DB
let pendingDeleteIndex = null;
let currentImages = [];
let currentVideos = [];
let currentAudio = [];
let currentPdfs = [];
let currentSticky = [];
let isDataLoaded = false;

// ─── Persistence (Appwrite Only) ─────────────────────────────────────────

async function initData() {
  const cloudData = await appwriteLoadData(DEFAULT_DATA);
  if (cloudData) {
    if (!cloudData.settings) cloudData.settings = deepClone(DEFAULT_DATA.settings);
    if (!cloudData.settings.intro) cloudData.settings.intro = deepClone(DEFAULT_DATA.settings.intro);
    data = cloudData;
  }
  isDataLoaded = true;
  updateSectionHeader();
  renderGrid();
  console.log('[Admin] Appwrite data loaded.');
}

async function saveData() {
  const ok = await appwriteSaveData(data);
  if (ok) {
    console.log('[Admin] Cloud save successful.');
    return true;
  } else {
    showToast('Cloud save failed! Please check console for errors.', true);
    return false;
  }
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── Render ───────────────────────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('docGrid');
  const empty = document.getElementById('emptyState');
  const docs = data[activeSection] || [];

  grid.innerHTML = '';

  if (docs.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  docs.forEach((doc, idx) => {
    const card = document.createElement('div');
    card.className = 'doc-card';

    const imgCount = (doc.images || []).filter(Boolean).length;
    const vidCount = (doc.videos || []).filter(Boolean).length;
    const audCount = (doc.voiceNotes || []).filter(Boolean).length;
    const pdfCount = (doc.pdfs || []).filter(Boolean).length;
    const stkCount = (doc.stickyNotes || []).filter(Boolean).length;

    const mediaBadges = [
      imgCount > 0 ? `<span class="media-badge has-img">🖼 ${imgCount} image${imgCount > 1 ? 's' : ''}</span>` : '',
      vidCount > 0 ? `<span class="media-badge has-vid">▶ ${vidCount} video${vidCount > 1 ? 's' : ''}</span>` : '',
      audCount > 0 ? `<span class="media-badge has-vid">🎵 ${audCount} audio</span>` : '',
      pdfCount > 0 ? `<span class="media-badge has-img">📄 ${pdfCount} PDF${pdfCount > 1 ? 's' : ''}</span>` : '',
      stkCount > 0 ? `<span class="media-badge has-img">📝 ${stkCount} note${stkCount > 1 ? 's' : ''}</span>` : '',
    ].join('');

    card.innerHTML = `
      <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 4px;">
        <span class="doc-card-badge">${doc.shortTitle}</span>
        ${doc.category ? `<span class="doc-card-badge" style="background: rgba(140, 28, 19, 0.12); color: #e05c52; border: 1px solid rgba(140, 28, 19, 0.2);">🏷️ ${doc.category}</span>` : ''}
      </div>
      <div class="doc-card-title">${doc.title}</div>
      <div class="doc-card-preview">${(doc.text || '').replace(/\n/g, ' ')}</div>
      ${mediaBadges ? `<div class="doc-card-media">${mediaBadges}</div>` : ''}
      <div class="doc-card-actions">
        <button class="btn-edit" data-idx="${idx}">✏ Edit</button>
        <button class="btn-delete" data-idx="${idx}">🗑 Delete</button>
      </div>
    `;

    card.querySelector('.btn-edit').addEventListener('click', () => openEditModal(idx));
    card.querySelector('.btn-delete').addEventListener('click', () => openDeleteConfirm(idx));
    grid.appendChild(card);
  });
}

function updateSectionHeader() {
  if (activeSection === 'settings') {
    document.getElementById('sectionTitle').textContent = 'Site Configuration';
    document.getElementById('sectionSub').textContent = 'Edit homepage texts and labels';
    document.getElementById('addDocBtn').classList.add('hidden');
  } else {
    document.getElementById('sectionTitle').textContent = SECTION_LABELS[activeSection];
    document.getElementById('sectionSub').textContent = `${(data[activeSection] || []).length} documents in this section`;
    document.getElementById('addDocBtn').classList.remove('hidden');
  }
}

// ─── Media Handlers ───────────────────────────────────────────────────────

// Helper to fix relative paths when viewing from /admin/
function resolveAdminPath(src) {
  if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('/')) {
    return src;
  }
  return '../' + src;
}

function renderMediaPreviews() {
  const imgList = document.getElementById('imgPreviewList');
  imgList.innerHTML = '';
  currentImages.forEach((src, idx) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `
      <img src="${resolveAdminPath(src)}" alt="Preview">
      <button type="button" class="remove-media-btn" onclick="removeImage(${idx})">✕</button>
    `;
    imgList.appendChild(item);
  });

  const vidList = document.getElementById('vidPreviewList');
  vidList.innerHTML = '';
  currentVideos.forEach((src, idx) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `
      <video src="${resolveAdminPath(src)}" muted playsinline></video>
      <button type="button" class="remove-media-btn" onclick="removeVideo(${idx})">✕</button>
    `;
    vidList.appendChild(item);
  });

  const audList = document.getElementById('audioPreviewList');
  audList.innerHTML = '';
  currentAudio.forEach((src, idx) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `
      <audio src="${resolveAdminPath(src)}" controls style="width: 100%; margin-top: 5px;"></audio>
      <button type="button" class="remove-media-btn" onclick="removeAudio(${idx})">✕</button>
    `;
    audList.appendChild(item);
  });

  const pdfList = document.getElementById('pdfPreviewList');
  pdfList.innerHTML = '';
  currentPdfs.forEach((src, idx) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `
      <div style="padding: 10px; background: #eef; width: 100%; text-align: center;">📄 PDF File</div>
      <button type="button" class="remove-media-btn" onclick="removePdf(${idx})">✕</button>
    `;
    pdfList.appendChild(item);
  });

  const stkList = document.getElementById('stickyPreviewList');
  stkList.innerHTML = '';
  currentSticky.forEach((note, idx) => {
    const text = typeof note === 'string' ? note : note.text;
    const color = typeof note === 'string' ? '#fff8a6' : note.color;
    const bgImage = typeof note === 'object' ? note.bgImage : null;
    const inlineImage = typeof note === 'object' ? note.inlineImage : null;
    
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.style.padding = '8px';
    item.style.background = color;
    item.style.position = 'relative';
    item.style.overflow = 'hidden';
    item.style.color = '#333';
    item.style.fontFamily = "'Patrick Hand', cursive, sans-serif";
    
    let inlineImgHtml = inlineImage ? `<img src="${inlineImage}" style="max-width: 60px; max-height: 40px; border-radius: 3px; vertical-align: middle; margin-left: 6px; border: 1px solid rgba(0,0,0,0.1);">` : '';
    
    let innerContent = `<span>${text}${inlineImgHtml}</span>`;
    if (bgImage) {
      innerContent = `
        <div style="position: absolute; top:0; left:0; width:100%; height:100%; background-image: url('${bgImage}'); background-size: cover; background-position: center; filter: blur(3px) brightness(0.9); z-index: 1;"></div>
        <span style="position: relative; z-index: 2; text-shadow: 0 1px 3px rgba(255,255,255,0.8);">${text}${inlineImgHtml}</span>
      `;
    }
    
    item.innerHTML = `
      ${innerContent}
      <button type="button" class="remove-media-btn" style="z-index: 3;" onclick="removeSticky(${idx})">✕</button>
    `;
    stkList.appendChild(item);
  });
}

window.removeImage = function(idx) {
  currentImages.splice(idx, 1);
  renderMediaPreviews();
};

window.removeVideo = function(idx) {
  currentVideos.splice(idx, 1);
  renderMediaPreviews();
};

window.removeAudio = function(idx) {
  currentAudio.splice(idx, 1);
  renderMediaPreviews();
};

window.removePdf = function(idx) {
  currentPdfs.splice(idx, 1);
  renderMediaPreviews();
};

window.removeSticky = function(idx) {
  currentSticky.splice(idx, 1);
  renderMediaPreviews();
};

// ─── Modal — Add / Edit ───────────────────────────────────────────────────
function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Add Document';
  document.getElementById('editIndex').value = '';
  document.getElementById('fTitle').value = '';
  document.getElementById('fShortTitle').value = '';
  document.getElementById('fCategory').value = '';
  document.getElementById('fText').innerHTML = '';
  currentImages = [];
  currentVideos = [];
  currentAudio = [];
  currentPdfs = [];
  currentSticky = [];
  renderMediaPreviews();
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('fTitle').focus();
}

function openEditModal(idx) {
  const doc = data[activeSection][idx];
  document.getElementById('modalTitle').textContent = 'Edit Document';
  document.getElementById('editIndex').value = idx;
  document.getElementById('fTitle').value = doc.title || '';
  document.getElementById('fShortTitle').value = doc.shortTitle || '';
  document.getElementById('fCategory').value = doc.category || '';
  document.getElementById('fText').innerHTML = doc.text || '';
  currentImages = [...(doc.images || [])].filter(Boolean);
  currentVideos = [...(doc.videos || [])].filter(Boolean);
  currentAudio = [...(doc.voiceNotes || [])].filter(Boolean);
  currentPdfs = [...(doc.pdfs || [])].filter(Boolean);
  currentSticky = [...(doc.stickyNotes || [])].filter(Boolean);
  renderMediaPreviews();
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('fTitle').focus();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

// ─── Modal — Delete ───────────────────────────────────────────────────────
function openDeleteConfirm(idx) {
  pendingDeleteIndex = idx;
  const title = data[activeSection][idx]?.title || 'this document';
  document.getElementById('deleteMsg').textContent = `Delete "${title}"? This cannot be undone.`;
  document.getElementById('deleteOverlay').classList.remove('hidden');
}

function closeDeleteModal() {
  pendingDeleteIndex = null;
  document.getElementById('deleteOverlay').classList.add('hidden');
}

// ─── CRUD Operations ──────────────────────────────────────────────────────
async function saveDocument(e) {
  e.preventDefault();

  const btn = document.getElementById('saveBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Saving... ⏳';
  btn.disabled = true;

  const idx      = document.getElementById('editIndex').value;
  const title    = document.getElementById('fTitle').value.trim();
  const short    = document.getElementById('fShortTitle').value.trim();
  const category = document.getElementById('fCategory').value.trim();
  const text     = document.getElementById('fText').innerHTML.trim();
  const images   = [...currentImages];
  const videos   = [...currentVideos];
  const voiceNotes = [...currentAudio];
  const pdfs       = [...currentPdfs];
  const stickyNotes = [...currentSticky];

  if (!title || !short) {
    showToast('Title and Short Label are required.', true);
    btn.textContent = originalText;
    btn.disabled = false;
    return;
  }

  const doc = { title, shortTitle: short, category, text, images, videos, voiceNotes, pdfs, stickyNotes };

  if (idx === '') {
    // Create
    data[activeSection].push(doc);
    const success = await saveData();
    if (success) {
      showToast(`"${title}" added successfully.`);
    } else {
      data[activeSection].pop(); // rollback
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }
  } else {
    // Update
    const oldDoc = data[activeSection][parseInt(idx)];
    data[activeSection][parseInt(idx)] = doc;
    const success = await saveData();
    if (success) {
      showToast(`"${title}" updated.`);
    } else {
      data[activeSection][parseInt(idx)] = oldDoc; // rollback
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }
  }

  closeModal();
  updateSectionHeader();
  renderGrid();

  // Reset button state
  btn.textContent = originalText;
  btn.disabled = false;
}

async function deleteDocument() {
  if (pendingDeleteIndex === null) return;
  const title = data[activeSection][pendingDeleteIndex]?.title;
  const oldDoc = data[activeSection][pendingDeleteIndex];
  
  data[activeSection].splice(pendingDeleteIndex, 1);
  const success = await saveData();
  
  if (success) {
    closeDeleteModal();
    renderGrid();
    showToast(`"${title}" deleted.`);
  } else {
    // rollback
    data[activeSection].splice(pendingDeleteIndex, 0, oldDoc);
  }
}

// ─── Export JSON ──────────────────────────────────────────────────────────
function exportJSON() {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'anarchy_content.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Content exported as JSON.');
}

// ─── Toast ────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden', 'error');
  if (isError) toast.classList.add('error');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ─── Intro Status Badge ─────────────────────────────────────────────────
function updateIntroStatusBadge() {
  const badge = document.getElementById('introStatusBadge');
  if (!badge) return;
  const seen = localStorage.getItem('anarchyIntroSeen');
  if (seen) {
    badge.textContent = '✅ Intro already seen — will be skipped';
    badge.style.background = '#d4edda';
    badge.style.color = '#155724';
  } else {
    badge.textContent = '👁 Intro will show on next visit';
    badge.style.background = '#fff3cd';
    badge.style.color = '#856404';
  }
}

// ─── Event Listeners ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Section nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSection = btn.dataset.section;
      updateSectionHeader();
      
      const form = document.getElementById('settingsForm');
      const grid = document.getElementById('docGrid');
      const empty = document.getElementById('emptyState');
      
      if (activeSection === 'settings') {
        grid.innerHTML = '';
        empty.classList.add('hidden');
        form.classList.remove('hidden');
        
        // Load values into settings form
        const s = data.settings;
        document.getElementById('sAuthorTag').value = s.authorTag;
        document.getElementById('sTitleTop').value = s.titleTop;
        document.getElementById('sTitleBottom').value = s.titleBottom;
        document.getElementById('sCatContents').value = s.categories['contents-paper'];
        document.getElementById('sCatPdfs').value = s.categories['pdfs-paper'];
        document.getElementById('sCatPresentations').value = s.categories['presentations-paper'];
        document.getElementById('sCatVideos').value = s.categories['videos-paper'];
        
        document.getElementById('sIntroHeading').value = s.intro.heading;
        document.getElementById('sIntroP1').value = s.intro.p1;
        document.getElementById('sIntroP2').value = s.intro.p2;
        document.getElementById('sIntroBtn').value = s.intro.btnText;
        
        // Update intro status badge
        updateIntroStatusBadge();
        
      } else {
        form.classList.add('hidden');
        renderGrid();
      }
    });
  });

  // Settings Save
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveSettingsBtn');
    const orig = btn.textContent;
    btn.textContent = 'Saving... ⏳';
    btn.disabled = true;
    
    data.settings.authorTag = document.getElementById('sAuthorTag').value.trim();
    data.settings.titleTop = document.getElementById('sTitleTop').value.trim();
    data.settings.titleBottom = document.getElementById('sTitleBottom').value.trim();
    data.settings.categories['contents-paper'] = document.getElementById('sCatContents').value.trim();
    data.settings.categories['pdfs-paper'] = document.getElementById('sCatPdfs').value.trim();
    data.settings.categories['presentations-paper'] = document.getElementById('sCatPresentations').value.trim();
    data.settings.categories['videos-paper'] = document.getElementById('sCatVideos').value.trim();
    
    data.settings.intro.heading = document.getElementById('sIntroHeading').value.trim();
    data.settings.intro.p1 = document.getElementById('sIntroP1').value.trim();
    data.settings.intro.p2 = document.getElementById('sIntroP2').value.trim();
    data.settings.intro.btnText = document.getElementById('sIntroBtn').value.trim();
    
    const success = await saveData();
    if (success) {
      showToast('Settings saved successfully.');
    }
    btn.textContent = orig;
    btn.disabled = false;
  });

  // Add doc button
  document.getElementById('addDocBtn').addEventListener('click', openAddModal);

  // Form submit (save)
  document.getElementById('docForm').addEventListener('submit', saveDocument);

  // Cancel / close modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);

  // Close modal on overlay click
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // Delete confirm / cancel
  document.getElementById('confirmDeleteBtn').addEventListener('click', deleteDocument);
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('deleteOverlay')) closeDeleteModal();
  });

  // Media Inputs
  function handleFileUploads(files, targetArray, callback) {
    if (!files.length) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        targetArray.push(evt.target.result);
        callback();
      };
      reader.readAsDataURL(file);
    });
  }

  document.getElementById('imgUpload').addEventListener('change', (e) => {
    handleFileUploads(e.target.files, currentImages, renderMediaPreviews);
    e.target.value = '';
  });

  document.getElementById('vidUpload').addEventListener('change', (e) => {
    handleFileUploads(e.target.files, currentVideos, renderMediaPreviews);
    e.target.value = '';
  });

  document.getElementById('addImgLinkBtn').addEventListener('click', () => {
    const input = document.getElementById('imgLinkInput');
    const val = input.value.trim();
    if (val) {
      currentImages.push(val);
      input.value = '';
      renderMediaPreviews();
    }
  });

  document.getElementById('addVidLinkBtn').addEventListener('click', () => {
    const input = document.getElementById('vidLinkInput');
    const val = input.value.trim();
    if (val) {
      currentVideos.push(val);
      input.value = '';
      renderMediaPreviews();
    }
  });

  document.getElementById('audioUpload').addEventListener('change', (e) => {
    handleFileUploads(e.target.files, currentAudio, renderMediaPreviews);
    e.target.value = '';
  });

  document.getElementById('addAudioLinkBtn').addEventListener('click', () => {
    const input = document.getElementById('audioLinkInput');
    const val = input.value.trim();
    if (val) {
      currentAudio.push(val);
      input.value = '';
      renderMediaPreviews();
    }
  });

  document.getElementById('pdfUpload').addEventListener('change', (e) => {
    handleFileUploads(e.target.files, currentPdfs, renderMediaPreviews);
    e.target.value = '';
  });

  document.getElementById('addPdfLinkBtn').addEventListener('click', () => {
    const input = document.getElementById('pdfLinkInput');
    const val = input.value.trim();
    if (val) {
      currentPdfs.push(val);
      input.value = '';
      renderMediaPreviews();
    }
  });

  document.getElementById('addStickyBtn').addEventListener('click', () => {
    const input = document.getElementById('stickyInput');
    const colorInput = document.getElementById('stickyColor');
    const bgUpload = document.getElementById('stickyBgUpload');
    const inlineUpload = document.getElementById('stickyInlineUpload');
    
    const val = input.value.trim();
    const color = colorInput.value;
    
    if (val) {
      // Read both files in parallel using promises
      const readFile = (file) => {
        return new Promise((resolve) => {
          if (!file) { resolve(null); return; }
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(file);
        });
      };

      const bgFile = bgUpload.files && bgUpload.files[0] ? bgUpload.files[0] : null;
      const inlineFile = inlineUpload.files && inlineUpload.files[0] ? inlineUpload.files[0] : null;

      Promise.all([readFile(bgFile), readFile(inlineFile)]).then(([bgData, inlineData]) => {
        currentSticky.push({ text: val, color: color, bgImage: bgData, inlineImage: inlineData });
        input.value = '';
        bgUpload.value = '';
        inlineUpload.value = '';
        renderMediaPreviews();
      });
    }
  });

  // --- Audio Recording Logic ---
  let mediaRecorder;
  let audioChunks = [];
  
  const recordBtn = document.getElementById('recordAudioBtn');
  const stopBtn = document.getElementById('stopRecordBtn');
  const recIndicator = document.getElementById('recordingIndicator');

  recordBtn.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true
        }
      });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = (evt) => {
          currentAudio.push(evt.target.result);
          renderMediaPreviews();
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        recIndicator.style.display = 'none';
        recordBtn.style.display = 'inline-block';
      };

      mediaRecorder.start();
      recIndicator.style.display = 'block';
      recordBtn.style.display = 'none';
    } catch (err) {
      showToast('Microphone access denied or not available.', true);
    }
  });

  stopBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  });

  // Reset Intro
  document.getElementById('resetIntroBtn').addEventListener('click', () => {
    localStorage.removeItem('anarchyIntroSeen');
    updateIntroStatusBadge();
    showToast('Intro reset! It will show again on next visit to the site.');
  });

  // Export JSON
  document.getElementById('exportBtn').addEventListener('click', exportJSON);

  // ─── Rich Text Editor Toolbar Wiring ─────────────────────────────────────
  const editorArea = document.getElementById('fText');

  // Simple command buttons (bold, italic, underline, etc.)
  document.querySelectorAll('.tb-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent losing focus from editorArea
      const cmd = btn.getAttribute('data-cmd');
      
      if (cmd === 'createLink') {
        const url = prompt('Enter URL:');
        if (url) document.execCommand('createLink', false, url);
      } else if (cmd === 'insertImage') {
        const url = prompt('Enter Image URL:');
        if (url) document.execCommand('insertImage', false, url);
      } else {
        document.execCommand(cmd, false, null);
      }
    });
  });

  // Heading select
  document.getElementById('tbHeading').addEventListener('change', (e) => {
    editorArea.focus();
    document.execCommand('formatBlock', false, e.target.value);
  });

  // Font size select
  document.getElementById('tbFontSize').addEventListener('change', (e) => {
    editorArea.focus();
    document.execCommand('fontSize', false, e.target.value);
  });

  // Highlight color
  document.getElementById('tbHighlight').addEventListener('input', (e) => {
    editorArea.focus();
    document.execCommand('hiliteColor', false, e.target.value);
  });

  // Text color
  document.getElementById('tbTextColor').addEventListener('input', (e) => {
    editorArea.focus();
    document.execCommand('foreColor', false, e.target.value);
  });

  // Upload inline image
  document.getElementById('inlineImageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        editorArea.focus();
        document.execCommand('insertImage', false, evt.target.result);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; // Reset input
  });
  // Inline image resizing (Click & Drag)
  let isResizingImg = false;
  let activeImg = null;
  let startX = 0;
  let startWidth = 0;
  let hasDraggedImg = false;

  editorArea.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'IMG') {
      isResizingImg = true;
      activeImg = e.target;
      startX = e.clientX;
      startWidth = activeImg.offsetWidth;
      hasDraggedImg = false;
      e.preventDefault(); // Prevent native image drag
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (isResizingImg && activeImg) {
      const deltaX = e.clientX - startX;
      if (Math.abs(deltaX) > 5) hasDraggedImg = true;
      
      if (hasDraggedImg) {
        let newWidth = startWidth + deltaX;
        if (newWidth < 50) newWidth = 50; // min width
        activeImg.style.width = newWidth + 'px';
        activeImg.style.height = 'auto';
      }
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (isResizingImg && activeImg) {
      if (!hasDraggedImg && e.target === activeImg) {
        // Was just a click, fallback to prompt
        const currentWidth = activeImg.style.width || '100%';
        const promptWidth = prompt('Enter new image width (e.g., 50%, 200px, 100%):', currentWidth);
        if (promptWidth) {
          activeImg.style.width = promptWidth;
          activeImg.style.height = 'auto';
        }
      }
      isResizingImg = false;
      activeImg = null;
    }
  });

  // Initial Load from Appwrite
  initData();
});
