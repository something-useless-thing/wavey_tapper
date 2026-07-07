// main.js
import './style.css';
import { BLOCK_NAMES, BLOCK_COLORS, BLOCK_BG_COLORS, BIT_SECONDS } from './constants.js';
import { loadSounds, buildAudioEvents, closeAudio } from './audio.js';
import { spriteImages, buildSpriteEvents, activateBlock, deactivateBlock, setCustomMode } from './sprites.js';

// ── 전역 상태 ─────────────────────────────────────
let songData = {};
let TileConfigs, TileDurations, Tiles, Sounds;
let blockOrder = Array.from({length: 16}, (_, i) => i);
const mutedBlocks = new Set();
const blockSizes = {};      // id → px (개별 크기)
let globalBlockSize = 120;  // 전체 크기
const freePositions = {};   // id → {x, y}
let freeDragMode = false;
let noStyleMode = false;
let tileLabelVisible = false;
let customMode = false;
let spriteDurationMult = 1.0;
let bgPlayEnabled = true;
let bounceEnabled = false;
let lang = 'ko';
let autoTheme = true;
let themeMode = 'auto'; // 'dark' | 'light' | 'auto'

const STRINGS = {
  ko: {
    settings: '설정', bgPlay: '백그라운드 재생', bgPlayOn: '백그라운드 재생 ON', bgPlayOff: '백그라운드 재생 OFF',
    darkMode: '다크모드', lightMode: '화이트 모드', autoThemeMode: '자동', customMode: '커스텀 모드', customModeOn: '커스텀 모드 ON',
    autoTheme: '자동 테마 ON', autoThemeOff: '자동 테마 OFF',
    bgColor: '배경 색깔', bgImage: '+ 이미지 업로드', bgClear: '배경 이미지 제거',
    gridOffset: '그리드 세로 위치', blockSize: '블럭 크기', radius: '모서리 둥글기',
    spriteDur: '스프라이트 표시 시간', bounce: '바운스 효과', bounceOn: '바운스 ON', bounceOff: '바운스 OFF',
    bounceHeight: '바운스 높이', bounceDur: '바운스 시간',
    freeDrag: '자유 드래그 OFF', freeDragOn: '자유 드래그 ON', posReset: '위치 초기화',
    blockLayout: '블럭 레이아웃', styleDisplay: '스타일 / 표시',
    noStyle: '스타일 없애기 OFF', noStyleOn: '스타일 없애기 ON',
    tileLabel: '타일 레이블 OFF', tileLabelOn: '타일 레이블 ON',
    tip: '팁 표시 ON', tipOff: '팁 표시 OFF', title: '타이틀 표시 ON', titleOff: '타이틀 표시 OFF',
    play: '▶ Play', pause: '⏸ Pause', stop: '■ Stop', settings2: '⚙ Settings',
    ready: 'READY', playing: 'PLAYING', paused: 'PAUSED', loading: 'LOADING...',
    general: '일반', background: '배경', ui: 'UI',
    multiSelect: '다중선택', swapMode: '⇄ 교체모드', swapModeOn: '⇄ 교체모드 ON',
  },
  en: {
    settings: 'Settings', bgPlay: 'Background Play', bgPlayOn: 'BG Play ON', bgPlayOff: 'BG Play OFF',
    darkMode: 'Dark Mode', lightMode: 'Light Mode', autoThemeMode: 'Auto', customMode: 'Custom Mode', customModeOn: 'Custom Mode ON',
    autoTheme: 'Auto Theme ON', autoThemeOff: 'Auto Theme OFF',
    bgColor: 'BG Color', bgImage: '+ Upload Image', bgClear: 'Remove BG Image',
    gridOffset: 'Grid Offset', blockSize: 'Block Size', radius: 'Border Radius',
    spriteDur: 'Sprite Duration', bounce: 'Bounce Effect', bounceOn: 'Bounce ON', bounceOff: 'Bounce OFF',
    bounceHeight: 'Bounce Height', bounceDur: 'Bounce Duration',
    freeDrag: 'Free Drag OFF', freeDragOn: 'Free Drag ON', posReset: 'Reset Position',
    blockLayout: 'Block Layout', styleDisplay: 'Style / Display',
    noStyle: 'No Style OFF', noStyleOn: 'No Style ON',
    tileLabel: 'Tile Label OFF', tileLabelOn: 'Tile Label ON',
    tip: 'Tips ON', tipOff: 'Tips OFF', title: 'Title ON', titleOff: 'Title OFF',
    play: '▶ Play', pause: '⏸ Pause', stop: '■ Stop', settings2: '⚙ Settings',
    ready: 'READY', playing: 'PLAYING', paused: 'PAUSED', loading: 'LOADING...',
    general: 'General', background: 'Background', ui: 'UI',
    multiSelect: 'Multi Select', swapMode: '⇄ Swap Mode', swapModeOn: '⇄ Swap ON',
  }
};

