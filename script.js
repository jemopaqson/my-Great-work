// Synthesize a realistic page turn sound using Web Audio API
function playPaperSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const bufferSize = ctx.sampleRate * 0.3; // 0.3 seconds
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  // Generate white noise
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1; 
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  
  // Filter for paper texture (bandpass)
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800; // crinkly frequency
  filter.Q.value = 0.8;
  
  // Envelope (sharp attack, quick decay)
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05); // Attack
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25); // Decay
  
  noise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  noise.start();
}

document.addEventListener('DOMContentLoaded', () => {
  const paperOrder = [
    'menu-paper',
    'contents-paper',
    'pdfs-paper',
    'presentations-paper',
    'videos-paper'
  ];
  let currentIndex = 0;
  let isAnimating = false;

  function turnToPage(nextIndex) {
    if (nextIndex === currentIndex || isAnimating) return;
    isAnimating = true;
    
    playPaperSound();

    const currentPaper = document.getElementById(paperOrder[currentIndex]);
    const nextPaper = document.getElementById(paperOrder[nextIndex]);

    currentPaper.classList.remove('paper-active');
    currentPaper.classList.add('paper-out');

    setTimeout(() => {
      currentPaper.classList.remove('paper-out');
      currentPaper.classList.add('paper-hidden');
      
      nextPaper.classList.remove('paper-hidden', 'paper-out');
      nextPaper.classList.add('paper-active');
      
      currentIndex = nextIndex;
      isAnimating = false;
    }, 350);
  }

  // Handle specific links
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-target');
      const targetIndex = paperOrder.indexOf(targetId);
      if (targetIndex !== -1) turnToPage(targetIndex);
    });
  });

  // Handle back buttons
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      turnToPage(0); // 0 is menu-paper
    });
  });

  // Handle tapping anywhere on the paper to flip to the next page
  document.addEventListener('click', (e) => {
    // If they clicked a nav link, back button, document link, search input, or filter tag, do not turn the page
    if (e.target.closest('.nav-btn') || e.target.closest('.back-btn') || e.target.closest('.paper-content p') || e.target.closest('.search-filter-controls')) return;
    
    const activePaper = document.querySelector('.top-paper.paper-active');
    // Only turn if clicked inside the active paper
    if (activePaper && activePaper.contains(e.target)) {
      let nextIndex = (currentIndex + 1) % paperOrder.length;
      turnToPage(nextIndex);
    }
  });

  // ─── Documents Database ───────────────────────────────────────────────────
  // Initialises with default placeholders while Appwrite cloud data loads.
  // ─────────────────────────────────────────────────────────────────────────
  const _defaultDocumentsData = {
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

  // Initialize with defaults, will be overridden by Appwrite cloud sync
  let documentsData = JSON.parse(JSON.stringify(_defaultDocumentsData));

  // ─── Apply settings to the DOM ──────────────────────────────────────────
  function applySettings(d) {
    if (!d.settings) return;
    const s = d.settings;
    const elAuthor = document.getElementById('dyn-author');
    const elTitleTop = document.getElementById('dyn-titleTop');
    const elTitleBottom = document.getElementById('dyn-titleBottom');
    
    if (elAuthor) elAuthor.textContent = s.authorTag;
    if (elTitleTop) elTitleTop.textContent = s.titleTop;
    if (elTitleBottom) elTitleBottom.textContent = s.titleBottom;

    Object.keys(s.categories).forEach(paperId => {
      const catName = s.categories[paperId];
      
      // Update nav link button
      const navBtn = document.querySelector(`.nav-btn[data-target="${paperId}"]`);
      if (navBtn) navBtn.textContent = catName;
      
      // Update header inside the actual section paper
      const paperHeader = document.querySelector(`#${paperId} h2.stamp-small`);
      if (paperHeader) paperHeader.textContent = catName;
    });

    if (s.intro) {
      const elIntroHeading = document.getElementById('intro-heading-el');
      const elIntroP1 = document.getElementById('intro-p1-el');
      const elIntroP2 = document.getElementById('intro-p2-el');
      const elIntroBtn = document.getElementById('enter-site-btn');
      
      if (elIntroHeading) elIntroHeading.textContent = s.intro.heading;
      if (elIntroP1) elIntroP1.textContent = s.intro.p1;
      if (elIntroP2) elIntroP2.textContent = s.intro.p2;
      if (elIntroBtn) elIntroBtn.textContent = s.intro.btnText;
    }
  }

  // Apply settings immediately from local data
  applySettings(documentsData);

  // ─── Cloud Sync: fetch latest from Appwrite ─────────────────────────────
  (async function syncPublicSite() {
    const cloudData = await appwriteLoadData(_defaultDocumentsData);
    if (cloudData) {
      if (!cloudData.settings) cloudData.settings = JSON.parse(JSON.stringify(_defaultDocumentsData.settings));
      documentsData = cloudData;
      applySettings(documentsData);
      // Re-render all papers with cloud data
      if (typeof renderContentsCategories === 'function') renderContentsCategories();
      if (typeof renderContentsList === 'function') renderContentsList();
      if (typeof renderStaticPapers === 'function') renderStaticPapers();
      console.log('[Public] Synced data from Appwrite cloud.');
    }

    // Subscribe to Appwrite Realtime events for live updates without refreshing
    if (window.appwriteClient && APPWRITE_DATABASE_ID && APPWRITE_COLLECTION_ID) {
      appwriteClient.subscribe(
        `databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_COLLECTION_ID}.documents`,
        response => {
          if (response.payload.$id === APPWRITE_DOCUMENT_ID) {
            console.log('[Public] Realtime update received from Appwrite!');
            try {
              const newData = JSON.parse(response.payload.json_data);
              if (!newData.settings) newData.settings = JSON.parse(JSON.stringify(_defaultDocumentsData.settings));
              documentsData = newData;
              applySettings(documentsData);
              if (typeof renderContentsCategories === 'function') renderContentsCategories();
              if (typeof renderContentsList === 'function') renderContentsList();
              if (typeof renderStaticPapers === 'function') renderStaticPapers();
            } catch(e) {
              console.error('[Public] Failed to parse realtime update', e);
            }
          }
        }
      );
    }
  })();

  // ─── Render media into the parchment modal ──────────────────────────────
  // Rotation + offset patterns for scattered polaroid gallery feel
  const polaroidStyles = [
    'rotate(-2.5deg) translateY(0px)',
    'rotate(1.8deg)  translateY(-4px)',
    'rotate(-1.2deg) translateY(3px)',
    'rotate(3.1deg)  translateY(-2px)',
    'rotate(-3.5deg) translateY(5px)',
    'rotate(0.8deg)  translateY(-3px)',
  ];

  function renderMedia(doc) {
    let html = '';

    if (doc.images && doc.images.length) {
      if (doc.images.length === 1) {
        // Single image — centered polaroid with tape
        html += `
          <div class="embedded-image-container">
            <img src="${doc.images[0]}" class="embedded-image"
                 style="transform:rotate(-1.5deg)" alt="Document image">
          </div>`;
      } else {
        // Multiple images — scattered polaroid gallery grid
        html += `<div class="photo-gallery">`;
        doc.images.forEach((src, i) => {
          const style = polaroidStyles[i % polaroidStyles.length];
          html += `
            <div class="polaroid" style="transform:${style}">
              <img src="${src}" class="polaroid-img" alt="Image ${i + 1}">
            </div>`;
        });
        html += `</div>`;
      }
    }

    // Videos — inline cinema player
    if (doc.videos && doc.videos.length) {
      doc.videos.forEach((src, i) => {
        html += `
          <div class="embedded-video-container">
            <video class="embedded-video" controls preload="metadata">
              <source src="${src}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
            <span class="caption">▶ Video ${i + 1}</span>
          </div>`;
      });
    }

    // PDF Previews & Download
    if (doc.pdfs && doc.pdfs.length) {
      doc.pdfs.forEach((src, i) => {
        html += `
          <div class="pdf-attachment" style="margin: 2rem 0; width: 100%; display: flex; justify-content: center;">
            <button class="pdf-open-modal-btn highlight" data-src="${src}" style="background-color: #f4f0e6; border: 2px dashed #543619; color: #543619; cursor: pointer; padding: 15px 30px; font-family: 'Special Elite', monospace; font-size: 1.2rem; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 2px 4px 0px rgba(84, 54, 25, 0.2); border-radius: 4px; display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.8rem;">📄</span> View Attached PDF ${i + 1}
            </button>
          </div>
        `;
      });
    }

    // Voice Notes — Audio player
    if (doc.voiceNotes && doc.voiceNotes.length) {
      doc.voiceNotes.forEach((src, i) => {
        html += `
          <div class="embedded-video-container" style="margin: 1.5rem 0;">
            <div class="audio-controls-wrapper" style="display: flex; flex-direction: column; gap: 8px;">
              <audio controls style="width: 100%; max-width: 320px;">
                <source src="${src}" type="audio/mpeg">
                Your browser does not support the audio element.
              </audio>
              <div style="display: flex; gap: 10px; font-family: 'Patrick Hand', cursive; font-size: 0.9rem; align-items: center;">
                <span style="opacity:0.7">Speed:</span>
                <button class="audio-speed-btn" data-speed="0.5" style="background:none;border:none;cursor:pointer;color:#543619;">0.5x</button>
                <button class="audio-speed-btn" data-speed="1" style="background:none;border:none;cursor:pointer;font-weight:bold;color:#543619;text-decoration:underline;">1x</button>
                <button class="audio-speed-btn" data-speed="1.5" style="background:none;border:none;cursor:pointer;color:#543619;">1.5x</button>
                <button class="audio-speed-btn" data-speed="2" style="background:none;border:none;cursor:pointer;color:#543619;">2x</button>
              </div>
            </div>
            <span class="caption">🎵 Voice Note ${i + 1}</span>
          </div>`;
      });
    }

    // Sticky Notes — Yellow squares (Now dynamic colors!)
    if (doc.stickyNotes && doc.stickyNotes.length) {
      html += `<div style="display: flex; flex-wrap: wrap; gap: 20px; margin: 2rem 0; justify-content: center;">`;
      doc.stickyNotes.forEach((note, i) => {
        const text = typeof note === 'string' ? note : note.text;
        const color = typeof note === 'string' ? '#fff8a6' : note.color;
        const bgImage = typeof note === 'object' ? note.bgImage : null;
        const inlineImage = typeof note === 'object' ? note.inlineImage : null;
        const style = polaroidStyles[(i + 3) % polaroidStyles.length];
        
        let bgStyle = `background-color: ${color};`;
        let inlineImgHtml = inlineImage ? `<img src="${inlineImage}" style="max-width: 80%; max-height: 60px; border-radius: 4px; margin-top: 6px; border: 1px solid rgba(0,0,0,0.1); box-shadow: 1px 2px 4px rgba(0,0,0,0.15);">` : '';
        let textContent = `${text.replace(/\n/g, '<br>')}${inlineImgHtml ? '<br>' + inlineImgHtml : ''}`;
        
        let innerHTML = `<div style="position: relative; z-index: 10;">${textContent}</div>`;
        
        if (bgImage) {
          innerHTML = `
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: url('${bgImage}'); background-size: cover; background-position: center; filter: blur(3px) brightness(0.9); z-index: 1;"></div>
            <div style="position: relative; z-index: 10; text-shadow: 0 1px 3px rgba(255,255,255,0.8);">${textContent}</div>
          `;
        }

        html += `
          <div class="sticky-note-wrapper" style="transform: ${style};">
            <div class="sticky-layer sticky-pink"></div>
            <div class="sticky-layer sticky-blue"></div>
            <div class="sticky-layer sticky-yellow" style="${bgStyle} position: relative; overflow: hidden;">
              ${innerHTML}
            </div>
            <div class="sticky-pin"></div>
          </div>
        `;
      });
      html += `</div>`;
    }

    return html;
  }

  function loadDocumentContent(doc) {
    let rawText = doc.text || '';
    let formattedText = rawText;
    
    // If text does not contain HTML block/break tags, it's likely legacy plain text, so convert newlines.
    // If it contains tags (like the new rich text editor output), leave it as raw HTML.
    if (!/<(br|p|div|h[1-6]|ul|ol|li)[> ]/i.test(rawText)) {
      formattedText = rawText.replace(/\n/g, '<br>');
    }

    parchmentTextContainer.innerHTML = `
      <h2 class="stamp-small" style="text-align:center; margin-bottom:1.5rem;">${doc.title}</h2>
      <div class="handwritten" style="word-wrap: break-word;">${formattedText}</div>
      ${renderMedia(doc)}
    `;

    // Always start from the top when switching docs
    parchmentTextContainer.scrollTop = 0;
    playPaperSound();
  }

  // --- Parchment Reading View Logic ---
  const parchmentView = document.getElementById('parchment-view');
  const closeParchmentBtn = document.getElementById('close-parchment');
  const parchmentTextContainer = document.getElementById('parchment-text');
  const parchmentSidebar = document.getElementById('parchment-sidebar');
  
  let currentSectionDocs = [];

  // ─── Rendering dynamic links on the desk papers ───
  const prefixes = {
    'contents-paper': (i) => `${i + 1}. `,
    'pdfs-paper': () => '📄 ',
    'presentations-paper': () => '📊 ',
    'videos-paper': () => '▶ '
  };

  // State variables for search & filtering inside "Work Contents" and "PDFs Library"
  let contentsSearchText = '';
  let contentsActiveCategory = 'All';
  let pdfsSearchText = '';

  // 1. Function to render category filter tags on contents paper
  function renderContentsCategories() {
    const catContainer = document.getElementById('contents-categories');
    if (!catContainer) return;

    // Get unique categories from data (excluding empty categories)
    const docs = documentsData['contents-paper'] || [];
    const categories = ['All', ...new Set(docs.map(d => d.category || 'General').filter(Boolean))];

    catContainer.innerHTML = '';
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button'; // Prevent accidental form submission
      btn.className = `filter-tag ${cat === contentsActiveCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent page-turn from firing
        contentsActiveCategory = cat;
        // Toggle active style
        catContainer.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Re-render contents paper list
        renderContentsList();
      });
      catContainer.appendChild(btn);
    });
  }

  // 2. Function to render the list of documents on the "Work Contents" paper
  function renderContentsList() {
    const paperEl = document.getElementById('contents-paper');
    if (!paperEl) return;
    const contentContainer = paperEl.querySelector('.paper-content');
    if (!contentContainer) return;

    contentContainer.innerHTML = '';

    const docs = documentsData['contents-paper'] || [];
    const getPrefix = prefixes['contents-paper'] || (() => '');

    let displayedCount = 0;

    docs.forEach((doc, idx) => {
      // Filter by category
      const docCat = doc.category || 'General';
      if (contentsActiveCategory !== 'All' && docCat !== contentsActiveCategory) return;

      // Filter by search text
      const searchLower = contentsSearchText.toLowerCase();
      const matchTitle = (doc.title || '').toLowerCase().includes(searchLower);
      const matchText = (doc.text || '').toLowerCase().includes(searchLower);
      if (contentsSearchText && !matchTitle && !matchText) return;

      const p = document.createElement('p');
      p.textContent = getPrefix(displayedCount) + doc.title;
      p.setAttribute('data-idx', idx); // Map back to original document index
      contentContainer.appendChild(p);

      displayedCount++;
    });

    if (displayedCount === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'No matching documents found.';
      emptyMsg.style.fontStyle = 'italic';
      emptyMsg.style.opacity = '0.5';
      contentContainer.appendChild(emptyMsg);
    }
  }

  // 3. Render all other papers (PDFs, Presentations, Videos) statically
  function renderStaticPapers() {
    Object.keys(documentsData).forEach(paperId => {
      if (paperId === 'settings' || paperId === 'contents-paper') return;

      const paperEl = document.getElementById(paperId);
      if (!paperEl) return;

      const contentContainer = paperEl.querySelector('.paper-content');
      if (!contentContainer) return;

      contentContainer.innerHTML = '';

      // Special handling for the PDF Library page — aggregate ALL pdfs from ALL sections
      if (paperId === 'pdfs-paper') {
        let pdfIndex = 0;
        let displayedCount = 0;
        const searchLower = pdfsSearchText.toLowerCase();

        // First render docs that live directly in pdfs-paper
        (documentsData['pdfs-paper'] || []).forEach((doc, idx) => {
          const matchTitle = (doc.title || '').toLowerCase().includes(searchLower);
          const matchText = (doc.text || '').toLowerCase().includes(searchLower);
          if (pdfsSearchText && !matchTitle && !matchText) return;

          const p = document.createElement('p');
          p.textContent = '📄 ' + doc.title;
          p.setAttribute('data-idx', idx);
          contentContainer.appendChild(p);
          displayedCount++;
        });

        // Then aggregate PDF attachments from every other section
        Object.keys(documentsData).forEach(section => {
          if (section === 'settings') return;
          const docs = documentsData[section] || [];
          
          docs.forEach(doc => {
            if (doc.pdfs && doc.pdfs.length) {
              doc.pdfs.forEach((src, i) => {
                pdfIndex++;
                const fileName = src.split('/').pop() || `Document_${pdfIndex}.pdf`;
                
                // Match against filename, parent doc title, parent doc text
                const matchFileName = fileName.toLowerCase().includes(searchLower);
                const matchParentTitle = (doc.title || '').toLowerCase().includes(searchLower);
                const matchParentShortTitle = (doc.shortTitle || '').toLowerCase().includes(searchLower);
                const matchParentText = (doc.text || '').toLowerCase().includes(searchLower);

                if (pdfsSearchText && !matchFileName && !matchParentTitle && !matchParentShortTitle && !matchParentText) {
                  return;
                }

                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'margin: 12px 0; display: flex; flex-direction: column; align-items: center; overflow: hidden;';
                wrapper.innerHTML = `
                  <button class="pdf-open-modal-btn highlight" data-src="${src}" style="background-color: #f4f0e6; border: 2px dashed #543619; color: #543619; cursor: pointer; padding: 12px 15px; font-family: 'Special Elite', monospace; font-size: 1.1rem; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 2px 4px 0px rgba(84, 54, 25, 0.2); border-radius: 4px; display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; text-align: left; overflow: hidden;">
                    <span style="font-size: 1.6rem; flex-shrink: 0;">📄</span>
                    <div style="overflow: hidden; text-overflow: ellipsis; min-width: 0;">
                      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</div>
                      <div style="font-size: 0.8rem; opacity: 0.5; font-family: 'Patrick Hand', cursive; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">From: ${doc.title || doc.shortTitle || 'Unknown'}</div>
                    </div>
                  </button>
                `;
                contentContainer.appendChild(wrapper);
                displayedCount++;
              });
            }
          });
        });

        if (displayedCount === 0) {
          const emptyMsg = document.createElement('p');
          emptyMsg.textContent = pdfsSearchText ? 'No matching PDFs found.' : 'No PDFs uploaded yet.';
          emptyMsg.style.fontStyle = 'italic';
          emptyMsg.style.opacity = '0.5';
          contentContainer.appendChild(emptyMsg);
        }

        return; // Skip default rendering for pdfs-paper
      }

      // Default rendering for presentations & videos
      const getPrefix = prefixes[paperId] || (() => '');

      (documentsData[paperId] || []).forEach((doc, idx) => {
        const p = document.createElement('p');
        p.textContent = getPrefix(idx) + doc.title;
        p.setAttribute('data-idx', idx);
        contentContainer.appendChild(p);
      });
    });
  }

  // Initial load execution
  renderContentsCategories();
  renderContentsList();
  renderStaticPapers();

  // Setup search input listener
  const searchInput = document.getElementById('contents-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      contentsSearchText = e.target.value;
      renderContentsList();
    });
    // Prevent clicks on the input from bubbling to page-turn
    searchInput.addEventListener('click', (e) => e.stopPropagation());
    searchInput.addEventListener('focus', (e) => e.stopPropagation());
  }

  // Setup PDF search input listener
  const pdfsSearchInput = document.getElementById('pdfs-search');
  if (pdfsSearchInput) {
    pdfsSearchInput.addEventListener('input', (e) => {
      pdfsSearchText = e.target.value;
      renderStaticPapers();
    });
    // Prevent clicks on the input from bubbling to page-turn
    pdfsSearchInput.addEventListener('click', (e) => e.stopPropagation());
    pdfsSearchInput.addEventListener('focus', (e) => e.stopPropagation());
  }

  // 4. Attach delegating click listeners to paper contents
  document.querySelectorAll('.paper-content').forEach((container) => {
    container.addEventListener('click', (e) => {
      const docLink = e.target.closest('p');
      if (!docLink || docLink.style.fontStyle === 'italic') return; // Skip empty message paragraphs
      e.preventDefault();

      const activePaper = docLink.closest('.top-paper');
      if (!activePaper) return;
      const paperId = activePaper.id;

      currentSectionDocs = documentsData[paperId] || [];
      if (currentSectionDocs.length === 0) return;

      const originalIdx = parseInt(docLink.getAttribute('data-idx'));
      if (isNaN(originalIdx)) return;

      // Clean sidebar and build the new minimized pages
      parchmentSidebar.innerHTML = '';
      currentSectionDocs.forEach((doc, idx) => {
        const miniPage = document.createElement('div');
        miniPage.className = 'mini-page';
        miniPage.setAttribute('data-index', idx);
        miniPage.setAttribute('title', doc.title);
        miniPage.innerHTML = `<span class="mini-title">${doc.shortTitle}</span>`;

        miniPage.addEventListener('click', () => {
          document.querySelectorAll('.mini-page').forEach(el => el.classList.remove('active'));
          miniPage.classList.add('active');
          loadDocumentContent(doc);
        });

        parchmentSidebar.appendChild(miniPage);
      });

      // Highlight active mini-page and load content
      const activeMiniPage = parchmentSidebar.children[originalIdx] || parchmentSidebar.children[0];
      if (activeMiniPage) {
        activeMiniPage.classList.add('active');
      }
      loadDocumentContent(currentSectionDocs[originalIdx] || currentSectionDocs[0]);

      // Show the overlay
      parchmentView.classList.remove('hidden');

      // Reset sidebar scroll offset to top for each new folder
      parchmentView.dispatchEvent(new Event('sidebar-rebuilt'));
    });
  });

  // Close parchment view
  closeParchmentBtn.addEventListener('click', () => {
    parchmentView.classList.add('hidden');
  });

  // Close if clicking on the dark background outside the parchment
  parchmentView.addEventListener('click', (e) => {
    if (e.target === parchmentView) {
      parchmentView.classList.add('hidden');
    }
  });

  // ─── Frameless JS Transform Scroll for the Sidebar ───────────────────────
  // The sidebar is overflow:visible so SVG filter edges never get clipped by a
  // scroll container box. Instead we track a sidebarOffset and move the sidebar
  // using transform: translateY() — completely frameless, zero visible UI.
  let sidebarOffset = 0;

  function getSidebarMaxScroll() {
    const sidebarHeight = parchmentSidebar.scrollHeight;
    const overlayHeight = parchmentView.clientHeight;
    // 80% of viewport minus some padding is the visible area for the sidebar
    const visibleArea = overlayHeight * 0.8 - 40;
    return Math.max(0, sidebarHeight - visibleArea);
  }

  function applySidebarScroll(delta) {
    const max = getSidebarMaxScroll();
    sidebarOffset = Math.min(max, Math.max(0, sidebarOffset + delta));
    parchmentSidebar.style.transform = `translateY(-${sidebarOffset}px)`;
  }

  // Wheel scroll on the left side of the overlay (where sidebar lives)
  parchmentView.addEventListener('wheel', (e) => {
    const sidebarRect = parchmentSidebar.getBoundingClientRect();
    // Only intercept if mouse is within the sidebar's horizontal area
    if (e.clientX < sidebarRect.right + 40) {
      e.preventDefault();
      applySidebarScroll(e.deltaY * 0.6);
    }
  }, { passive: false });

  // Touch scroll support for mobile sidebar (horizontal on mobile, so skip)
  let touchStartY = 0;
  parchmentView.addEventListener('touchstart', (e) => {
    const sidebarRect = parchmentSidebar.getBoundingClientRect();
    const touch = e.touches[0];
    if (touch.clientX < sidebarRect.right + 40) {
      touchStartY = touch.clientY;
    }
  }, { passive: true });

  parchmentView.addEventListener('touchmove', (e) => {
    const sidebarRect = parchmentSidebar.getBoundingClientRect();
    const touch = e.touches[0];
    if (touch.clientX < sidebarRect.right + 40) {
      const delta = touchStartY - touch.clientY;
      touchStartY = touch.clientY;
      applySidebarScroll(delta);
    }
  }, { passive: true });

  // Reset scroll position whenever the sidebar is rebuilt for a new folder
  function resetSidebarScroll() {
    sidebarOffset = 0;
    parchmentSidebar.style.transform = 'translateY(0)';
  }
  // Patch the existing sidebar build — call reset after building
  const _origBuildSidebar = () => {};
  parchmentView.addEventListener('sidebar-rebuilt', resetSidebarScroll);

  // ─── PDF Modal & Download Animation Logic ────────────────────────────────
  const pdfModal = document.getElementById('pdf-modal');
  const closePdfModalBtn = document.getElementById('close-pdf-modal');
  const pdfModalEmbed = document.getElementById('pdf-modal-embed');
  const pdfModalDownloadBtn = document.getElementById('pdf-modal-download-btn');
  let currentPdfSrc = '';

  document.addEventListener('click', (e) => {
    // Open PDF Modal
    const openBtn = e.target.closest('.pdf-open-modal-btn');
    if (openBtn) {
      currentPdfSrc = openBtn.getAttribute('data-src');
      if(pdfModalEmbed) pdfModalEmbed.src = currentPdfSrc;
      if(pdfModal) pdfModal.classList.remove('hidden');
    }

    // Download Animation in PDF Modal
    const dlBtn = e.target.closest('#pdf-modal-download-btn');
    if (dlBtn && !dlBtn.disabled) {
      dlBtn.disabled = true;
      const span = dlBtn.querySelector('span');
      
      // Phase 1: Glitch / Prep
      span.innerText = '[ DECRYPTING... ]';
      dlBtn.style.backgroundColor = '#111';
      dlBtn.style.color = '#0f0';
      dlBtn.style.transform = 'scale(0.95)';
      dlBtn.style.boxShadow = '1px 1px 0 #543619';
      
      setTimeout(() => {
        // Phase 2: Success
        span.innerText = '[ ACQUIRED ]';
        dlBtn.style.backgroundColor = '#dfff22';
        dlBtn.style.color = '#111';
        dlBtn.style.transform = 'scale(1.1)';
        dlBtn.style.boxShadow = '4px 6px 0 #543619';
        
        // Trigger actual download
        const a = document.createElement('a');
        a.href = currentPdfSrc;
        a.download = currentPdfSrc.split('/').pop() || 'classified_document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Reset
        setTimeout(() => {
          span.innerText = '[ EXFILTRATE DATA ]';
          dlBtn.style.backgroundColor = '#ff5722';
          dlBtn.style.color = 'white';
          dlBtn.style.transform = 'scale(1)';
          dlBtn.style.boxShadow = '4px 6px 0 #543619';
          dlBtn.disabled = false;
        }, 2000);
      }, 1000);
    }
  });

  if (closePdfModalBtn) {
    closePdfModalBtn.addEventListener('click', () => {
      pdfModal.classList.add('hidden');
      setTimeout(() => { pdfModalEmbed.src = ''; }, 300); // clear after animation
    });
  }

  // ─── Interactive Sticky Notes Zoom & Turn ────────────────────────────────
  const stickyZoomModal = document.getElementById('sticky-zoom-modal');
  const zoomedStickyContainer = document.getElementById('zoomed-sticky-container');
  
  if (stickyZoomModal && zoomedStickyContainer) {
    document.addEventListener('click', (e) => {
      // Open in zoom modal when a sticky note is clicked
      const stickyWrapper = e.target.closest('.sticky-note-wrapper');
      
      // If we clicked a sticky note AND we are NOT already inside the zoom modal
      if (stickyWrapper && !stickyWrapper.closest('#sticky-zoom-modal')) {
        e.preventDefault();
        e.stopPropagation();
        
        // Clone the sticky note
        const clone = stickyWrapper.cloneNode(true);
        // Override hover styles and setup scale
        clone.style.transform = 'scale(2.5) rotate(0deg)';
        clone.style.transition = 'none';
        clone.style.pointerEvents = 'none'; // let the container handle clicks
        
        zoomedStickyContainer.innerHTML = '';
        zoomedStickyContainer.appendChild(clone);
        
        // Setup initial flip state
        zoomedStickyContainer.dataset.rot = '0';
        zoomedStickyContainer.style.transform = 'rotateY(0deg) rotateZ(0deg)';
        
        stickyZoomModal.classList.remove('hidden');
      }
    });

    stickyZoomModal.addEventListener('click', (e) => {
      // If clicked exactly on the note container, turn/flip it
      if (e.target.closest('#zoomed-sticky-container')) {
        e.stopPropagation();
        let currentRot = parseInt(zoomedStickyContainer.dataset.rot || '0');
        // Rotate randomly between 15 and 45 degrees + flip Y
        currentRot += 180;
        const randomZ = (Math.random() * 20) - 10;
        zoomedStickyContainer.style.transform = `rotateY(${currentRot}deg) rotateZ(${randomZ}deg)`;
        zoomedStickyContainer.dataset.rot = currentRot.toString();
      } else {
        // Clicked outside the note, close it
        stickyZoomModal.classList.add('hidden');
      }
    });
  }

  // ─── Interactive Image Details Modal ───────────────────────────────────────
  const imageZoomModal = document.getElementById('image-zoom-modal');
  const zoomedImageEl = document.getElementById('zoomed-image-el');
  const zoomedImageTitle = document.getElementById('zoomed-image-title');
  const zoomedImageText = document.getElementById('zoomed-image-text');
  
  if (imageZoomModal && zoomedImageEl) {
    document.addEventListener('click', (e) => {
      const imgTarget = e.target.closest('.embedded-image, .polaroid-img');
      
      if (imgTarget && !imgTarget.closest('#image-zoom-modal')) {
        e.preventDefault();
        e.stopPropagation();
        
        const imgSrc = imgTarget.getAttribute('src');
        zoomedImageEl.src = imgSrc;
        
        // Find the document that owns this image to show details
        let foundDoc = null;
        Object.keys(documentsData).forEach(section => {
          if (section === 'settings') return;
          const docs = documentsData[section] || [];
          docs.forEach(d => {
            if (d.images && d.images.includes(imgSrc)) {
              foundDoc = d;
            }
          });
        });
        
        if (foundDoc) {
          zoomedImageTitle.textContent = foundDoc.title || 'Attached Image';
          let rawText = foundDoc.text || '';
          let formattedText = rawText;
          if (!/<(br|p|div|h[1-6]|ul|ol|li)[> ]/i.test(rawText)) {
            formattedText = rawText.replace(/\n/g, '<br>');
          }
          zoomedImageText.innerHTML = formattedText;
        } else {
          zoomedImageTitle.textContent = 'Image Details';
          zoomedImageText.innerHTML = '';
        }
        
        imageZoomModal.classList.remove('hidden');
      }
    });

    imageZoomModal.addEventListener('click', (e) => {
      imageZoomModal.classList.add('hidden');
    });
    
    // Prevent closing when clicking inside the text details area or image so user can scroll/select text
    const zoomedImageDetails = document.getElementById('zoomed-image-details');
    const zoomedImageContainer = document.getElementById('zoomed-image-container');
    if (zoomedImageDetails) {
      zoomedImageDetails.addEventListener('click', (e) => e.stopPropagation());
    }
    if (zoomedImageContainer) {
      zoomedImageContainer.addEventListener('click', (e) => e.stopPropagation());
    }
  }

  // ─── Action Modal Logic ──────────────────────────────────────────────────
  const actionModalBtn = document.getElementById('actionModalBtn');
  const actionModal = document.getElementById('action-modal');
  const closeActionModalBtn = document.getElementById('close-action-modal');
  
  if (actionModalBtn && actionModal) {
    actionModalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      const allVoiceNotesContainer = document.getElementById('all-voice-notes');
      const allStickyNotesContainer = document.getElementById('all-sticky-notes');
      
      allVoiceNotesContainer.innerHTML = '';
      allStickyNotesContainer.innerHTML = '';
      
      let hasVoice = false;
      let hasSticky = false;
      
      // Aggregate all voice and sticky notes from documentsData
      Object.keys(documentsData).forEach(section => {
        if (section === 'settings') return;
        const docs = documentsData[section] || [];
        
        docs.forEach(doc => {
          if (doc.voiceNotes && doc.voiceNotes.length) {
            hasVoice = true;
            doc.voiceNotes.forEach((src, i) => {
              allVoiceNotesContainer.innerHTML += `
                <div style="margin-bottom: 15px; background: rgba(0,0,0,0.03); padding: 15px; border-radius: 8px;">
                  <p class="handwritten" style="margin-bottom: 8px; font-weight: bold;">From: ${doc.title}</p>
                  <div class="audio-controls-wrapper" style="display: flex; flex-direction: column; gap: 8px;">
                    <audio controls style="width: 100%; max-width: 400px;">
                      <source src="${src}" type="audio/mpeg">
                    </audio>
                    <div style="display: flex; gap: 10px; font-family: 'Patrick Hand', cursive; font-size: 0.9rem; align-items: center;">
                      <span style="opacity:0.7">Speed:</span>
                      <button class="audio-speed-btn" data-speed="0.5" style="background:none;border:none;cursor:pointer;color:#543619;">0.5x</button>
                      <button class="audio-speed-btn" data-speed="1" style="background:none;border:none;cursor:pointer;font-weight:bold;color:#543619;text-decoration:underline;">1x</button>
                      <button class="audio-speed-btn" data-speed="1.5" style="background:none;border:none;cursor:pointer;color:#543619;">1.5x</button>
                      <button class="audio-speed-btn" data-speed="2" style="background:none;border:none;cursor:pointer;color:#543619;">2x</button>
                    </div>
                  </div>
                </div>
              `;
            });
          }
          
          if (doc.stickyNotes && doc.stickyNotes.length) {
            hasSticky = true;
            doc.stickyNotes.forEach((note, i) => {
              const text = typeof note === 'string' ? note : note.text;
              const color = typeof note === 'string' ? '#fff8a6' : note.color;
              const bgImage = typeof note === 'object' ? note.bgImage : null;
              const inlineImage = typeof note === 'object' ? note.inlineImage : null;
              const rot = (Math.random() * 6) - 3;
              
              let bgStyle = `background-color: ${color};`;
              let inlineImgHtml = inlineImage ? `<img src="${inlineImage}" style="max-width: 80%; max-height: 60px; border-radius: 4px; margin-top: 6px; border: 1px solid rgba(0,0,0,0.1); box-shadow: 1px 2px 4px rgba(0,0,0,0.15);">` : '';
              let textContent = `${text.replace(/\n/g, '<br>')}${inlineImgHtml ? '<br>' + inlineImgHtml : ''}`;
              
              let innerHTML = `
                <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; z-index: 10;">${textContent}</div>
                <div style="font-size: 0.9rem; opacity: 0.6; margin-top: 10px; border-top: 1px dashed rgba(0,0,0,0.2); padding-top: 5px; width: 100%; position: relative; z-index: 10;"> - ${doc.shortTitle}</div>
              `;
              
              if (bgImage) {
                innerHTML = `
                  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: url('${bgImage}'); background-size: cover; background-position: center; filter: blur(3px) brightness(0.9); z-index: 1;"></div>
                  <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; z-index: 10; text-shadow: 0 1px 3px rgba(255,255,255,0.8);">${textContent}</div>
                  <div style="font-size: 0.9rem; opacity: 0.6; margin-top: 10px; border-top: 1px dashed rgba(0,0,0,0.2); padding-top: 5px; width: 100%; position: relative; z-index: 10; text-shadow: 0 1px 3px rgba(255,255,255,0.8);"> - ${doc.shortTitle}</div>
                `;
              }

              allStickyNotesContainer.innerHTML += `
                <div class="sticky-note-wrapper" style="transform: rotate(${rot}deg);">
                  <div class="sticky-layer sticky-pink"></div>
                  <div class="sticky-layer sticky-blue"></div>
                  <div class="sticky-layer sticky-yellow" style="${bgStyle} position: relative; overflow: hidden;">
                    ${innerHTML}
                  </div>
                  <div class="sticky-pin"></div>
                </div>
              `;
            });
          }
        });
      });
      
      if (!hasVoice) {
        allVoiceNotesContainer.innerHTML = '<p class="handwritten" style="opacity: 0.6; font-style: italic;">No voice notes found.</p>';
      }
      
      if (!hasSticky) {
        allStickyNotesContainer.innerHTML = '<p class="handwritten" style="opacity: 0.6; font-style: italic;">No sticky notes found.</p>';
      }
      
      actionModal.classList.remove('hidden');
    });
    
    closeActionModalBtn.addEventListener('click', () => {
      actionModal.classList.add('hidden');
      // Pause any playing audio
      const audios = actionModal.querySelectorAll('audio');
      audios.forEach(a => a.pause());
    });
    
    actionModal.addEventListener('click', (e) => {
      if (e.target === actionModal) {
        actionModal.classList.add('hidden');
        // Pause any playing audio
        const audios = actionModal.querySelectorAll('audio');
        audios.forEach(a => a.pause());
      }
    });
  }

  // Audio Speed Tuning Listener
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('audio-speed-btn')) {
      const btn = e.target;
      const speed = parseFloat(btn.dataset.speed);
      const audioEl = btn.closest('.audio-controls-wrapper').querySelector('audio');
      
      if (audioEl) {
        audioEl.playbackRate = speed;
        
        // Update UI styles
        const allBtns = btn.closest('.audio-controls-wrapper').querySelectorAll('.audio-speed-btn');
        allBtns.forEach(b => {
          b.style.fontWeight = 'normal';
          b.style.textDecoration = 'none';
        });
        
        btn.style.fontWeight = 'bold';
        btn.style.textDecoration = 'underline';
      }
    }
  });

  // ─── Intro Letter Animation ──────────────────────────────────────────────
  const introOverlay = document.getElementById('intro-overlay');
  const envelopeContainer = document.getElementById('envelope-container');
  const introLetter = document.getElementById('intro-letter');
  const enterSiteBtn = document.getElementById('enter-site-btn');
  
  function playEnvelopeSound() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1; 
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.3);
    filter.Q.value = 1.5;
    
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.1); 
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4); 
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    noise.start();
  }

  if (introOverlay && !localStorage.getItem('anarchyIntroSeen')) {
    introOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Step 1: Unfold crumpled paper
    envelopeContainer.addEventListener('click', (e) => {
      if (!envelopeContainer.classList.contains('is-open')) {
        e.stopPropagation();
        playEnvelopeSound();
        envelopeContainer.classList.add('is-open');
        
        // Allow letter to be clicked after the unfold animation completes
        setTimeout(() => {
          introLetter.style.cursor = 'pointer';
        }, 1800);
      }
    });
    
    // Step 2: Read Letter
    introLetter.addEventListener('click', (e) => {
      if (envelopeContainer.classList.contains('is-open') && !envelopeContainer.classList.contains('is-read')) {
        e.stopPropagation();
        playPaperSound();
        envelopeContainer.classList.add('is-read');
      }
    });
    
    // Step 3: Enter Site
    enterSiteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playPaperSound();
      localStorage.setItem('anarchyIntroSeen', 'true');
      document.body.style.overflow = '';

      // Fade out the overlay
      introOverlay.classList.add('hidden');

      // After the CSS fade transition (0.8s), fully remove it from layout
      introOverlay.addEventListener('transitionend', () => {
        introOverlay.classList.add('gone');
      }, { once: true });
    });
  } else if (introOverlay) {
    introOverlay.style.display = 'none';
  }
});
