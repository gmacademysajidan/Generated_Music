document.addEventListener('DOMContentLoaded', () => {
  const urlForm = document.getElementById('urlForm');
  const urlInput = document.getElementById('urlInput');
  const fetchBtn = document.getElementById('fetchBtn');
  const pasteBtn = document.getElementById('pasteBtn');
  const clearBtn = document.getElementById('clearBtn');
  const alertBox = document.getElementById('alertBox');
  const resultSection = document.getElementById('resultSection');

  // Media elements
  const mediaThumb = document.getElementById('mediaThumb');
  const mediaDuration = document.getElementById('mediaDuration');
  const mediaTitle = document.getElementById('mediaTitle');
  const mediaAuthor = document.querySelector('#mediaAuthor span');
  const mediaViews = document.getElementById('mediaViews');

  // Quality & download elements
  const qualityCards = document.querySelectorAll('.quality-card');
  const downloadBtn = document.getElementById('downloadBtn');
  const progressContainer = document.getElementById('progressContainer');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');

  let currentVideoData = null;

  // Toggle clear button
  urlInput.addEventListener('input', () => {
    if (urlInput.value.trim().length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  });

  // Clear button click
  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearBtn.classList.add('hidden');
    urlInput.focus();
  });

  // Paste from clipboard
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text.trim();
        clearBtn.classList.remove('hidden');
        triggerFetch();
      }
    } catch (err) {
      showAlert('Gagal membaca clipboard. Silakan paste secara manual (Ctrl+V).', 'error');
    }
  });

  // Quality cards selection
  qualityCards.forEach(card => {
    card.addEventListener('click', () => {
      qualityCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Handle Form Submit
  urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    triggerFetch();
  });

  // Function to show alerts
  function showAlert(message, type = 'error') {
    alertBox.className = `alert-box ${type === 'success' ? 'success' : ''}`;
    alertBox.querySelector('.alert-text').textContent = message;
    alertBox.classList.remove('hidden');
  }

  function hideAlert() {
    alertBox.classList.add('hidden');
  }

  // Set loading state on fetch button
  function setFetchLoading(isLoading) {
    const btnText = fetchBtn.querySelector('.btn-text');
    const btnLoader = fetchBtn.querySelector('.btn-loader');
    if (isLoading) {
      fetchBtn.disabled = true;
      btnText.classList.add('hidden');
      btnLoader.classList.remove('hidden');
    } else {
      fetchBtn.disabled = false;
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
    }
  }

  // Format Duration seconds to MM:SS or HH:MM:SS
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

  // Format views
  function formatViews(views) {
    if (!views || isNaN(views)) return '0 views';
    if (views >= 1000000) {
      return (views / 1000000).toFixed(1) + 'M views';
    } else if (views >= 1000) {
      return (views / 1000).toFixed(1) + 'K views';
    }
    return views.toLocaleString() + ' views';
  }

  // Trigger Fetch Video Info
  async function triggerFetch() {
    const url = urlInput.value.trim();
    if (!url) {
      showAlert('Silakan masukkan link video YouTube terlebih dahulu!');
      return;
    }

    hideAlert();
    resultSection.classList.add('hidden');
    progressContainer.classList.add('hidden');
    setFetchLoading(true);

    try {
      const response = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengambil informasi video YouTube.');
      }

      currentVideoData = data.data;

      // Populate UI
      mediaTitle.textContent = currentVideoData.title;
      mediaAuthor.textContent = currentVideoData.channel || 'YouTube Creator';
      mediaDuration.textContent = formatDuration(currentVideoData.duration);
      mediaViews.innerHTML = `<i class="fa-solid fa-eye"></i> ${formatViews(currentVideoData.views)}`;
      mediaThumb.src = currentVideoData.thumbnail || 'https://via.placeholder.com/320x180?text=No+Thumbnail';

      // Show Result Section
      resultSection.classList.remove('hidden');
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      showAlert(err.message || 'Terjadi kesalahan saat memproses link YouTube.');
    } finally {
      setFetchLoading(false);
    }
  }

  // Handle Download Button
  downloadBtn.addEventListener('click', async () => {
    if (!currentVideoData) {
      showAlert('Data video tidak ditemukan. Silakan cek link lagi.');
      return;
    }

    const selectedQuality = document.querySelector('input[name="audioQuality"]:checked')?.value || '320';

    hideAlert();
    downloadBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    progressText.innerHTML = `<i class="fa-solid fa-gear fa-spin"></i> Mengunduh & mengonversi audio ke MP3 (${selectedQuality} kbps)...`;
    progressPercent.textContent = 'Harap tunggu, proses konversi sedang berjalan...';

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentVideoData.webpage_url || urlInput.value.trim(),
          quality: selectedQuality,
          title: currentVideoData.title
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengunduh dan mengonversi audio.');
      }

      // Read filename from content-disposition header if available
      let filename = `${currentVideoData.title}.mp3`;
      const disposition = response.headers.get('Content-Disposition');
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      // Clean filename for safety
      filename = filename.replace(/[<>:"/\\|?*]+/g, '');

      progressText.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Konversi selesai! Menyimpan file...`;
      progressPercent.textContent = '100%';

      // Create download blob
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

      showAlert(`Berhasil mengunduh "${filename}"!`, 'success');

    } catch (err) {
      showAlert(err.message || 'Terjadi kesalahan saat mengunduh lagu.');
    } finally {
      downloadBtn.disabled = false;
      setTimeout(() => {
        progressContainer.classList.add('hidden');
      }, 5000);
    }
  });
});