function applyLang() {
  const s = STRINGS[lang];
  const $ = id => document.getElementById(id);

  // 설정 모달 제목
  $('settings-modal-title').querySelector('span').textContent = s.settings;

  // 버튼들
  $('bg-play-toggle').textContent = bgPlayEnabled ? s.bgPlayOn : s.bgPlayOff;
  $('auto-theme-toggle')?.textContent && ($('auto-theme-toggle').textContent = autoTheme ? s.autoTheme : s.autoThemeOff);
  const themeLabels = { dark: s.darkMode, light: s.lightMode, auto: s.autoThemeMode };
  $('theme-toggle').textContent = themeLabels[themeMode];
  $('custom-mode-toggle').textContent = customMode ? s.customModeOn : s.customMode;
  $('bg-image-clear').textContent = s.bgClear;
  const bgImageLabel = document.querySelector('label[for="bg-image-input"]');
  if (bgImageLabel) bgImageLabel.textContent = s.bgImage;
  $('bounce-toggle').textContent = bounceEnabled ? s.bounceOn : s.bounceOff;
  $('free-drag-toggle').textContent = freeDragMode ? s.freeDragOn : s.freeDrag;
  $('free-pos-reset').textContent = s.posReset;
  $('no-style-toggle').textContent = noStyleMode ? s.noStyleOn : s.noStyle;
  $('tile-label-toggle').textContent = tileLabelVisible ? s.tileLabelOn : s.tileLabel;
  $('tip-toggle').textContent = s.tip;
  $('title-toggle').textContent = s.title;
  $('btn-play').textContent = isPlaying ? s.pause : s.play;
  $('btn-stop').textContent = s.stop;
  $('settings-btn').textContent = s.settings2;

  // 다중선택 버튼 텍스트 (input 태그 안에 있음)
  const multiBtn = $('multi-select-btn');
  if (multiBtn) {
    const textNode = [...multiBtn.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (textNode) textNode.textContent = '\n            ' + s.multiSelect + '\n          ';
  }
  $('swap-mode-btn').textContent = swapMode ? s.swapModeOn : s.swapMode;

  // 카테고리 레이블
  document.querySelectorAll('.setting-category').forEach((el, i) => {
    el.textContent = [s.general, s.background, s.ui][i] ?? el.textContent;
  });

  // show-label 슬라이더 레이블 (span 값 보존하면서)
  const labelMap = {
    'grid-offset-val': s.gridOffset,
    'block-size-val': s.blockSize,
    'block-radius-val': s.radius,
    'sprite-dur-val': s.spriteDur,
    'bounce-px-val': s.bounceHeight,
    'bounce-dur-val': s.bounceDur,
  };
  document.querySelectorAll('.setting-label.show-label').forEach(el => {
    const span = el.querySelector('span');
    if (span) {
      const spanId = span.id;
      if (labelMap[spanId]) el.childNodes[0].textContent = labelMap[spanId] + '  ';
    } else {
      // span 없는 레이블 (바운스 효과, 블럭 레이아웃, 스타일/표시)
      const txt = el.textContent.trim();
      if (txt === '바운스 효과' || txt === 'Bounce Effect') el.textContent = s.bounce;
      else if (txt === '블럭 레이아웃' || txt === 'Block Layout') el.textContent = s.blockLayout;
      else if (txt === '스타일 / 표시' || txt === 'Style / Display') el.textContent = s.styleDisplay;
    }
  });
} // 백그라운드 재생

// 팝업 스왑 모드
let swapMode = false;
let swapFirstKey = null; // 첫번째 선택한 타일 key
let swapModalId = null;  // 현재 열린 팝업 블록 id

// 오디오 상태
let isPlaying = false;
let isPaused = false;
let animFrame = null;
const activeBlocks = new Array(16).fill(null);
const activeBlockTimers = new Array(16).fill(null);
let activeTimers = [];
let _ctx = null;
let _blockGains = null;
let _startTime = null;
let _audioEvents = [];
let _audioPtr = 0;
let _spriteEvents = [];
let _spritePtr = 0;
let _songDuration = 0;

// ── 데이터 로드 ───────────────────────────────────
async function loadGameData() {
  await loadScript('/js/prototype.js');
  await loadScript('/js/data.js');
  await loadScript('/js/tiles.js');
  TileConfigs = window.TileConfigs;
  TileDurations = window.TileDurations;
  Tiles = window.Tiles;
  Sounds = window.Sounds;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── 블록 크기 적용 ────────────────────────────────
function getBlockSize(id) {
  return blockSizes[id] ?? globalBlockSize;
}

function applyBlockSize(el, id) {
  const px = getBlockSize(id);
  el.style.width = px + 'px';
  el.style.height = px + 'px';
  el.style.aspectRatio = 'unset';
}

// ── 배경 글자(번호/이름) 표시 갱신 ──────────────────
// 기본모드: 배경 글자 숨김 / 커스텀모드: 배경 글자 표시 (재생 중인 블록은 건드리지 않음)
function refreshIdlePlaceholders() {
  document.querySelectorAll('.block').forEach(el => {
    if (el.classList.contains('active')) return;
    const id = parseInt(el.dataset.id);
    const placeholder = el.querySelector('.block-placeholder');
    const img = el.querySelector('.block-sprite');
    const defaultKey = `${id}_default`;
    if (spriteImages[defaultKey]) {
      img.src = spriteImages[defaultKey];
      img.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      img.style.display = 'none';
      if (customMode) {
        el.querySelector('.block-num').textContent = id;
        placeholder.style.display = 'flex';
      } else {
        placeholder.style.display = 'none';
      }
    }
  });
}

// ── 그리드 생성 ──────────────────────────────────
function buildGrid() {
  const grid = document.getElementById('grid');
  // body에 floating된 블록들 먼저 제거
  document.querySelectorAll('body > .block').forEach(el => el.remove());
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(4, ${globalBlockSize}px)`;

  blockOrder.forEach(id => {
    const el = document.createElement('div');
    el.className = 'block';
    el.dataset.id = id;
    el.style.setProperty('--c', BLOCK_COLORS[id]);
    // 기본 모드: 원본 배경색, 커스텀 모드: CSS 기본색
    el.style.background = customMode ? '' : BLOCK_BG_COLORS[id];
    applyBlockSize(el, id);
    if (mutedBlocks.has(id)) el.classList.add('muted');
    if (noStyleMode) el.classList.add('no-style');
    el.innerHTML = `
      <div class="block-flash"></div>
      <img class="block-sprite" alt="">
      <div class="block-placeholder">
        <div class="block-num">${id}</div>
        <div class="block-name">${BLOCK_NAMES[id]}</div>
      </div>
      <div class="block-tile"></div>
      <div class="block-mute-icon">🔇</div>`;

    el.addEventListener('click', () => {
      if (!freeDragMode && customMode) openSpriteModal(id);
    });
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      const muted = mutedBlocks.has(id);
      muted ? mutedBlocks.delete(id) : mutedBlocks.add(id);
      el.classList.toggle('muted');
      if (_blockGains?.[id]) _blockGains[id].gain.value = muted ? 1 : 0;
    });
    grid.appendChild(el);
  });
  refreshIdlePlaceholders();
}

// ── 기본 이미지 설정 ─────────────────────────────
// 기본 이미지 없음 (기본모드에서는 placeholder 표시)
function applyDefaultImages() {}

function removeDefaultImages() {
  for (let id = 0; id < 16; id++) {
    const key = `${id}_default`;
    if (spriteImages[key] === '/img/default.png') {
      delete spriteImages[key];
    }
  }
}

// ── 커스텀 모드 토글 ──────────────────────────────
function toggleCustomMode(on) {
  customMode = on;
  setCustomMode(on);
  document.body.classList.toggle('custom-active', on);
  if (on) {
    removeDefaultImages();
  } else {
    applyDefaultImages();
  }
  // 배경색 업데이트
  document.querySelectorAll('.block').forEach(el => {
    const id = parseInt(el.dataset.id);
    el.style.background = on ? '' : BLOCK_BG_COLORS[id];
  });
  // 배경 글자(번호/이름) 표시 갱신
  refreshIdlePlaceholders();
}

// ── 전체 블록 크기 변경 ───────────────────────────
function setGlobalBlockSize(px) {
  globalBlockSize = px;
  document.getElementById('grid').style.gridTemplateColumns = `repeat(4, ${px}px)`;
  document.querySelectorAll('.block').forEach(el => {
    const id = parseInt(el.dataset.id);
    if (!blockSizes[id]) { // 개별 크기 없을 때만
      el.style.width = px + 'px';
      el.style.height = px + 'px';
    }
  });
}

// ── 자유 드래그 ──────────────────────────────────
function enterFreeDrag() {
  const grid = document.getElementById('grid');

  // body에 있는 블록들 grid로 먼저 복귀 (이전 자유드래그 잔재 정리)
  document.querySelectorAll('body > .block').forEach(el => {
    grid.appendChild(el);
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.zIndex = '';
    el.style.cursor = '';
    el._freeDragBound = false;
  });
  grid.style.visibility = '';

  // 위치를 항상 새로 읽기 (zoom 보정 포함)
  const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
  document.querySelectorAll('#grid .block').forEach(el => {
    const id = parseInt(el.dataset.id);
    const rect = el.getBoundingClientRect();
    freePositions[id] = { x: rect.left / zoom, y: rect.top / zoom };
  });

  // 그리드 높이 고정 후 숨기기 (zoom 보정)
  const gridRect = grid.getBoundingClientRect();
  grid.style.minHeight = (gridRect.height / zoom) + 'px';
  grid.style.minWidth = (gridRect.width / zoom) + 'px';
  grid.style.visibility = 'hidden';

  // 블록을 body로 이동 → fixed 자유 배치
  blockOrder.forEach(id => {
    const el = document.querySelector(`#grid .block[data-id="${id}"]`);
    if (!el) return;

    el.style.position = 'fixed';
    el.style.left = freePositions[id].x + 'px';
    el.style.top = freePositions[id].y + 'px';
    // 크기는 건드리지 않음
    el.style.zIndex = '50';
    el.style.cursor = 'grab';
    document.body.appendChild(el);

    if (el._freeDragBound) return;
    el._freeDragBound = true;

    let isDragging = false, ox = 0, oy = 0;
    el.addEventListener('mousedown', e => {
      if (e.button !== 0 || !freeDragMode) return;
      isDragging = true;
      ox = e.clientX - freePositions[id].x;
      oy = e.clientY - freePositions[id].y;
      el.style.zIndex = '999';
      e.preventDefault();
      e.stopPropagation();
    });
    document.addEventListener('mousemove', e => {
      if (!isDragging) return;
      freePositions[id] = { x: e.clientX - ox, y: e.clientY - oy };
      el.style.left = freePositions[id].x + 'px';
      el.style.top = freePositions[id].y + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      el.style.zIndex = '50';
    });
  });
}

