// ヨコ割をください／タテ割もください — 画像を分割してダウンロード（全てブラウザ内で処理）
// 表示文言は i18n.js の辞書から取る。
// 2つのページは同じコードで動き、<html data-app> でどちらかを判定する

(() => {
  'use strict';

  const t = (key, params) => window.I18N.t(key, params);

  // ページごとの固定設定。タテ割は上下2分割・ハンドル1本に絞る
  const PAGE = document.documentElement.dataset.app === 'tate' ? 'tate' : 'yoko';
  const PAGE_CONFIG = {
    yoko: { axis: 'x', split: 3 },
    tate: { axis: 'y', split: 2 },
  }[PAGE];

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
    split: PAGE_CONFIG.split,
    axis: PAGE_CONFIG.axis,   // 'x' = 横分割（左右に並ぶ） / 'y' = 縦分割（上下に積む）
    cuts: [],                 // 分割位置。元画像に対する割合(0〜1)を左（縦分割なら上）から順に持つ
    format: 'jpeg',   // 'jpeg' | 'png'
  };

  const PREVIEW_MAX_W = 1600;
  const THUMB_MAX_W = 480;
  const THUMB_MAX_W_STACKED = 960;  // 縦分割のコマは横長で1列に積むので大きめに描く
  const JPEG_QUALITY = 0.92;
  const MIN_PIECE_LEN = 120; // 隣のコマをこれ以上は潰せない（元画像のpx、分割軸方向）
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

  // 分割数の切り替えはヨコ割ページにだけある。タテ割ページではボタンが無いので何も束縛されない
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

  // 分割軸に沿った元画像の長さ（横分割なら幅、縦分割なら高さ）
  function axisLen() {
    return state.axis === 'y' ? state.img.naturalHeight : state.img.naturalWidth;
  }

  // 境界を丸めてから長さを出すので、各コマの合計は必ず元画像と一致する。
  // 横分割・縦分割を同じ描画・書き出しコードで扱えるよう、コマは矩形 {x, y, w, h} で返す
  function computePieces() {
    const { naturalWidth: W, naturalHeight: H } = state.img;
    const edges = [0, ...state.cuts, 1].map((f) => Math.round(f * axisLen()));
    return edges.slice(0, -1).map((start, i) => {
      const size = edges[i + 1] - start;
      return state.axis === 'y'
        ? { x: 0, y: start, w: W, h: size }
        : { x: start, y: 0, w: size, h: H };
    });
  }

  // 隣のハンドルと最小長の内側に収めたうえで、均等位置には軽く吸着させる。
  // 吸着はドラッグ向けの補助で、1px単位のキーボード操作では毎回引き戻されて
  // 均等位置から離れられなくなるため、snap: false で無効にできる
  function moveCut(i, srcPos, { snap = true } = {}) {
    const L = axisLen();
    const lo = (i === 0 ? 0 : state.cuts[i - 1] * L) + MIN_PIECE_LEN;
    const hi = (i === state.cuts.length - 1 ? L : state.cuts[i + 1] * L) - MIN_PIECE_LEN;
    if (lo > hi) return;   // 元画像が小さすぎて動かす余地がない
    let pos = Math.max(lo, Math.min(hi, srcPos));
    if (snap) {
      const target = ((i + 1) / state.split) * L;
      if (Math.abs(pos - target) < SNAP_DIST) pos = target;
    }
    state.cuts[i] = pos / L;
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
    const vertical = state.axis === 'y';
    if (vertical) {
      const heights = [...new Set(pieces.map((p) => p.h))].join(' / ');
      pieceInfoEl.textContent = t('pieceInfoV', { w: img.naturalWidth, heights });
    } else {
      const widths = [...new Set(pieces.map((p) => p.w))].join(' / ');
      pieceInfoEl.textContent = t('pieceInfo', { widths, h: img.naturalHeight });
    }

    const even = isEven();
    evenBtn.hidden = even;

    const minLen = Math.min(...pieces.map((p) => (vertical ? p.h : p.w)));
    // 横分割で幅が揃っていないとXでは横に並ばないので、その注意を最優先で出す。
    // 縦分割はXのグリッドが縦に繋がる前提ではないので、この注意は出さない
    if (!even && !vertical) {
      showWarning(t('warnUneven'));
    } else if (minLen < 300) {
      showWarning(t(vertical ? 'warnShort' : 'warnNarrow'));
    }

    // 書き出し(JPEG圧縮)は重いので、操作が止まってからまとめて走らせる
    clearTimeout(blobTimer);
    blobTimer = setTimeout(() => getAllBlobs().catch(() => {}), 300);
  }

  // ハンドルはCanvasではなくDOMで重ねる。掴む範囲を広く取れて、キーボードでも動かせる。
  // 描き直すたびに作り直すとドラッグ中に掴んでいる要素が消えるので、位置だけ更新する
  function renderHandles(img) {
    const L = axisLen();
    const vertical = state.axis === 'y';
    let handles = [...stage.querySelectorAll('.handle')];

    // 本数か向きが変わったときだけ作り直す
    if (handles.length !== state.cuts.length || stage.dataset.axis !== state.axis) {
      handles.forEach((el) => el.remove());
      handles = state.cuts.map((_, i) => createHandle(i));
      handles.forEach((el) => stage.appendChild(el));
      stage.dataset.axis = state.axis;
    }

    handles.forEach((el, i) => {
      const pct = state.cuts[i] * 100 + '%';
      el.classList.toggle('is-y', vertical);
      el.style.left = vertical ? '' : pct;
      el.style.top = vertical ? pct : '';
      el.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal');
      el.setAttribute('aria-label', t('handleAria', { n: i + 1 }));
      el.setAttribute('aria-valuemax', String(L));
      el.setAttribute('aria-valuenow', String(Math.round(state.cuts[i] * L)));
    });
  }

  function createHandle(i) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'handle';
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-valuemin', '0');
    el.innerHTML = '<span class="line"></span><span class="grip"><i></i><i></i></span>';

    // 画面上のポインタ位置を、分割軸に沿った元画像の座標へ
    const toSrcPos = (e) => {
      const r = previewCanvas.getBoundingClientRect();
      return state.axis === 'y'
        ? ((e.clientY - r.top) / r.height) * state.img.naturalHeight
        : ((e.clientX - r.left) / r.width) * state.img.naturalWidth;
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
      moveCut(i, toSrcPos(e));
    });
    el.addEventListener('pointerup', () => {
      dragging = null;
    });
    el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 1;
      const at = state.cuts[i] * axisLen();
      // 横分割は←→、縦分割は↑↓が自然だが、どちらのキーでも動くようにしておく
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        moveCut(i, at - step, { snap: false });
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        moveCut(i, at + step, { snap: false });
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
      const ly = Math.round(p.y * scale) + fontSize * 0.5;
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
    const stacked = state.axis === 'y';
    piecesEl.classList.toggle('is-stacked', stacked);
    const ext = state.format === 'png' ? 'png' : 'jpg';

    pieces.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'piece';

      const thumb = document.createElement('canvas');
      thumb.className = 'piece-thumb';
      const tScale = Math.min(1, (stacked ? THUMB_MAX_W_STACKED : THUMB_MAX_W) / p.w);
      thumb.width = Math.round(p.w * tScale);
      thumb.height = Math.round(p.h * tScale);
      thumb.getContext('2d').drawImage(
        img,
        p.x, p.y, p.w, p.h,
        0, 0, thumb.width, thumb.height
      );

      const head = document.createElement('div');
      head.className = 'piece-head';
      head.innerHTML =
        `<span class="piece-num">${i + 1}</span>` +
        `<span class="piece-size">${p.w} x ${p.h}</span>`;

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
      canvas.height = piece.h;
      const ctx = canvas.getContext('2d');
      if (state.format === 'jpeg') {
        // 透過PNG対策: JPEGは透過できないので白で敷く
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, piece.x, piece.y, piece.w, piece.h, 0, 0, piece.w, piece.h);
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
    const key = `${state.imgId}:${state.format}:${state.axis}:${state.cuts.join(',')}`;
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
