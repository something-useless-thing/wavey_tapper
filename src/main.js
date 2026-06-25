// main.js
import './style.css';
import { BLOCK_NAMES, BLOCK_COLORS, BIT_SECONDS, TILE_FOLDERS } from './constants.js';
import { loadSounds, buildAudioEvents, closeAudio } from './audio.js';
import { spriteImages, buildSpriteEvents, activateBlock, deactivateBlock } from './sprites.js';

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
let customMode = false; // 커스텀 모드
let spriteDurationMult = 1.0;

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

// ── 기본 타일 이미지 로드 ─────────────────────────
// img/tile/{폴더}/tile_000.png ~ 형식
function loadDefaultTileImages() {
  for (let id = 0; id < 16; id++) {
    const folder = TILE_FOLDERS[id];
    if (!folder) continue;
    const tileCount = window.Tiles?.[id]?.length ?? 0;
    for (let t = 0; t < tileCount; t++) {
      const key = `${id}_${t}`;
      if (!spriteImages[key]) { // 커스텀 없을 때만
        const num = String(t).padStart(3, '0');
        spriteImages[key] = `/img/tile/${folder}/tile_${num}.png`;
      }
    }
  }
}

// ── 커스텀 모드 토글 ──────────────────────────────
function toggleCustomMode(on) {
  customMode = on;
  document.body.classList.toggle('custom-mode', on);
  // 커스텀 OFF → 기본 타일 이미지 복원 (유저가 올린 게 없는 것만)
  if (!on) loadDefaultTileImages();
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
      if (!freeDragMode) openSpriteModal(id);
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

  // 위치 먼저 읽기 (레이아웃 변경 전)
  document.querySelectorAll('#grid .block').forEach(el => {
    const id = parseInt(el.dataset.id);
    if (!freePositions[id]) {
      const rect = el.getBoundingClientRect();
      freePositions[id] = { x: rect.left, y: rect.top };
    }
  });

  // 그리드 높이 고정 후 숨기기
  const gridRect = grid.getBoundingClientRect();
  grid.style.minHeight = gridRect.height + 'px';
  grid.style.visibility = 'hidden';

  // 블록을 body로 이동 → fixed 자유 배치
  blockOrder.forEach(id => {
    const el = document.querySelector(`#grid .block[data-id="${id}"]`);
    if (!el) return;
    const size = getBlockSize(id);

    el.style.position = 'fixed';
    el.style.left = freePositions[id].x + 'px';
    el.style.top = freePositions[id].y + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
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
  item.addEventListener('click', () => fileInput.click());
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
  const tileCount = Tiles?.[id]?.length ?? 0;
  const nameEl = document.getElementById('sprite-modal-block-name');
  nameEl.textContent = `${BLOCK_NAMES[id]}  (Block ${id})`;
  nameEl.style.color = BLOCK_COLORS[id];

  // 개별 크기 슬라이더
  const curSize = getBlockSize(id);
  document.getElementById('block-individual-size').value = curSize;
  document.getElementById('block-individual-size-val').textContent = curSize + 'px';
  document.getElementById('block-individual-size').oninput = e => {
    const px = parseInt(e.target.value);
    blockSizes[id] = px;
    document.getElementById('block-individual-size-val').textContent = px + 'px';
    document.querySelectorAll(`.block[data-id="${id}"]`).forEach(el => {
      el.style.width = px + 'px';
      el.style.height = px + 'px';
    });
  };
  document.getElementById('block-individual-size-reset').onclick = () => {
    delete blockSizes[id];
    const px = globalBlockSize;
    document.getElementById('block-individual-size').value = px;
    document.getElementById('block-individual-size-val').textContent = px + 'px';
    document.querySelectorAll(`.block[data-id="${id}"]`).forEach(el => {
      el.style.width = px + 'px';
      el.style.height = px + 'px';
    });
  };

  const tileGrid = document.getElementById('sprite-tile-grid');
  tileGrid.innerHTML = '';
  const defaultItem = makeTileItem(id, `${id}_default`, '기본 이미지', BLOCK_COLORS[id]);
  defaultItem.classList.add('sprite-tile-default');
  tileGrid.appendChild(defaultItem);
  for (let t = 0; t < tileCount; t++) {
    tileGrid.appendChild(makeTileItem(id, `${id}_${t}`, `TILE ${t}`, BLOCK_COLORS[id]));
  }
  document.getElementById('sprite-modal').classList.add('open');
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
  loop();
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

  if (elapsedMs >= _songDuration) { stopSong(); return; }
  animFrame = requestAnimationFrame(loop);
}

// ── 이벤트 바인딩 ─────────────────────────────────
function bindEvents() {
  document.getElementById('btn-play').addEventListener('click', () => {
    if (isPlaying) pauseSong(); else playSong();
  });
  document.getElementById('btn-stop').addEventListener('click', stopSong);

  // UI 토글
  let uiVisible = true;
  document.getElementById('ui-toggle').addEventListener('click', () => {
    uiVisible = !uiVisible;
    document.getElementById('ui-wrapper').classList.toggle('hidden', !uiVisible);
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

  // 전체 블록 크기
  document.getElementById('block-size').addEventListener('input', e => {
    const px = parseInt(e.target.value);
    document.getElementById('block-size-val').textContent = px + 'px';
    setGlobalBlockSize(px);
  });

  // 스프라이트 표시 시간
  document.getElementById('sprite-dur').addEventListener('input', e => {
    spriteDurationMult = parseFloat(e.target.value);
    document.getElementById('sprite-dur-val').textContent = spriteDurationMult.toFixed(1) + '×';
  });

  // 테마 토글
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    const btn = document.getElementById('theme-toggle');
    btn.textContent = isLight ? '☀ Light Mode' : '🌙 Dark Mode';
  });

  // 배경색
  document.getElementById('bg-color').addEventListener('input', e => {
    document.body.style.background = e.target.value;
  });

  // 배경 이미지
  document.getElementById('bg-image-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    document.body.style.backgroundImage = `url(${url})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
  });
  document.getElementById('bg-image-clear').addEventListener('click', () => {
    document.body.style.backgroundImage = '';
  });

  // 자유 드래그
  document.getElementById('free-drag-toggle').addEventListener('click', () => {
    freeDragMode = !freeDragMode;
    const btn = document.getElementById('free-drag-toggle');
    btn.textContent = freeDragMode ? '자유 드래그 ON' : '자유 드래그 OFF';
    btn.classList.toggle('active', freeDragMode);
    if (freeDragMode) enterFreeDrag();
    else exitFreeDrag();
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

  // 스타일 없애기
  document.getElementById('no-style-toggle').addEventListener('click', () => {
    noStyleMode = !noStyleMode;
    const btn = document.getElementById('no-style-toggle');
    btn.textContent = noStyleMode ? '스타일 없애기 ON' : '스타일 없애기 OFF';
    btn.classList.toggle('active', noStyleMode);
    document.querySelectorAll('.block').forEach(el => el.classList.toggle('no-style', noStyleMode));
  });

  // 스프라이트 모달 닫기
  document.getElementById('sprite-modal-close').addEventListener('click', () => {
    document.getElementById('sprite-modal').classList.remove('open');
  });
  document.getElementById('sprite-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('sprite-modal'))
      document.getElementById('sprite-modal').classList.remove('open');
  });
}

// ── 초기화 ───────────────────────────────────────
async function init() {
  await loadGameData();
  buildGrid();
  bindEvents();
  await Promise.all(Array.from({length: 16}, async (_, i) => {
    try {
      const res = await fetch(`/song/${i}.json`);
      songData[i] = await res.json();
    } catch(e) { songData[i] = []; }
  }));
  document.getElementById('status').textContent = 'READY';
}

init();
