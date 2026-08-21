// ヨコ割をください — 画像を横に3・4分割してダウンロード（全てブラウザ内で処理）
// 表示文言は i18n.js の辞書から取る

(() => {
  'use strict';

  const t = (key, params) => window.I18N.t(key, params);

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const workspace = document.getElementById('workspace');
  const previewCanvas = document.getElementById('preview-canvas');
  const piecesEl = document.getElementById('pieces');
  const srcInfoEl = document.getElementById('src-info');
  const pieceInfoEl = document.getElementById('piece-info');
  const warningEl = document.getElementById('warning');
  const downloadAllBtn = document.getElementById('download-all');
  const downloadHintEl = document.getElementById('download-hint');
  const resetBtn = document.getElementById('reset-btn');
  const evenBtn = document.getElementById('even-btn');
  const stage = document.getElementById('stage');

  const state = {
    img: null,        // HTMLImageElement
    imgId: 0,         // 読み込みごとに増やしてブロブキャッシュを無効化する
    baseName: 'image',
    split: 3,
    cuts: [],         // 分割位置。元画像に対する割合(0〜1)を左から順に持つ
    format: 'jpeg',   // 'jpeg' | 'png'
  };

  const PREVIEW_MAX_W = 1600;
  const THUMB_MAX_W = 480;
  const JPEG_QUALITY = 0.92;
  const MIN_PIECE_W = 120;   // 隣のコマをこれ以上は潰せない（元画像のpx）
  const SNAP_DIST = 12;      // 均等位置にこのpx以内まで近づいたら吸着する

  let dragging = null;
  let rafId = null;
  let blobTimer = null;

  // スマホでは共有シート経由で「画像を保存」→ 写真アプリに保存できるようにする。
  // PCの共有シートはかえって邪魔なので、モバイル端末に限って使う
  const isIOS =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = isIOS || /Android/.test(navigator.userAgent);
  const supportsShare =
    isMobile &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] });

  // ---------- 画像の読み込み ----------

  function loadFile(file) {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      showWarning(t('warnUnsupported'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      state.img = img;
      state.imgId++;
      state.baseName = (file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
      evenCuts();
      dropzone.hidden = true;
      workspace.hidden = false;
      render();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showWarning(t('warnLoadFailed'));
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
    evenCuts();   // ハンドルの本数が変わるため位置を作り直す
    render();
  });

  bindSegmented('format', (v) => {
    state.format = v;
    render();
  });

  evenBtn.addEventListener('click', () => {
    evenCuts();
    render();
  });

  // ---------- 分割の計算 ----------

  function evenCuts() {
    state.cuts = Array.from(
      { length: state.split - 1 },
      (_, i) => (i + 1) / state.split
    );
  }

  function isEven() {
    return state.cuts.every(
      (c, i) => Math.abs(c - (i + 1) / state.split) < 1e-9
    );
  }

  // 境界を丸めてから幅を出すので、各コマの合計は必ず元画像の幅と一致する
  function computePieces() {
    const width = state.img.naturalWidth;
    const edges = [0, ...state.cuts, 1].map((f) => Math.round(f * width));
    return edges.slice(0, -1).map((x, i) => ({ x, w: edges[i + 1] - x }));
  }

  // 隣のハンドルと最小幅の内側に収めたうえで、均等位置には軽く吸着させる
  function moveCut(i, srcX) {
    const W = state.img.naturalWidth;
    const lo = (i === 0 ? 0 : state.cuts[i - 1] * W) + MIN_PIECE_W;
    const hi = (i === state.cuts.length - 1 ? W : state.cuts[i + 1] * W) - MIN_PIECE_W;
    if (lo > hi) return;   // 元画像が狭すぎて動かす余地がない
    let x = Math.max(lo, Math.min(hi, srcX));
    const target = ((i + 1) / state.split) * W;
    if (Math.abs(x - target) < SNAP_DIST) x = target;
    state.cuts[i] = x / W;
    scheduleRender();
  }

  // ドラッグ中は毎フレーム1回だけ描き直す
  function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      render();
    });
  }

  // ---------- 描画 ----------

  function render() {
    const { img } = state;
    if (!img) return;
    hideWarning();

    const pieces = computePieces();

    renderPreview(img, pieces);
    renderHandles(img);
    renderPieceCards(img, pieces);

    downloadAllBtn.textContent = t(supportsShare ? 'dlAllShare' : 'dlAll');
    downloadHintEl.textContent = t(supportsShare ? 'dlHintShare' : 'dlHint');

    srcInfoEl.textContent = t('srcInfo', {
      w: img.naturalWidth,
      h: img.naturalHeight,
    });
    const widths = [...new Set(pieces.map((p) => p.w))].join(' / ');
    pieceInfoEl.textContent = t('pieceInfo', { widths, h: img.naturalHeight });

    const even = isEven();
    evenBtn.hidden = even;

    // 幅が揃っていないとXでは横に並ばないので、その注意を最優先で出す
    if (!even) {
      showWarning(t('warnUneven'));
    } else if (Math.min(...pieces.map((p) => p.w)) < 300) {
      showWarning(t('warnNarrow'));
    }

    // 書き出し(JPEG圧縮)は重いので、操作が止まってからまとめて走らせる
    clearTimeout(blobTimer);
    blobTimer = setTimeout(() => getAllBlobs().catch(() => {}), 300);
  }

  // ハンドルはCanvasではなくDOMで重ねる。掴む範囲を広く取れて、キーボードでも動かせる。
  // 描き直すたびに作り直すとドラッグ中に掴んでいる要素が消えるので、位置だけ更新する
  function renderHandles(img) {
    const W = img.naturalWidth;
    let handles = [...stage.querySelectorAll('.handle')];

    if (handles.length !== state.cuts.length) {
      handles.forEach((el) => el.remove());
      handles = state.cuts.map((_, i) => createHandle(i));
      handles.forEach((el) => stage.appendChild(el));
    }

    handles.forEach((el, i) => {
      el.style.left = state.cuts[i] * 100 + '%';
      el.setAttribute('aria-label', t('handleAria', { n: i + 1 }));
      el.setAttribute('aria-valuemax', String(W));
      el.setAttribute('aria-valuenow', String(Math.round(state.cuts[i] * W)));
    });
  }

  function createHandle(i) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'handle';
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-valuemin', '0');
    el.innerHTML = '<span class="line"></span><span class="grip"><i></i><i></i></span>';

    const toSrcX = (clientX) => {
      const r = previewCanvas.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * state.img.naturalWidth;
    };

    el.addEventListener('pointerdown', (e) => {
      dragging = i;
      try {
        // 指がハンドルから外れても追従させる。掴めない状況でも drag 自体は続行する
        el.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 対象のポインタが既に離れている場合は捕捉不要 */
      }
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (dragging !== i) return;
      moveCut(i, toSrcX(e.clientX));
    });
    el.addEventListener('pointerup', () => {
      dragging = null;
    });
    el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 1;
      const at = state.cuts[i] * state.img.naturalWidth;
      if (e.key === 'ArrowLeft') {
        moveCut(i, at - step);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        moveCut(i, at + step);
        e.preventDefault();
      }
    });
    return el;
  }

  function renderPreview(img, pieces) {
    const scale = Math.min(1, PREVIEW_MAX_W / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    previewCanvas.width = w;
    previewCanvas.height = h;

    const ctx = previewCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // 分割線はハンドル側が実線で描くので、ここでは通し番号だけ載せる
    const guide = '#e8c547';
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
      btn.textContent = t(supportsShare ? 'dlPieceShare' : 'dlPiece', {
        n: i + 1,
        ext,
      });
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
        (blob) => (blob ? resolve(blob) : reject(new Error(t('warnExportFailed')))),
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

  // 共有シートはタップ直後に開かないとブラウザに拒否されるので、
  // 分割・形式が決まった時点で書き出しを先に済ませておく
  let blobCache = { key: null, promise: null };

  function getAllBlobs() {
    const key = `${state.imgId}:${state.format}:${state.cuts.join(',')}`;
    if (blobCache.key !== key) {
      const pieces = computePieces();
      blobCache = {
        key,
        promise: Promise.all(pieces.map((p) => pieceBlob(state.img, p))),
      };
    }
    return blobCache.promise;
  }

  function toFiles(blobs) {
    return blobs.map(
      (b, i) => new File([b], pieceFilename(i, blobs.length), { type: b.type })
    );
  }

  async function shareFiles(files) {
    try {
      await navigator.share({ files, title: t('brand') });
      return true;
    } catch (err) {
      if (err && err.name === 'AbortError') return true; // ユーザーが共有をキャンセルしただけ
      return false; // 共有できなければ通常ダウンロードにフォールバック
    }
  }

  async function downloadPiece(i) {
    try {
      const blobs = await getAllBlobs();
      checkSize(blobs[i]);
      if (supportsShare) {
        const file = toFiles(blobs)[i];
        if (navigator.canShare({ files: [file] }) && (await shareFiles([file]))) return;
      }
      saveBlob(blobs[i], pieceFilename(i, blobs.length));
    } catch (err) {
      showWarning(String(err.message || err));
    }
  }

  downloadAllBtn.addEventListener('click', async () => {
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = t('dlExporting');
    try {
      const blobs = await getAllBlobs();
      blobs.forEach(checkSize);
      if (supportsShare) {
        const files = toFiles(blobs);
        if (navigator.canShare({ files }) && (await shareFiles(files))) return;
      }
      for (let i = 0; i < blobs.length; i++) {
        saveBlob(blobs[i], pieceFilename(i, blobs.length));
        // ブラウザが連続ダウンロードを取りこぼさないよう少し間を空ける
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      showWarning(String(err.message || err));
    } finally {
      downloadAllBtn.disabled = false;
      downloadAllBtn.textContent = t(supportsShare ? 'dlAllShare' : 'dlAll');
    }
  });

  function checkSize(blob) {
    if (blob.size > 5 * 1024 * 1024) {
      showWarning(t('warnTooBig', { size: (blob.size / 1024 / 1024).toFixed(1) }));
    }
  }

  // ハンドルの外で指やマウスを離したときもドラッグ状態を必ず解除する
  window.addEventListener('pointerup', () => {
    dragging = null;
  });
  window.addEventListener('pointercancel', () => {
    dragging = null;
  });

  // 言語を切り替えたら、画像を読み込み済みなら動的な表示も作り直す
  window.I18N.onChange(() => {
    if (state.img) render();
  });

  // ---------- 警告表示 ----------

  function showWarning(msg) {
    warningEl.textContent = msg;
    warningEl.hidden = false;
  }

  function hideWarning() {
    warningEl.hidden = true;
  }
})();