function exitFreeDrag() {
  // 커서만 바꾸고 위치는 유지
  document.querySelectorAll('body > .block').forEach(el => {
    el.style.cursor = 'default';
  });
}

// ── 자동 테마 ─────────────────────────────────────
function applyAutoTheme(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  const luminance = 0.299*r + 0.587*g + 0.114*b;
  const isLight = luminance > 127.5;
  document.body.classList.toggle('light', isLight);
  applyLang();
}

// ── 스프라이트 편집 팝업 ──────────────────────────
function makeTileItem(id, key, labelText, color) {
  const item = document.createElement('div');
  item.className = 'sprite-tile-item';

  const img = document.createElement('img');
  if (spriteImages[key]) { img.src = spriteImages[key]; img.style.display = 'block'; }

  const numEl = document.createElement('div');
  numEl.className = 'tile-num';
  numEl.textContent = spriteImages[key] ? '' : '';

  const subEl = document.createElement('div');
  subEl.className = 'tile-sub';
  subEl.textContent = labelText;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';

  item.append(img, numEl, subEl, fileInput);
  item.addEventListener('click', () => {
    if (swapMode) {
      // 교체 모드
      if (!swapFirstKey) {
        // 첫번째 선택
        swapFirstKey = key;
        item.classList.add('swap-selected');
      } else if (swapFirstKey === key) {
        // 같은 거 다시 클릭 → 취소
        swapFirstKey = null;
        item.classList.remove('swap-selected');
      } else {
        // 두번째 선택 → 스왑
        const tmp = spriteImages[swapFirstKey];
        spriteImages[swapFirstKey] = spriteImages[key];
        if (tmp) spriteImages[key] = tmp;
        else delete spriteImages[key];
        // 팝업 새로고침
        swapFirstKey = null;
        document.querySelectorAll('.sprite-tile-item').forEach(el => el.classList.remove('swap-selected'));
        openSpriteModal(swapModalId);
      }
    } else {
      fileInput.click();
    }
  });
  if (spriteImages[key]) {
    item.style.borderColor = color;
    item.style.borderStyle = 'solid';
  }
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    spriteImages[key] = url;
    img.src = url; img.style.display = 'block';
    numEl.textContent = '';
    item.style.borderColor = color;
    item.style.borderStyle = 'solid';
    // 블록에 즉시 반영
    const blockEl = document.querySelector(`.block[data-id="${id}"]`);
    if (blockEl && key === `${id}_default` && !blockEl.classList.contains('active')) {
      const bImg = blockEl.querySelector('.block-sprite');
      bImg.src = url; bImg.style.display = 'block';
      blockEl.querySelector('.block-placeholder').style.display = 'none';
    }
  });
  return item;
}

