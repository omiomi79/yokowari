// ヨコ割り — 画像を横に3・4分割してダウンロード（全てブラウザ内で処理）

(() => {
  'use strict';

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const workspace = document.getElementById('workspace');
  const previewCanvas = document.getElementById('preview-canvas');
  const piecesEl = document.getElementById('pieces');
  const srcInfoEl = document.getElementById('src-info');
  const pieceInfoEl = document.getElementById('piece-info');
  const warningEl = document.getElementById('warning');
  const downloadAllBtn = document.getElementById('download-all');
  const resetBtn = document.getElementById('reset-btn');

  const state = {
    img: null,        // HTMLImageElement
    baseName: 'image',
    split: 3,
    format: 'jpeg',   // 'jpeg' | 'png'
  };

  const PREVIEW_MAX_W = 1600;
  const THUMB_MAX_W = 480;
  const JPEG_QUALITY = 0.92;

  // ---------- 画像の読み込み ----------

  function loadFile(file) {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      showWarning('PNG・JPEG・WebP の画像を選んでください。');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      state.img = img;
      state.baseName = (file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
      dropzone.hidden = true;
      workspace.hidden = false;
      render();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showWarning('画像を読み込めませんでした。別のファイルで試してください。');
    };
    img.src = url;
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

  ['dragover', 'dragenter'].forEach((type) => {
    dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach((type) => {
    dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    loadFile(e.dataTransfer.files[0]);
  });

  window.addEventListener('paste', (e) => {
    if (!e.clipboardData) return;
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        loadFile(item.getAsFile());
        return;
      }
    }
  });

  resetBtn.addEventListener('click', () => {
    state.img = null;
    fileInput.value = '';
    workspace.hidden = true;
    dropzone.hidden = false;
    hideWarning();
  });

  // ---------- コントロール ----------

  function bindSegmented(attr, onChange) {
    const buttons = document.querySelectorAll(`.seg-btn[data-${attr}]`);
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-checked', String(active));
        });
        onChange(btn.dataset[attr]);
      });
    });
  }

  bindSegmented('split', (v) => {
    state.split = Number(v);
    render();
  });
  bindSegmented('format', (v) => {
    state.format = v;
    render();
  });

  // ---------- 分割の計算 ----------

  // 幅を n 等分。割り切れない余りは左のピースから 1px ずつ配る
  function computePieces(width, n) {
    const base = Math.floor(width / n);
    const remainder = width - base * n;
    const pieces = [];
    let x = 0;
    for (let i = 0; i < n; i++) {
      const w = base + (i < remainder ? 1 : 0);
      pieces.push({ x, w });
      x += w;
    }
    return pieces;
  }

  // ---------- 描画 ----------

  function render() {
    const { img, split } = state;
    if (!img) return;
    hideWarning();

    const pieces = computePieces(img.naturalWidth, split);

    renderPreview(img, pieces);
    renderPieceCards(img, pieces);

    srcInfoEl.textContent = `元画像: ${img.naturalWidth} x ${img.naturalHeight}px`;
    const widths = [...new Set(pieces.map((p) => p.w))].join(' / ');
    pieceInfoEl.textContent = `1枚あたり: ${widths} x ${img.naturalHeight}px`;

    if (img.naturalWidth / split < 300) {
      showWarning('1枚あたりの幅がかなり小さくなります。横長の画像で使うときれいに仕上がります。');
    }
  }

  function renderPreview(img, pieces) {
    const scale = Math.min(1, PREVIEW_MAX_W / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    previewCanvas.width = w;
    previewCanvas.height = h;

    const ctx = previewCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // カットガイド（黄色の破線）と番号
    const guide = '#e8c547';
    ctx.save();
    ctx.strokeStyle = guide;
    ctx.lineWidth = Math.max(2, w / 500);
    ctx.setLineDash([12, 8]);
    for (let i = 1; i < pieces.length; i++) {
      const x = Math.round(pieces[i].x * scale) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.restore();

    const fontSize = Math.max(16, Math.round(w / 30));
    ctx.font = `700 ${fontSize}px Consolas, monospace`;
    ctx.textBaseline = 'top';
    pieces.forEach((p, i) => {
      const label = String(i + 1);
      const lx = Math.round(p.x * scale) + fontSize * 0.6;
      const ly = fontSize * 0.5;
      const pad = fontSize * 0.35;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(19, 21, 19, 0.75)';
      ctx.fillRect(lx - pad, ly - pad, tw + pad * 2, fontSize + pad * 2);
      ctx.fillStyle = guide;
      ctx.fillText(label, lx, ly);
    });
  }

  function renderPieceCards(img, pieces) {
    piecesEl.innerHTML = '';
    const ext = state.format === 'png' ? 'png' : 'jpg';

    pieces.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'piece';

      const thumb = document.createElement('canvas');
      thumb.className = 'piece-thumb';
      const tScale = Math.min(1, THUMB_MAX_W / p.w);
      thumb.width = Math.round(p.w * tScale);
      thumb.height = Math.round(img.naturalHeight * tScale);
      thumb.getContext('2d').drawImage(
        img,
        p.x, 0, p.w, img.naturalHeight,
        0, 0, thumb.width, thumb.height
      );

      const head = document.createElement('div');
      head.className = 'piece-head';
      head.innerHTML =
        `<span class="piece-num">${i + 1}</span>` +
        `<span class="piece-size">${p.w} x ${img.naturalHeight}</span>`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'piece-dl';
      btn.textContent = `${i + 1}枚目を保存 (.${ext})`;
      btn.addEventListener('click', () => downloadPiece(i));

      card.append(thumb, head, btn);
      piecesEl.appendChild(card);
    });
  }

  // ---------- ダウンロード ----------

  function pieceBlob(img, piece) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = piece.w;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (state.format === 'jpeg') {
        // 透過PNG対策: JPEGは透過できないので白で敷く
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, piece.x, 0, piece.w, img.naturalHeight, 0, 0, piece.w, img.naturalHeight);
      const mime = state.format === 'png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('書き出しに失敗しました'))),
        mime,
        JPEG_QUALITY
      );
    });
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function pieceFilename(i, total) {
    const ext = state.format === 'png' ? 'png' : 'jpg';
    return `${state.baseName}_${i + 1}of${total}.${ext}`;
  }

  async function downloadPiece(i) {
    const pieces = computePieces(state.img.naturalWidth, state.split);
    try {
      const blob = await pieceBlob(state.img, pieces[i]);
      checkSize(blob);
      saveBlob(blob, pieceFilename(i, pieces.length));
    } catch (err) {
      showWarning(String(err.message || err));
    }
  }

  downloadAllBtn.addEventListener('click', async () => {
    const pieces = computePieces(state.img.naturalWidth, state.split);
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = '書き出し中…';
    try {
      for (let i = 0; i < pieces.length; i++) {
        const blob = await pieceBlob(state.img, pieces[i]);
        checkSize(blob);
        saveBlob(blob, pieceFilename(i, pieces.length));
        // ブラウザが連続ダウンロードを取りこぼさないよう少し間を空ける
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      showWarning(String(err.message || err));
    } finally {
      downloadAllBtn.disabled = false;
      downloadAllBtn.textContent = 'まとめてダウンロード';
    }
  });

  function checkSize(blob) {
    if (blob.size > 5 * 1024 * 1024) {
      showWarning(
        `ファイルが ${(blob.size / 1024 / 1024).toFixed(1)}MB あります。Xに投稿できるのは1枚5MBまでなので、JPEG形式を選ぶとサイズを抑えられます。`
      );
    }
  }

  // ---------- 警告表示 ----------

  function showWarning(msg) {
    warningEl.textContent = msg;
    warningEl.hidden = false;
  }

  function hideWarning() {
    warningEl.hidden = true;
  }
})();
