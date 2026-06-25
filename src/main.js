// main.js

import './style.css';
import { BLOCK_NAMES, BLOCK_COLORS, BIT_SECONDS } from './constants.js';
import { loadSounds, buildAudioEvents, closeAudio, getCtx } from './audio.js';
import { spriteImages, buildSpriteEvents, activateBlock, deactivateBlock } from './sprites.js';

// ── 전역 데이터 ───────────────────────────────────
let songData = {};
let TileConfigs, TileDurations, Tiles, Sounds;

let blockOrder = Array.from({length: 16}, (_, i) => i);
const mutedBlocks = new Set();
let isPlaying = false;
let isPaused = false;
let animFrame = null;
const activeBlocks = new Array(16).fill(null);
const activeBlockTimers = new Array(16).fill(null); // 블럭별 deactivate 타이머
let activeTimers = [];
let dragMode = false;
let freeDragMode = false;
let dragSrcIdx = null;

// 자유 드래그 위치 저장
const freePositions = {}; // id → {x, y}
let noStyleMode = false; // 스타일 없애기 모드

// 블럭별 개별 크기 (px), 설정 없으면 CSS 변수 기본값 사용
const blockSizes = {}; // id → px 숫자

// 스프라이트 표시 시간 배율 (1.0 = 원본)
let spriteDurationMult = 1.0;

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
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── 그리드 생성 ──────────────────────────────────
function buildGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  blockOrder.forEach(id => {
    const el = document.createElement('div');
    el.className = 'block';
    el.dataset.id = id;
    el.style.setProperty('--c', BLOCK_COLORS[id]);
    if (blockSizes[id]) {
      el.style.width = blockSizes[id] + 'px';
      el.style.height = blockSizes[id] + 'px';
      el.style.aspectRatio = 'unset';
    }
    if (mutedBlocks.has(id)) el.classList.add('muted');
    if (noStyleMode) el.classList.add('no-style');
    el.draggable = dragMode;
    el.innerHTML = `
      <div class="block-flash"></div>
      <img class="block-sprite" alt="">
      <div class="block-placeholder">
        <div class="block-num">${id}</div>
        <div class="block-name">${BLOCK_NAMES[id]}</div>
      </div>
      <div class="block-tile"></div>
      <div class="block-mute-icon">🔇</div>`;

    el.addEventListener('click', () => { if (!dragMode) openSpriteModal(id); });
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      const muted = mutedBlocks.has(id);
      muted ? mutedBlocks.delete(id) : mutedBlocks.add(id);
      el.classList.toggle('muted');
      // 재생 중이면 gain 즉시 반영
      if (_blockGains?.[id]) _blockGains[id].gain.value = muted ? 1 : 0;
    });
    grid.appendChild(el);
  });
}

// ── 자유 드래그 ──────────────────────────────────
function enterFreeDrag() {
  const stage = document.getElementById('free-stage');
  const grid = document.getElementById('grid');
  stage.classList.add('active');
  stage.style.pointerEvents = 'all';
  grid.style.visibility = 'hidden';

  blockOrder.forEach(id => {
    // 이미 클론 있으면 커서만 복구
    const existing = stage.querySelector(`.block[data-id="${id}"]`);
    if (existing) { existing.style.cursor = 'grab'; return; }

    const gridEl = document.querySelector(`#grid .block[data-id="${id}"]`);
    if (!gridEl) return;

    if (!freePositions[id]) {
      const rect = gridEl.getBoundingClientRect();
      freePositions[id] = { x: rect.left, y: rect.top };
    }
    const pos = freePositions[id];

    const clone = gridEl.cloneNode(true);
    clone.dataset.id = id;
    clone.style.left = pos.x + 'px';
    clone.style.top = pos.y + 'px';
    clone.style.setProperty('--c', BLOCK_COLORS[id]);
    clone.style.cursor = 'grab';

    let isDragging = false, ox = 0, oy = 0;
    clone.addEventListener('mousedown', e => {
      if (e.button !== 0 || !freeDragMode) return;
      isDragging = true;
      ox = e.clientX - freePositions[id].x;
      oy = e.clientY - freePositions[id].y;
      clone.style.zIndex = 999;
      e.preventDefault();
    });

    clone.addEventListener('contextmenu', e => {
      e.preventDefault();
      const muted = mutedBlocks.has(id);
      muted ? mutedBlocks.delete(id) : mutedBlocks.add(id);
      clone.classList.toggle('muted');
      document.querySelector(`#grid .block[data-id="${id}"]`)?.classList.toggle('muted');
      if (_blockGains?.[id]) _blockGains[id].gain.value = muted ? 1 : 0;
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging) return;
      freePositions[id] = { x: e.clientX - ox, y: e.clientY - oy };
      clone.style.left = freePositions[id].x + 'px';
      clone.style.top = freePositions[id].y + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      clone.style.zIndex = '';
    });

    stage.appendChild(clone);
  });
}