function openSpriteModal(id) {
  swapModalId = id;
  swapFirstKey = null;
  // 교체모드 버튼 상태 유지
  document.getElementById('swap-mode-btn').classList.toggle('active', swapMode);
  const tileCount = Tiles?.[id]?.length ?? 0;
  const nameEl = document.getElementById('sprite-modal-block-name');
  nameEl.textContent = `${BLOCK_NAMES[id]}  (Block ${id})`;
  nameEl.style.color = BLOCK_COLORS[id];

  // 개별 크기 슬라이더 — _currentModalId로 현재 열린 블록 추적
  openSpriteModal._id = id;
  const curSize = getBlockSize(id);
  const indivSlider = document.getElementById('block-individual-size');
  const indivVal = document.getElementById('block-individual-size-val');
  indivSlider.value = curSize;
  indivVal.textContent = curSize + 'px';
  // data-modal-id로 현재 대상 블록 id를 추적 (리스너는 최초 1회만 등록)
  indivSlider.dataset.modalId = id;

  const tileGrid = document.getElementById('sprite-tile-grid');
  tileGrid.innerHTML = '';

  // 기본 이미지 슬롯
  const defaultItem = makeTileItem(id, `${id}_default`, '기본 이미지', BLOCK_COLORS[id]);
  defaultItem.classList.add('sprite-tile-default');
  tileGrid.appendChild(defaultItem);

  // 종료 이미지 슬롯
  const endItem = makeTileItem(id, `${id}_end`, '종료 이미지', BLOCK_COLORS[id]);
  endItem.classList.add('sprite-tile-default');
  tileGrid.appendChild(endItem);

  for (let t = 0; t < tileCount; t++) {
    tileGrid.appendChild(makeTileItem(id, `${id}_${t}`, `TILE ${t}`, BLOCK_COLORS[id]));
  }
  document.getElementById('sprite-modal').classList.add('open');
}

