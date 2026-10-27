document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const urlForm = document.getElementById('urlForm');
  const urlInput = document.getElementById('urlInput');
  const fetchBtn = document.getElementById('fetchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const pasteBtn = document.getElementById('pasteBtn');
  const toastBox = document.getElementById('toastBox');
  const toastMessage = document.getElementById('toastMessage');
  const closeToast = document.getElementById('closeToast');
  const sampleTags = document.querySelectorAll('.sample-tag');

  // Result Area
  const resultSection = document.getElementById('resultSection');
  const mediaThumb = document.getElementById('mediaThumb');
  const mediaDuration = document.getElementById('mediaDuration');
  const mediaTitle = document.getElementById('mediaTitle');
  const mediaAuthor = document.getElementById('mediaAuthor');
  const mediaViews = document.getElementById('mediaViews');

  // Quality Tiers & Download
  const qualityTiers = document.querySelectorAll('.quality-tier');
  const downloadBtn = document.getElementById('downloadBtn');
  const downloadSelectedLabel = document.getElementById('downloadSelectedLabel');
  const progressContainer = document.getElementById('progressContainer');
  const progressStatusTitle = document.getElementById('progressStatusTitle');
  const progressStatusDesc = document.getElementById('progressStatusDesc');

  // History Section
  const historySection = document.getElementById('historySection');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  let currentVideoData = null;
  let toastTimer = null;

  // Quality details mapping
  const qualityLabels = {
    '320': 'Kualitas: 320 kbps Ultra HD (Studio Master)',
    '256': 'Kualitas: 256 kbps Pro High (Stereo)',
    '192': 'Kualitas: 192 kbps Standar (Balanced)',
    '128': 'Kualitas: 128 kbps Ringan (Economy Lite)'
  };

  // 1. Initial History Load
  renderHistory();

  // 2. Clear & Input Listener
  urlInput.addEventListener('input', () => {
    if (urlInput.value.trim().length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  });

  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearBtn.classList.add('hidden');
    urlInput.focus();
  });

  // 3. Paste Button with Auto-Analysis
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        urlInput.value = text.trim();
        clearBtn.classList.remove('hidden');
        showToast('Link berhasil ditempel dari clipboard!', 'success');
        triggerFetch();
      } else {
        showToast('Clipboard Anda kosong.', 'error');
      }
    } catch (err) {
      showToast('Silakan gunakan pintasan Ctrl + V untuk menempel link.', 'error');
      urlInput.focus();
    }
  });

  // 4. Quick Sample Chips
  sampleTags.forEach(tag => {
    tag.addEventListener('click', () => {
      const sampleUrl = tag.getAttribute('data-url');
      if (sampleUrl) {
        urlInput.value = sampleUrl;
        clearBtn.classList.remove('hidden');
        triggerFetch();
      }
    });
  });

  // 5. Toast Notification System
  function showToast(message, type = 'error') {
    if (toastTimer) clearTimeout(toastTimer);
    toastBox.className = `studio-toast ${type === 'success' ? 'success' : ''}`;
    toastMessage.textContent = message;
    toastBox.classList.remove('hidden');

    toastTimer = setTimeout(() => {
      toastBox.classList.add('hidden');
    }, 5500);
  }

  closeToast.addEventListener('click', () => {
    toastBox.classList.add('hidden');
  });

  // 6. Quality Tier Selection
  qualityTiers.forEach(tier => {
    tier.addEventListener('click', () => {
      qualityTiers.forEach(t => t.classList.remove('selected'));
      tier.classList.add('selected');
      const radio = tier.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        const val = radio.value;
        if (downloadSelectedLabel && qualityLabels[val]) {
          downloadSelectedLabel.textContent = qualityLabels[val];
        }
      }
    });
  });

  // 7. Form Submit
  urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    triggerFetch();
  });

  // 8. Fetch Video Information
  async function triggerFetch() {
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      showToast('Silakan masukkan link video YouTube terlebih dahulu!');
      return;
    }

    // Toggle button state
    setFetchLoading(true);
    toastBox.classList.add('hidden');
    resultSection.classList.add('hidden');
    progressContainer.classList.add('hidden');

    try {
      const response = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal memproses link YouTube tersebut.');
      }

      currentVideoData = result.data;

      // Update Card Fields
      mediaTitle.textContent = currentVideoData.title;
      mediaAuthor.textContent = currentVideoData.channel || 'YouTube Creator';
      mediaDuration.textContent = formatDuration(currentVideoData.duration);
      mediaViews.innerHTML = `<i class="fa-regular fa-eye"></i> ${formatViews(currentVideoData.views)}`;
      mediaThumb.src = currentVideoData.thumbnail || 'https://via.placeholder.com/320x180?text=Audio+Artwork';

      // Show Result Section with animation
      resultSection.classList.remove('hidden');
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      showToast(err.message || 'Terjadi kesalahan teknis saat menghubungi server.');
    } finally {
      setFetchLoading(false);
    }
  }

  function setFetchLoading(isLoading) {
    const btnText = fetchBtn.querySelector('.btn-text');
    const btnSpinner = fetchBtn.querySelector('.btn-spinner');
    if (isLoading) {
      fetchBtn.disabled = true;
      btnText.classList.add('hidden');
      btnSpinner.classList.remove('hidden');
    } else {
      fetchBtn.disabled = false;
      btnText.classList.remove('hidden');
      btnSpinner.classList.add('hidden');
    }
  }

  // 9. Download & Convert Handler
  downloadBtn.addEventListener('click', async () => {
    if (!currentVideoData) {
      showToast('Data lagu belum siap. Silakan analisis link terlebih dahulu.');
      return;
    }

    const selectedTier = document.querySelector('input[name="audioQuality"]:checked')?.value || '320';

    downloadBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    progressStatusTitle.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengunduh & Mengekstrak Audio (${selectedTier} kbps)...`;
    progressStatusDesc.textContent = 'Engine FFmpeg sedang mengonversi stream ke format MP3 murni...';

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentVideoData.webpage_url || urlInput.value.trim(),
          quality: selectedTier,
          title: currentVideoData.title
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal melakukan konversi MP3.');
      }

      // Read output filename from headers
      let filename = `${currentVideoData.title} [${selectedTier}kbps].mp3`;
      const disposition = response.headers.get('Content-Disposition');
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      filename = filename.replace(/[<>:"/\\|?*]+/g, '');

      progressStatusTitle.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Konversi Berhasil!`;
      progressStatusDesc.textContent = `Menyimpan file ${filename} ke perangkat Anda...`;

      // Trigger automatic browser download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();

      showToast(`Berhasil mengunduh "${currentVideoData.title}" dalam format MP3!`, 'success');

      // Save to History
      saveToHistory({
        title: currentVideoData.title,
        quality: `${selectedTier} kbps`,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

    } catch (err) {
      showToast(err.message || 'Gagal memproses download lagu.');
    } finally {
      downloadBtn.disabled = false;
      setTimeout(() => {
        progressContainer.classList.add('hidden');
      }, 4500);
    }
  });

  // 10. History Storage
  function getHistory() {
    try {
      return JSON.parse(sessionStorage.getItem('aura_music_history') || '[]');
    } catch {
      return [];
    }
  }

  function saveToHistory(item) {
    const list = getHistory();
    list.unshift(item);
    if (list.length > 5) list.pop();
    sessionStorage.setItem('aura_music_history', JSON.stringify(list));
    renderHistory();
  }

  function renderHistory() {
    const list = getHistory();
    if (!list || list.length === 0) {
      historySection.classList.add('hidden');
      return;
    }

    historyList.innerHTML = list.map(item => `
      <div class="history-item">
        <div class="history-item-left">
          <i class="fa-solid fa-circle-check"></i>
          <span class="history-track-title">${escapeHtml(item.title)}</span>
        </div>
        <div class="history-badge">${item.quality} • ${item.date}</div>
      </div>
    `).join('');

    historySection.classList.remove('hidden');
  }

  clearHistoryBtn.addEventListener('click', () => {
    sessionStorage.removeItem('aura_music_history');
    renderHistory();
  });

  // Helpers
  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function formatViews(views) {
    if (!views || isNaN(views)) return '0 views';
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M views';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K views';
    return Number(views).toLocaleString() + ' views';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