function exitFreeDrag() {
  const stage = document.getElementById('free-stage');
  document.querySelectorAll('#free-stage .block').forEach(el => {
    el.style.cursor = 'default';
  });
  stage.style.pointerEvents = 'none';
}

// free-stage 블록 활성화 (재생 중 스프라이트 표시)
function activateFreeBlock(id, tileIdx) {
  const el = document.querySelector(`#free-stage .block[data-id="${id}"]`);
  if (!el || mutedBlocks.has(id)) return;
  el.classList.add('active');
  el.querySelector('.block-tile').textContent = `T${tileIdx}`;
  const img = el.querySelector('.block-sprite');
  const key = `${id}_${tileIdx}`;
  if (spriteImages[key]) {
    img.src = spriteImages[key];
    img.style.display = 'block';
    el.querySelector('.block-placeholder').style.display = 'none';
  } else {
    img.style.display = 'none';
    el.querySelector('.block-placeholder').style.display = 'flex';
    el.querySelector('.block-num').textContent = tileIdx;
  }
  const flash = el.querySelector('.block-flash');
  if (flash) { flash.style.opacity = '0.12'; setTimeout(() => flash.style.opacity = '0', 80); }
}

function deactivateFreeBlock(id) {
  const el = document.querySelector(`#free-stage .block[data-id="${id}"]`);
  if (!el) return;
  el.classList.remove('active');
  el.querySelector('.block-tile').textContent = '';
  const defaultKey = `${id}_default`;
  const img = el.querySelector('.block-sprite');
  if (spriteImages[defaultKey]) {
    img.src = spriteImages[defaultKey];
    img.style.display = 'block';
    el.querySelector('.block-placeholder').style.display = 'none';
  } else {
    el.querySelector('.block-num').textContent = id;
    el.querySelector('.block-placeholder').style.display = 'flex';
    img.style.display = 'none';
  }
}