// ── 시크 ─────────────────────────────────────────
async function seekTo(ratio) {
  if (!_ctx || _songDuration === 0) return;
  const wasPlaying = isPlaying;

  // 현재 재생 멈추기
  if (animFrame) cancelAnimationFrame(animFrame);
  activeTimers.forEach(clearTimeout); activeTimers = [];
  activeBlockTimers.fill(null);
  for (let id = 0; id < 16; id++) deactivateBlock(id);

  // 시크 위치 계산
  const seekMs = ratio * _songDuration;
  _startTime = _ctx.currentTime - seekMs / 1000;

  // 오디오 이벤트 포인터 재계산
  _audioPtr = 0;
  while (_audioPtr < _audioEvents.length && _audioEvents[_audioPtr].t < _ctx.currentTime - 0.05) {
    _audioPtr++;
  }

  // 스프라이트 이벤트 포인터 재계산
  _spritePtr = 0;
  while (_spritePtr < _spriteEvents.length && _spriteEvents[_spritePtr].timeMs < seekMs) {
    _spritePtr++;
  }

  if (wasPlaying || isPaused) {
    if (isPaused) {
      await _ctx.resume();
      isPaused = false;
    }
    isPlaying = true;
    document.getElementById('btn-play').textContent = '⏸ Pause';
    document.getElementById('status').textContent = 'PLAYING';
    loop();
  }
}

// ── 재생 ─────────────────────────────────────────
async function playSong() {
  if (isPaused && _ctx) {
    await _ctx.resume();
    isPaused = false; isPlaying = true;
    document.getElementById('btn-play').textContent = '⏸ Pause';
    document.getElementById('status').textContent = 'PLAYING';
    loop(); return;
  }
  if (isPlaying) return;
  document.getElementById('btn-play').disabled = true;
  document.getElementById('status').textContent = 'LOADING...';

  const { ctx } = await loadSounds(songData, Sounds);
  _ctx = ctx;
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(ctx.destination);
  _blockGains = {};
  for (let id = 0; id < 16; id++) {
    const g = ctx.createGain();
    g.gain.value = mutedBlocks.has(id) ? 0 : 1;
    g.connect(masterGain);
    _blockGains[id] = g;
  }
  if (ctx.state === 'suspended') await ctx.resume();
  _startTime = ctx.currentTime + 0.1;
  _audioPtr = 0; _spritePtr = 0;
  _audioEvents = buildAudioEvents(songData, _startTime);
  _spriteEvents = buildSpriteEvents(songData, TileConfigs, TileDurations);
  _songDuration = 0;
  _spriteEvents.forEach(e => { if (e.endMs > _songDuration) _songDuration = e.endMs; });
  document.getElementById('status').textContent = 'PLAYING';
  document.getElementById('btn-play').textContent = '⏸ Pause';
  document.getElementById('btn-play').disabled = false;
  document.getElementById('btn-stop').disabled = false;
  isPlaying = true; isPaused = false;

  // 백그라운드 재생 지원: setInterval + rAF 둘 다 사용
  let intervalId = null;
  function startLoop() {
    if (animFrame) cancelAnimationFrame(animFrame);
    if (intervalId) clearInterval(intervalId);
    if (bgPlayEnabled) {
      intervalId = setInterval(loop, 50);
    } else {
      animFrame = requestAnimationFrame(loop);
    }
  }
  startLoop();
  // bgPlayEnabled 변경 감지
  const _bgWatcher = setInterval(() => {
    if (!isPlaying) { clearInterval(_bgWatcher); return; }
    if (bgPlayEnabled && !intervalId) {
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = null;
      intervalId = setInterval(loop, 50);
    } else if (!bgPlayEnabled && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      animFrame = requestAnimationFrame(loop);
    }
  }, 500);

  function stopLoop() {
    if (animFrame) cancelAnimationFrame(animFrame);
    if (intervalId) clearInterval(intervalId);
    animFrame = null; intervalId = null;
  }
  playSong._stopLoop = stopLoop;
}

function pauseSong() {
  if (!isPlaying || !_ctx) return;
  _ctx.suspend();
  isPlaying = false; isPaused = true;
  if (animFrame) cancelAnimationFrame(animFrame);
  activeTimers.forEach(clearTimeout); activeTimers = [];
  document.getElementById('btn-play').textContent = '▶ Play';
  document.getElementById('status').textContent = 'PAUSED';
}

function stopSong() {
  isPlaying = false; isPaused = false;
  if (animFrame) cancelAnimationFrame(animFrame);
  activeTimers.forEach(clearTimeout); activeTimers = [];
  activeBlockTimers.fill(null);
  for (let id = 0; id < 16; id++) deactivateBlock(id);
  document.getElementById('tl-bar').style.width = '0%';
  document.getElementById('status').textContent = 'READY';
  document.getElementById('btn-play').textContent = '▶ Play';
  document.getElementById('btn-play').disabled = false;
  document.getElementById('btn-stop').disabled = true;
  closeAudio(); _ctx = null;
}

