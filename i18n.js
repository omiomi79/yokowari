// 表示文言の辞書と言語切り替え。app.js より先に読み込むこと。
// 動的に組み立てる文言は {n} のような差し込み口を持つ（I18N.t の第2引数で埋める）

(() => {
  'use strict';

  const DICT = {
    ja: {
      brand: 'ヨコ割をください',
      docTitle: 'ヨコ割をください — 画像を横に3・4分割してXに投稿',
      docDesc: '画像を横に3分割・4分割してダウンロードできる無料ツール。X（Twitter）投稿用。ブラウザ内で処理するので画像はどこにも送信されません。',
      tagline: '画像を横に3・4分割して、X（Twitter）にそのまま投稿できる形でダウンロード。',

      dropAria: '画像を選択またはドラッグ＆ドロップ',
      dropTitle: '画像をここにドロップ',
      dropSub: 'クリックで選択 ／ Ctrl+V で貼り付けもOK',

      splitLabel: '分割数',
      split3: '3分割',
      split4: '4分割',
      formatLabel: '保存形式',
      jpegNote: 'X推奨',
      pngNote: '高画質',
      reset: '別の画像にする',
      evenBtn: '均等に戻す',
      dragHint: 'プレビューの黄色いハンドルをドラッグすると分割位置を変えられます（← → キーでも調整できます）',
      handleAria: '分割位置 {n}',
      warnUneven: '分割幅が均等ではありません。Xの複数枚投稿は各コマが同じ幅で表示されるため、このままでは横に繋がって見えません。',

      srcInfo: '元画像: {w} x {h}px',
      pieceInfo: '1枚あたり: {widths} x {h}px',

      dlAll: 'まとめてダウンロード',
      dlAllShare: 'まとめて写真に保存',
      dlExporting: '書き出し中…',
      dlHint: '投稿するときは 1 → 2 → 3 の順に画像を選んでください',
      dlHintShare: '共有シートが開いたら「画像を保存」で写真アプリに入ります。投稿は 1 → 2 → 3 の順で',
      dlPiece: '{n}枚目を保存 (.{ext})',
      dlPieceShare: '{n}枚目だけ保存',

      warnUnsupported: 'PNG・JPEG・WebP の画像を選んでください。',
      warnLoadFailed: '画像を読み込めませんでした。別のファイルで試してください。',
      warnNarrow: '1枚あたりの幅がかなり小さくなります。横長の画像で使うときれいに仕上がります。',
      warnTooBig: 'ファイルが {size}MB あります。Xに投稿できるのは1枚5MBまでなので、JPEG形式を選ぶとサイズを抑えられます。',
      warnExportFailed: '書き出しに失敗しました',

      notesTitle: 'Xに投稿するときのメモ',
      note1: '複数枚投稿すると、タイムラインでは横に並んで1枚の絵として繋がって見えます。',
      note2: 'JPEGなら1枚5MBまで投稿できます。このツールのJPEGは高画質（品質92%）で書き出します。',
      note3: 'iPhone・Androidでは共有シートの「画像を保存」から写真アプリに直接保存できます。',
      note4: '処理はすべてブラウザの中だけで行われ、画像がサーバーに送信されることはありません。',

      shareText: 'このツール、まわりにも紹介してもらえると嬉しいです',
      shareBtn: 'Xでシェア',
      shareTweet: '画像を横に3・4分割してXに投稿できる無料ツール「ヨコ割をください」',

      credit: '制作: おみ',
    },

    en: {
      brand: 'Yokowari',
      docTitle: 'Yokowari — Split an image into 3 or 4 pieces for X',
      docDesc: 'A free tool that splits an image into 3 or 4 vertical pieces for posting on X (Twitter). Everything runs in your browser — your images are never uploaded.',
      tagline: 'Split an image into 3 or 4 vertical pieces and download them ready to post on X (Twitter).',

      dropAria: 'Choose an image or drag and drop one',
      dropTitle: 'Drop an image here',
      dropSub: 'Or click to choose — Ctrl+V works too',

      splitLabel: 'Pieces',
      split3: '3 pieces',
      split4: '4 pieces',
      formatLabel: 'Format',
      jpegNote: 'Best for X',
      pngNote: 'Highest quality',
      reset: 'Use a different image',
      evenBtn: 'Reset to equal',
      dragHint: 'Drag the yellow handles on the preview to move the split positions (arrow keys work too).',
      handleAria: 'Split position {n}',
      warnUneven: 'The pieces are no longer equal in width. X shows every image in a multi-image post at the same width, so these will not line up into one wide image.',

      srcInfo: 'Original: {w} x {h}px',
      pieceInfo: 'Each piece: {widths} x {h}px',

      dlAll: 'Download all',
      dlAllShare: 'Save all to Photos',
      dlExporting: 'Exporting…',
      dlHint: 'Attach the images in order: 1 → 2 → 3',
      dlHintShare: 'Choose "Save Image" in the share sheet to add them to Photos. Attach in order: 1 → 2 → 3',
      dlPiece: 'Save piece {n} (.{ext})',
      dlPieceShare: 'Save piece {n}',

      warnUnsupported: 'Choose a PNG, JPEG, or WebP image.',
      warnLoadFailed: "That image couldn't be loaded. Try a different file.",
      warnNarrow: 'Each piece will be quite narrow. Wide images give the best results.',
      warnTooBig: 'This file is {size}MB. X accepts up to 5MB per image — switch to JPEG to bring the size down.',
      warnExportFailed: 'Export failed',

      notesTitle: 'Posting on X',
      note1: 'Posted together, the pieces line up side by side and read as one wide image in the timeline.',
      note2: 'X accepts JPEG files up to 5MB each. This tool exports JPEG at 92% quality.',
      note3: 'On iPhone and Android, choose "Save Image" in the share sheet to save straight to Photos.',
      note4: 'Everything runs inside your browser. Your images are never sent to a server.',

      shareText: 'Found this useful? Let other people know.',
      shareBtn: 'Share on X',
      shareTweet: 'Yokowari — a free tool that splits an image into 3 or 4 pieces for posting on X',

      credit: 'Made by Omi',
    },

    ko: {
      brand: '요코와리',
      docTitle: '요코와리 — 이미지를 3·4등분해 X에 올리기',
      docDesc: '이미지를 가로로 3등분·4등분해 다운로드할 수 있는 무료 도구입니다. X(트위터) 게시용. 브라우저 안에서 처리되어 이미지가 어디로도 전송되지 않습니다.',
      tagline: '이미지를 가로로 3·4등분해서 X(트위터)에 바로 올릴 수 있는 형태로 다운로드합니다.',

      dropAria: '이미지를 선택하거나 끌어다 놓으세요',
      dropTitle: '여기에 이미지를 놓으세요',
      dropSub: '클릭해서 선택하거나 Ctrl+V로 붙여넣기',

      splitLabel: '분할 수',
      split3: '3등분',
      split4: '4등분',
      formatLabel: '저장 형식',
      jpegNote: 'X 권장',
      pngNote: '고화질',
      reset: '다른 이미지 선택',
      evenBtn: '균등하게 되돌리기',
      dragHint: '미리보기의 노란색 핸들을 드래그하면 분할 위치를 바꿀 수 있습니다 (화살표 키로도 조정 가능).',
      handleAria: '분할 위치 {n}',
      warnUneven: '분할 폭이 균등하지 않습니다. X의 여러 장 게시물은 각 이미지가 같은 폭으로 표시되므로 이대로는 가로로 이어져 보이지 않습니다.',

      srcInfo: '원본: {w} x {h}px',
      pieceInfo: '한 장당: {widths} x {h}px',

      dlAll: '한꺼번에 다운로드',
      dlAllShare: '사진에 한꺼번에 저장',
      dlExporting: '내보내는 중…',
      dlHint: '올릴 때는 1 → 2 → 3 순서로 이미지를 선택하세요',
      dlHintShare: '공유 시트에서 "이미지 저장"을 선택하면 사진 앱에 저장됩니다. 올릴 때는 1 → 2 → 3 순서로',
      dlPiece: '{n}번째 저장 (.{ext})',
      dlPieceShare: '{n}번째만 저장',

      warnUnsupported: 'PNG · JPEG · WebP 이미지를 선택해 주세요.',
      warnLoadFailed: '이미지를 불러오지 못했습니다. 다른 파일로 시도해 주세요.',
      warnNarrow: '한 장당 너비가 상당히 작아집니다. 가로로 긴 이미지에서 더 깔끔하게 나옵니다.',
      warnTooBig: '파일이 {size}MB입니다. X는 한 장당 5MB까지만 올릴 수 있으니 JPEG를 선택하면 용량을 줄일 수 있습니다.',
      warnExportFailed: '내보내기에 실패했습니다',

      notesTitle: 'X에 올릴 때 참고사항',
      note1: '여러 장을 함께 올리면 타임라인에서 가로로 이어져 한 장의 그림처럼 보입니다.',
      note2: 'JPEG는 한 장당 5MB까지 올릴 수 있습니다. 이 도구는 고화질(품질 92%)로 내보냅니다.',
      note3: 'iPhone·Android에서는 공유 시트의 "이미지 저장"으로 사진 앱에 바로 저장할 수 있습니다.',
      note4: '모든 처리는 브라우저 안에서만 이루어지며 이미지가 서버로 전송되지 않습니다.',

      shareText: '이 도구를 주변에도 소개해 주시면 감사하겠습니다',
      shareBtn: 'X에 공유',
      shareTweet: "이미지를 가로로 3·4등분해 X에 올릴 수 있는 무료 도구 '요코와리'",

      credit: '제작: 오미',
    },
  };

  const STORAGE_KEY = 'yokowari-lang';
  const SITE_URL = 'https://omiomi79.github.io/yokowari/';
  const listeners = [];

  // 保存済みの選択 → ブラウザの言語設定 → 英語、の順で決める
  function detectLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && DICT[saved]) return saved;
    } catch (e) {
      /* localStorage が使えない環境ではブラウザ設定にフォールバック */
    }
    for (const tag of navigator.languages || [navigator.language || '']) {
      const code = String(tag).toLowerCase().split('-')[0];
      if (DICT[code]) return code;
    }
    return 'en';
  }

  let lang = detectLang();

  function t(key, params) {
    let text = (DICT[lang] && DICT[lang][key]) || DICT.ja[key] || key;
    if (params) {
      text = text.replace(/\{(\w+)\}/g, (m, name) =>
        name in params ? params[name] : m
      );
    }
    return text;
  }

  function apply() {
    document.documentElement.lang = lang;
    document.title = t('docTitle');

    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = t('docDesc');

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });

    const shareLink = document.querySelector('.share-btn');
    if (shareLink) {
      shareLink.href =
        'https://x.com/intent/post' +
        '?text=' + encodeURIComponent(t('shareTweet')) +
        '&url=' + encodeURIComponent(SITE_URL) +
        '&via=omiomi79';
    }

    document.querySelectorAll('.lang-btn').forEach((btn) => {
      const active = btn.dataset.lang === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function setLang(next) {
    if (!DICT[next] || next === lang) return;
    lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* 保存できなくても表示の切り替えは続行する */
    }
    apply();
    listeners.forEach((fn) => fn(lang));
  }

  window.I18N = {
    t,
    apply,
    setLang,
    get lang() {
      return lang;
    },
    onChange(fn) {
      listeners.push(fn);
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });
    apply();
  });
})();
