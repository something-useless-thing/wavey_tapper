// sprites.js - 스프라이트 이벤트 빌드 및 블록 UI

import { BIT_MS, BLOCK_COLORS, TILE_FOLDERS, TILE_OFFSETS, BLOCK_FILTERS, TEXT_TILE_FILES } from './constants.js';

// 전역 스프라이트 이미지 저장소
export const spriteImages = {}; // "id_tileIdx" → url, "id_default" → url

// 커스텀 모드 여부 (main.js에서 setCustomMode로 갱신)
export let isCustomMode = false;
export function setCustomMode(v) { isCustomMode = v; }

// ── SVG filter 생성 ──────────────────────────────
// 검정 이미지의 픽셀을 targetColor로 교체하는 SVG filter를 DOM에 삽입
// 원리: 검정(0,0,0) → targetColor, 흰색(1,1,1) → targetColor (알파는 원본 유지)
function hexToRgb01(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0,2),16)/255,
    parseInt(h.slice(2,4),16)/255,
    parseInt(h.slice(4,6),16)/255,
  ];
}

function ensureSvgFilter(id, color) {
  const filterId = `block-color-filter-${id}`;
  if (document.getElementById(filterId)) return `url(#${filterId})`;

  const [r, g, b] = hexToRgb01(color);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = `
    <defs>
      <filter id="${filterId}" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" values="
          0 0 0 0 ${r}
          0 0 0 0 ${g}
          0 0 0 0 ${b}
          0 0 0 1 0"/>
      </filter>
    </defs>`;
  document.body.appendChild(svg);
  return `url(#${filterId})`;
}

// 타일 이미지 경로 (원본 흑백)
export function getTilePath(id, tileIdx) {
  const folder = TILE_FOLDERS[id];
  if (!folder) return null;
  // Text 블록(15번)은 파일명이 연속되지 않아 별도 매핑 사용
  if (id === 15) {
    const fileNum = TEXT_TILE_FILES[tileIdx];
    if (fileNum === undefined) return null;
    return `/img/tile/${folder}/tile_${fileNum}.png`;
  }
  const num = String(TILE_OFFSETS[id] + tileIdx).padStart(3, '0');
  return `/img/tile/${folder}/tile_${num}.png`;
}

export function buildSpriteEvents(songData, TileConfigs, TileDurations) {
  const events = [];
  for (let id = 0; id < 16; id++) {
    const configs = TileConfigs[id];
    const durations = TileDurations[id];
    const song = songData[id];
    if (!song || !configs) continue;
    song.forEach((bar, barIdx) => {
      bar.forEach(ev => {
        const [bit, soundIdx, dur] = ev;
        const cfg = configs[soundIdx];
        if (!cfg) return;
        const [L, R] = cfg;
        const tileIdx = (L > 0 ? L : R) - 1;
        if (tileIdx < 0) return;
        const timeMs = (bit + barIdx * 192) * BIT_MS;
        const durBits = dur ?? (durations?.[soundIdx] ?? 6);
        const endMs = timeMs + durBits * BIT_MS;
        events.push({ timeMs, endMs, id, tileIdx });
      });
    });
  }
  return events.sort((a, b) => a.timeMs - b.timeMs);
}

export function activateBlock(id, tileIdx, mutedBlocks) {
  if (mutedBlocks.has(id)) return;
  const el = document.querySelector(`.block[data-id="${id}"]`);
  if (!el) return;
  el.classList.add('active');
  el.querySelector('.block-tile').textContent = `T${tileIdx}`;

  const img = el.querySelector('.block-sprite');
  const customKey = `${id}_${tileIdx}`;

  if (spriteImages[customKey]) {
    // 커스텀 이미지 있으면 필터 없이 그대로
    img.src = spriteImages[customKey];
    img.style.filter = '';
    img.style.display = 'block';
  } else if (!isCustomMode) {
    // 기본모드: 원본 검정 이미지 → 밝은 색으로 변환 (SVG feColorMatrix)
    const tilePath = getTilePath(id, tileIdx);
    if (tilePath) {
      img.src = tilePath;
      img.style.filter = ensureSvgFilter(id, BLOCK_COLORS[id]);
      img.style.display = 'block';
    }
  } else {
    // 커스텀모드: 커스텀 이미지가 없으면 기본모드 타일 이미지를 쓰지 않음
    img.style.display = 'none';
    img.style.filter = '';
  }

  el.querySelector('.block-placeholder').style.display = 'none';

  const flash = el.querySelector('.block-flash');
  flash.style.opacity = '0.12';
  setTimeout(() => flash.style.opacity = '0', 80);
}

export function deactivateBlock(id) {
  const el = document.querySelector(`.block[data-id="${id}"]`);
  if (!el) return;
  el.classList.remove('active');
  el.querySelector('.block-tile').textContent = '';

  const img = el.querySelector('.block-sprite');
  const endKey = `${id}_end`;
  const defaultKey = `${id}_default`;

  // 우선순위: 종료 이미지 → 기본 이미지 → 빈 상태 (타일0번 자동 표시 안 함)
  const showKey = spriteImages[endKey] ? endKey
    : spriteImages[defaultKey] ? defaultKey
    : null;

  if (showKey) {
    img.src = spriteImages[showKey];
    img.style.filter = '';
    img.style.display = 'block';
    el.querySelector('.block-placeholder').style.display = 'none';
  } else {
    // 기본모드/커스텀모드 둘 다 이미지 완전히 숨김
    img.style.display = 'none';
    img.style.filter = '';
    img.src = '';
    img.onerror = () => { img.style.display = 'none'; };
    if (isCustomMode) {
      el.querySelector('.block-num').textContent = id;
      el.querySelector('.block-placeholder').style.display = 'flex';
    } else {
      el.querySelector('.block-placeholder').style.display = 'none';
    }
  }
}