function loop() {
  if (!isPlaying || !_ctx) return;
  const now = _ctx.currentTime;
  const elapsedMs = (now - _startTime) * 1000;
  document.getElementById('tl-bar').style.width =
    Math.min(elapsedMs / _songDuration * 100, 100) + '%';

  while (_audioPtr < _audioEvents.length && _audioEvents[_audioPtr].t < now + 0.2) {
    const ev = _audioEvents[_audioPtr++];
    if (ev.t < now - 0.05) continue;
    const src = _ctx.createBufferSource();
    src.buffer = ev.buf;
    src.connect(_blockGains[ev.id]);
    if (ev.dur) src.start(ev.t, 0, ev.dur * BIT_SECONDS);
    else src.start(ev.t);
    src.onended = () => src.disconnect();
  }

  while (_spritePtr < _spriteEvents.length && _spriteEvents[_spritePtr].timeMs <= elapsedMs) {
    const ev = _spriteEvents[_spritePtr++];
    if (activeBlockTimers[ev.id] !== null) {
      clearTimeout(activeBlockTimers[ev.id]);
      activeBlockTimers[ev.id] = null;
    }
    activateBlock(ev.id, ev.tileIdx, mutedBlocks);
    // 바운스 효과
    if (bounceEnabled) {
      const el = document.querySelector(`.block[data-id="${ev.id}"]`);
      if (el) {
        el.classList.remove('bouncing');
        void el.offsetWidth; // reflow
        el.classList.add('bouncing');
        el.addEventListener('animationend', () => el.classList.remove('bouncing'), { once: true });
      }
    }
    activeBlocks[ev.id] = ev;
    const dur = (ev.endMs - ev.timeMs) * spriteDurationMult;
    const remaining = dur - (elapsedMs - ev.timeMs);
    const t = setTimeout(() => {
      activeBlockTimers[ev.id] = null;
      activeBlocks[ev.id] = null;
      deactivateBlock(ev.id);
    }, Math.max(remaining, 0));
    activeBlockTimers[ev.id] = t;
    activeTimers.push(t);
  }

  if (elapsedMs >= _songDuration) { 
    for (let id = 0; id < 16; id++) deactivateBlock(id);
    stopSong(); 
    return; 
  }
  if (!bgPlayEnabled) animFrame = requestAnimationFrame(loop);
}