// ── 드래그 (스왑) ────────────────────────────────
function setupDrag() {
  const grid = document.getElementById('grid');

  grid.addEventListener('dragstart', e => {
    if (!dragMode) return;
    const block = e.target.closest('.block');
    if (!block) return;
    dragSrcIdx = blockOrder.indexOf(parseInt(block.dataset.id));
    setTimeout(() => block.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', block.dataset.id);
  });

  grid.addEventListener('dragend', e => {
    document.querySelectorAll('.block').forEach(el => el.classList.remove('dragging', 'drag-over'));
    dragSrcIdx = null;
  });

  grid.addEventListener('dragover', e => {
    if (!dragMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const block = e.target.closest('.block');
    document.querySelectorAll('.block').forEach(el => el.classList.remove('drag-over'));
    if (block) block.classList.add('drag-over');
  });

  grid.addEventListener('drop', e => {
    if (!dragMode) return;
    e.preventDefault();
    document.querySelectorAll('.block').forEach(el => el.classList.remove('drag-over'));
    const block = e.target.closest('.block');
    if (!block || dragSrcIdx === null) return;
    const dstIdx = blockOrder.indexOf(parseInt(block.dataset.id));
    if (dstIdx === dragSrcIdx) return;
    [blockOrder[dragSrcIdx], blockOrder[dstIdx]] = [blockOrder[dstIdx], blockOrder[dragSrcIdx]];
    dragSrcIdx = null;
    buildGrid();
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
  fileInput.accept = 'image/png, image/jpeg, image/gif, image/webp, image/bmp';
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
    img.src = url;
    img.style.display = 'block';
    numEl.textContent = '';
    item.style.borderColor = color;
    item.style.borderStyle = 'solid';
    // 기본 이미지를 바꿨다면 현재 블록에 즉시 반영
    if (key === `${id}_default`) {
      const blockEl = document.querySelector(`.block[data-id="${id}"]`);
      if (blockEl && !blockEl.classList.contains('active')) {
        const bImg = blockEl.querySelector('.block-sprite');
        bImg.src = url;
        bImg.style.display = 'block';
        blockEl.querySelector('.block-placeholder').style.display = 'none';
      }
    }
  });

  return item;
}

function openSpriteModal(id) {
  const tileCount = Tiles?.[id]?.length ?? 0;
  const nameEl = document.getElementById('sprite-modal-block-name');
  nameEl.textContent = `${BLOCK_NAMES[id]}  (Block ${id})`;
  nameEl.style.color = BLOCK_COLORS[id];

  // 블럭 크기 슬라이더
  const globalSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--block-size')) || 120;
  const currentSize = blockSizes[id] ?? globalSize;
  document.getElementById('block-individual-size').value = currentSize;
  document.getElementById('block-individual-size-val').textContent = currentSize + 'px';
  document.getElementById('block-individual-size').oninput = e => {
    const px = parseInt(e.target.value);
    blockSizes[id] = px;
    document.getElementById('block-individual-size-val').textContent = px + 'px';
    // 그리드 블럭 즉시 반영
    const el = document.querySelector(`#grid .block[data-id="${id}"]`);
    if (el) { el.style.width = px + 'px'; el.style.height = px + 'px'; el.style.aspectRatio = 'unset'; }
    // 자유드래그 블럭도 반영
    const freeEl = document.querySelector(`#free-stage .block[data-id="${id}"]`);
    if (freeEl) { freeEl.style.width = px + 'px'; freeEl.style.height = px + 'px'; }
  };
  document.getElementById('block-individual-size-reset').onclick = () => {
    delete blockSizes[id];
    document.getElementById('block-individual-size').value = globalSize;
    document.getElementById('block-individual-size-val').textContent = globalSize + 'px';
    const el = document.querySelector(`#grid .block[data-id="${id}"]`);
    if (el) { el.style.width = ''; el.style.height = ''; el.style.aspectRatio = ''; }
    const freeEl = document.querySelector(`#free-stage .block[data-id="${id}"]`);
    if (freeEl) { freeEl.style.width = ''; freeEl.style.height = ''; }
  };

  const tileGrid = document.getElementById('sprite-tile-grid');
  tileGrid.innerHTML = '';

  // 기본 이미지 칸 (맨 위)
  const defaultItem = makeTileItem(id, `${id}_default`, '기본 이미지', BLOCK_COLORS[id]);
  defaultItem.classList.add('sprite-tile-default');
  tileGrid.appendChild(defaultItem);

  // tile별 이미지 칸
  for (let t = 0; t < tileCount; t++) {
    tileGrid.appendChild(makeTileItem(id, `${id}_${t}`, `TILE ${t}`, BLOCK_COLORS[id]));
  }

  document.getElementById('sprite-modal').classList.add('open');
}

// ── 재생/일시정지/정지 ────────────────────────────
let _ctx = null;
let _blockGains = null;
let _startTime = null;
let _pausedAt = null; // 일시정지 시점 (elapsed ms)
let _audioEvents = [];
let _audioPtr = 0;
let _spriteEvents = [];
let _spritePtr = 0;
let _songDuration = 0;

async function playSong() {
  // 일시정지 → 재개
  if (isPaused && _ctx) {
    await _ctx.resume();
    isPaused = false;
    isPlaying = true;
    document.getElementById('btn-play').textContent = '⏸ Pause';
    document.getElementById('status').textContent = 'PLAYING';
    loop();
    return;
  }

  if (isPlaying) return;

  document.getElementById('btn-play').disabled = true;
  document.getElementById('status').textContent = 'LOADING...';

  const { ctx, soundBuffers } = await loadSounds(songData, Sounds);
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
  _pausedAt = null;
  _audioPtr = 0;
  _spritePtr = 0;

  _audioEvents = buildAudioEvents(songData, _startTime);
  _spriteEvents = buildSpriteEvents(songData, TileConfigs, TileDurations);
  _songDuration = 0;
  _spriteEvents.forEach(e => { if (e.endMs > _songDuration) _songDuration = e.endMs; });

  document.getElementById('status').textContent = 'PLAYING';
  document.getElementById('btn-play').textContent = '⏸ Pause';
  document.getElementById('btn-play').disabled = false;
  document.getElementById('btn-stop').disabled = false;
  isPlaying = true;
  isPaused = false;

  loop();
}

function pauseSong() {
  if (!isPlaying || !_ctx) return;
  _ctx.suspend();
  _pausedAt = (_ctx.currentTime - _startTime) * 1000;
  isPlaying = false;
  isPaused = true;
  if (animFrame) cancelAnimationFrame(animFrame);
  activeTimers.forEach(clearTimeout);
  activeTimers = [];
  document.getElementById('btn-play').textContent = '▶ Play';
  document.getElementById('status').textContent = 'PAUSED';
}

function stopSong() {
  isPlaying = false;
  isPaused = false;
  _pausedAt = null;
  if (animFrame) cancelAnimationFrame(animFrame);
  activeTimers.forEach(clearTimeout);
  activeTimers = [];
  activeBlockTimers.fill(null);
  for (let id = 0; id < 16; id++) deactivateBlock(id);
  document.getElementById('tl-bar').style.width = '0%';
  document.getElementById('status').textContent = 'READY';
  document.getElementById('btn-play').textContent = '▶ Play';
  document.getElementById('btn-play').disabled = false;
  document.getElementById('btn-stop').disabled = true;
  closeAudio();
  _ctx = null;
}

function loop() {
  if (!isPlaying || !_ctx) return;
  const now = _ctx.currentTime;
  const elapsedMs = (now - _startTime) * 1000;
  const LOOKAHEAD = 0.2;

  document.getElementById('tl-bar').style.width =
    Math.min(elapsedMs / _songDuration * 100, 100) + '%';

  while (_audioPtr < _audioEvents.length && _audioEvents[_audioPtr].t < now + LOOKAHEAD) {
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
    // 같은 블럭 이전 타이머 취소
    if (activeBlockTimers[ev.id] !== null) {
      clearTimeout(activeBlockTimers[ev.id]);
      activeBlockTimers[ev.id] = null;
    }
    activateBlock(ev.id, ev.tileIdx, mutedBlocks);
    if (freeDragMode) activateFreeBlock(ev.id, ev.tileIdx);
    activeBlocks[ev.id] = ev;
    const displayDur = (ev.endMs - ev.timeMs) * spriteDurationMult;
    const remaining = displayDur - (elapsedMs - ev.timeMs);
    const t = setTimeout(() => {
      activeBlockTimers[ev.id] = null;
      activeBlocks[ev.id] = null;
      deactivateBlock(ev.id);
      if (freeDragMode) deactivateFreeBlock(ev.id);
    }, Math.max(remaining, 0));
    activeBlockTimers[ev.id] = t;
    activeTimers.push(t);
  }

  if (elapsedMs >= _songDuration) { stopSong(); return; }
  animFrame = requestAnimationFrame(loop);
}

// ── 이벤트 바인딩 ─────────────────────────────────
function bindEvents() {
  // Play/Pause 토글
  document.getElementById('btn-play').addEventListener('click', () => {
    if (isPlaying) pauseSong();
    else playSong();
  });
  document.getElementById('btn-stop').addEventListener('click', stopSong);

  // UI 토글
  let uiVisible = true;
  document.getElementById('ui-toggle').addEventListener('click', () => {
    uiVisible = !uiVisible;
    document.getElementById('ui-wrapper').classList.toggle('hidden', !uiVisible);
  });

  // 설정 모달
  const openSettings = () => document.getElementById('settings-modal').classList.add('open');
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('settings-modal-close').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.remove('open');
  });
  document.getElementById('settings-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('settings-modal'))
      document.getElementById('settings-modal').classList.remove('open');
  });

  // 블록 크기 슬라이더
  document.getElementById('block-size').addEventListener('input', e => {
    const px = e.target.value + 'px';
    document.documentElement.style.setProperty('--block-size', px);
    document.getElementById('block-size-val').textContent = px;
  });

  // 스프라이트 표시 시간 배율
  document.getElementById('sprite-dur').addEventListener('input', e => {
    spriteDurationMult = parseFloat(e.target.value);
    document.getElementById('sprite-dur-val').textContent = spriteDurationMult.toFixed(1) + '×';
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
    document.getElementById('bg-image-input').value = '';
  });

  // 자유 드래그 모드
  document.getElementById('free-drag-toggle').addEventListener('click', () => {
    freeDragMode = !freeDragMode;
    const btn = document.getElementById('free-drag-toggle');
    btn.textContent = freeDragMode ? '자유 드래그 ON' : '자유 드래그 OFF';
    btn.classList.toggle('active', freeDragMode);
    btn.disabled = true;
    setTimeout(() => { btn.disabled = false; }, 300);
    if (freeDragMode) enterFreeDrag();
    else exitFreeDrag();
    document.getElementById('settings-btn').classList.toggle('above-stage', freeDragMode);
  });

  // 자유 드래그 위치 초기화
  document.getElementById('free-pos-reset').addEventListener('click', () => {
    for (const key in freePositions) delete freePositions[key];
    const stage = document.getElementById('free-stage');
    stage.innerHTML = '';
    if (freeDragMode) enterFreeDrag();
  });

  // 스왑 드래그 모드
  document.getElementById('drag-toggle').addEventListener('click', () => {
    dragMode = !dragMode;
    const btn = document.getElementById('drag-toggle');
    btn.textContent = dragMode ? '드래그 모드 ON' : '드래그 모드 OFF';
    btn.classList.toggle('active', dragMode);
    // draggable 속성 직접 업데이트
    document.querySelectorAll('.block').forEach(el => { el.draggable = dragMode; });
  });

  // 스타일 없애기
  document.getElementById('no-style-toggle').addEventListener('click', () => {
    noStyleMode = !noStyleMode;
    const btn = document.getElementById('no-style-toggle');
    btn.textContent = noStyleMode ? '스타일 없애기 ON' : '스타일 없애기 OFF';
    btn.classList.toggle('active', noStyleMode);
    document.querySelectorAll('.block').forEach(el => el.classList.toggle('no-style', noStyleMode));
  });

  // 팝업 닫기
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
  setupDrag();
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