// ── 이벤트 바인딩 ─────────────────────────────────
function bindEvents() {
  document.getElementById('btn-play').addEventListener('click', () => {
    if (isPlaying) pauseSong(); else playSong();
  });
  document.getElementById('btn-stop').addEventListener('click', stopSong);

  // 타임라인 (시크 기능 제거 - 진행률 표시만)

  // UI 토글
  let uiVisible = true;
  document.getElementById('ui-toggle').addEventListener('click', () => {
    uiVisible = !uiVisible;
    document.getElementById('ui-wrapper').classList.toggle('hidden', !uiVisible);
    const title = document.getElementById('main-title');
    if (title) title.style.visibility = uiVisible ? '' : 'hidden';
  });

  // 언어 토글
  document.getElementById('lang-toggle').addEventListener('click', () => {
    lang = lang === 'ko' ? 'en' : 'ko';
    document.getElementById('lang-toggle').textContent = lang === 'ko' ? '🇰🇷' : '🇺🇸';
    applyLang();
  });

  // 설정 모달
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('open');
  });
  document.getElementById('settings-modal-close').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.remove('open');
  });
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('settings-modal'))
      document.getElementById('settings-modal').classList.remove('open');
  });

  // 백그라운드 재생 토글
  document.getElementById('bg-play-toggle').addEventListener('click', () => {
    bgPlayEnabled = !bgPlayEnabled;
    document.getElementById('bg-play-toggle').classList.toggle('active', bgPlayEnabled);
    applyLang();
  });

  // 다중선택 업로드
  document.getElementById('multi-select-btn').addEventListener('click', () => {
    document.getElementById('multi-file-input').click();
  });
  document.getElementById('multi-file-input').addEventListener('change', e => {
    const files = [...e.target.files];
    const id = swapModalId;
    const tileCount = Tiles?.[id]?.length ?? 0;
    // 기본 이미지부터 순서대로: default → 0 → 1 → 2 ...
    const keys = [`${id}_default`, ...Array.from({length: tileCount}, (_, t) => `${id}_${t}`)];
    files.forEach((file, i) => {
      if (i >= keys.length) return;
      spriteImages[keys[i]] = URL.createObjectURL(file);
    });
    e.target.value = '';
    openSpriteModal(id); // 팝업 새로고침
  });

  // 교체모드 토글
  document.getElementById('swap-mode-btn').addEventListener('click', () => {
    swapMode = !swapMode;
    swapFirstKey = null;
    document.querySelectorAll('.sprite-tile-item').forEach(el => el.classList.remove('swap-selected'));
    document.getElementById('swap-mode-btn').classList.toggle('active', swapMode);
    applyLang();
  });

  // 그리드 세로 위치
  document.getElementById('grid-offset').addEventListener('input', e => {
    const px = parseInt(e.target.value);
    document.getElementById('grid-offset-val').textContent = px + 'px';
    document.getElementById('grid').style.marginTop = px + 'px';
    document.getElementById('main-title').style.marginTop = px + 'px';
  });

  // 전체 블록 크기
  document.getElementById('block-size').addEventListener('input', e => {
    const px = parseInt(e.target.value);
    document.getElementById('block-size-val').textContent = px + 'px';
    setGlobalBlockSize(px);
  });

  // border-radius
  document.getElementById('block-radius').addEventListener('input', e => {
    const px = e.target.value + 'px';
    document.documentElement.style.setProperty('--block-radius', px);
    document.getElementById('block-radius-val').textContent = px;
  });

  // 스프라이트 표시 시간
  document.getElementById('sprite-dur').addEventListener('input', e => {
    spriteDurationMult = parseFloat(e.target.value);
    document.getElementById('sprite-dur-val').textContent = spriteDurationMult.toFixed(1) + '×';
  });

  // 테마 토글 (다크 → 라이트 → 자동 순환)
  document.getElementById('theme-toggle').addEventListener('click', () => {
    if (themeMode === 'dark') themeMode = 'light';
    else if (themeMode === 'light') themeMode = 'auto';
    else themeMode = 'dark';
    autoTheme = themeMode === 'auto';
    if (themeMode === 'dark') document.body.classList.remove('light');
    else if (themeMode === 'light') document.body.classList.add('light');
    else {
      const color = document.getElementById('bg-color').value;
      applyAutoTheme(color);
    }
    applyLang();
  });

  // 커스텀 모드 토글
  document.getElementById('custom-mode-toggle').addEventListener('click', () => {
    customMode = !customMode;
    toggleCustomMode(customMode);
    document.getElementById('custom-mode-toggle').classList.toggle('active', customMode);
    if (themeMode === 'auto') {
      const color = document.getElementById('bg-color').value;
      applyAutoTheme(color);
    } else {
      document.body.classList.toggle('light', themeMode === 'light');
    }
    applyLang();
  });

  // 배경색
  document.getElementById('bg-color').addEventListener('input', e => {
    document.body.style.background = e.target.value;
    if (autoTheme) applyAutoTheme(e.target.value);
  });

  // 배경 이미지
  document.getElementById('bg-image-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    document.body.style.backgroundImage = `url(${url})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';

    // 자동 테마: 이미지 밝기 감지
    if (autoTheme) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 50; canvas.height = 50; // 작게 샘플링
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data;
        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          total += 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
        }
        const avg = total / (data.length / 4);
        document.body.classList.toggle('light', avg > 127.5);
        applyLang();
      };
      img.src = url;
    }
  });
  document.getElementById('bg-image-clear').addEventListener('click', () => {
    document.body.style.backgroundImage = '';
  });

  // 바운스 효과
  document.getElementById('bounce-toggle').addEventListener('click', () => {
    bounceEnabled = !bounceEnabled;
    document.getElementById('bounce-toggle').classList.toggle('active', bounceEnabled);
    document.getElementById('bounce-settings').style.display = bounceEnabled ? 'flex' : 'none';
    applyLang();
  });
  document.getElementById('bounce-px').addEventListener('input', e => {
    const px = e.target.value;
    document.getElementById('bounce-px-val').textContent = px + 'px';
    document.documentElement.style.setProperty('--bounce-px', `-${px}px`);
  });
  document.getElementById('bounce-dur').addEventListener('input', e => {
    const s = parseFloat(e.target.value).toFixed(1);
    document.getElementById('bounce-dur-val').textContent = s + 's';
    document.documentElement.style.setProperty('--bounce-dur', s + 's');
  });
  document.getElementById('free-drag-toggle').addEventListener('click', () => {
    freeDragMode = !freeDragMode;
    document.getElementById('free-drag-toggle').classList.toggle('active', freeDragMode);
    if (freeDragMode) enterFreeDrag(); else exitFreeDrag();
    applyLang();
  });

  // 위치 초기화
  document.getElementById('free-pos-reset').addEventListener('click', () => {
    for (const k in freePositions) delete freePositions[k];
    // body 블록들 제거 후 재진입
    document.querySelectorAll('body > .block').forEach(el => {
      document.getElementById('grid').appendChild(el);
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
      el.style.zIndex = '';
      el.style.cursor = '';
      el._freeDragBound = false;
    });
    document.getElementById('grid').style.visibility = '';
    document.getElementById('grid').style.minHeight = '';
    if (freeDragMode) enterFreeDrag();
  });

  document.getElementById('no-style-toggle').addEventListener('click', () => {
    noStyleMode = !noStyleMode;
    document.getElementById('no-style-toggle').classList.toggle('active', noStyleMode);
    document.querySelectorAll('.block').forEach(el => el.classList.toggle('no-style', noStyleMode));
    applyLang();
  });

  document.getElementById('tile-label-toggle').addEventListener('click', () => {
    tileLabelVisible = !tileLabelVisible;
    document.getElementById('tile-label-toggle').classList.toggle('active', tileLabelVisible);
    document.documentElement.style.setProperty('--tile-label-display', tileLabelVisible ? 'block' : 'none');
    applyLang();
  });

  let tipVisible = true;
  document.getElementById('tip-toggle').addEventListener('click', () => {
    tipVisible = !tipVisible;
    document.getElementById('tip-toggle').classList.toggle('active', tipVisible);
    document.getElementById('tip-display').style.display = tipVisible ? '' : 'none';
    applyLang();
  });

  // 타이틀 표시 토글
  let titleVisible = true;
  document.getElementById('title-toggle').addEventListener('click', () => {
    titleVisible = !titleVisible;
    document.getElementById('title-toggle').classList.toggle('active', titleVisible);
    document.getElementById('main-title').style.visibility = titleVisible ? '' : 'hidden';
    applyLang();
  });

  // 스프라이트 모달 닫기
  document.getElementById('sprite-modal-close').addEventListener('click', () => {
    document.getElementById('sprite-modal').classList.remove('open');
  });
  document.getElementById('sprite-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('sprite-modal'))
      document.getElementById('sprite-modal').classList.remove('open');
  });

  // 개별 블록 크기 슬라이더 (리스너 1회 등록, data-modal-id로 대상 추적)
  document.getElementById('block-individual-size').addEventListener('input', e => {
    const id = parseInt(e.target.dataset.modalId);
    const px = parseInt(e.target.value);
    blockSizes[id] = px;
    document.getElementById('block-individual-size-val').textContent = px + 'px';
    document.querySelectorAll(`.block[data-id="${id}"]`).forEach(el => {
      el.style.width = px + 'px';
      el.style.height = px + 'px';
    });
  });
}

// ── 팁 시스템 ─────────────────────────────────────
const TIPS = [
  '블록을 클릭하면 스프라이트를 설정할 수 있습니다',
  '블록을 우클릭하면 해당 블록을 음소거할 수 있어요!',
  '설정에서 블록 크기와 모양을 바꿀 수 있습니다',
  '자유 드래그 모드에서 블록을 원하는 위치로 옮길 수 있어요',
  '스프라이트 표시 시간을 조절하면 블록이 바뀌는 속도를 바꿀 수 있습니다',
  '오른쪽 구석에 있는 버튼을 눌러 UI를 숨길 수 있습니다',
  '오른쪽 구석에 있는 버튼을 눌러 UI를 숨길 수 있습니다',
  '오른쪽 구석에 있는 버튼을 눌러 UI를 숨길 수 있습니다',
  '설정에서 타일 레이블을 꺼서 블록 번호와 이름을 숨길 수 있습니다',
  '설정봐봐요 신기한 기능이 많답니다',
  '블럭이 너무 발작하는 것 같다면 스프라이트 표시 시간을 늘려보세요!',
  '스프라이트 교체 모드에서는 두 개의 스프라이트를 선택해 서로 바꿀 수 있습니다',
  '집가고싶다'
];
let _tipIdx = 0;
function startTips() {
  const el = document.getElementById('tip-text');
  function show() {
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = TIPS[_tipIdx % TIPS.length];
      _tipIdx++;
      el.style.opacity = '1';
    }, 400);
  }
  show();
  setInterval(show, 6000);
}

// ── 초기화 ───────────────────────────────────────
async function init() {
  const loadingBar = document.getElementById('loading-bar');
  const loadingScreen = document.getElementById('loading-screen');

  loadingBar.style.width = '10%';
  await loadGameData();
  loadingBar.style.width = '40%';

  buildGrid();
  bindEvents();
  startTips();
  loadingBar.style.width = '60%';

  // 기본: 화이트모드 + 기본 이미지
  document.body.classList.add('light');
  themeMode = 'auto';
  autoTheme = true;
  document.getElementById('theme-toggle').textContent = '화이트 모드';
  document.documentElement.style.setProperty('--tile-label-display', 'none');
  document.getElementById('tile-label-toggle').textContent = '타일 레이블 OFF';
  document.getElementById('tile-label-toggle').classList.remove('active');
  applyDefaultImages();
  toggleCustomMode(false);
  // 그리드 세로 위치 기본 30px
  document.getElementById('grid').style.marginTop = '15px';
  document.getElementById('main-title').style.marginTop = '15px';

  await Promise.all(Array.from({length: 16}, async (_, i) => {
    try {
      const res = await fetch(`/song/${i}.json`);
      songData[i] = await res.json();
    } catch(e) { songData[i] = []; }
  }));

  loadingBar.style.width = '100%';
  document.getElementById('status').textContent = 'READY';

  function fadeOutLoading() {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => loadingScreen.classList.add('hidden'), 900);
  }

  // 클릭으로 스킵
  loadingScreen.addEventListener('click', e => {
    if (e.target.closest('a')) return; // 링크 클릭은 스킵 안 함
    fadeOutLoading();
  });

  // 5초 후 자동 페이드아웃
  setTimeout(fadeOutLoading, 5000);
}

init();
