export const BIT_SECONDS = 5 / 448;
export const BIT_MS = 625 / 56;

export const BLOCK_NAMES = [
  'Drums','Chord','FA Front','FA Back',
  'WWDTM Hi','WWDTM Lo','SF Roll','SF Tap',
  'PM','Arp','Noise','DTMF',
  'Bass','Spreader','Radiolab','Master'
];

export const WAV_FOLDERS = [
  'Drums','Chord','FA Front','FA Back',
  'WWDTM High','WWDTM Low','SF Roll','SF Tap',
  'PM','Arp','Noise','DTMF',
  'Bass','Spreader','Radiolab',''
];

export const TILE_FOLDERS = [
  'Drums','Chord','FA Front','FA Back',
  'WWDTM High','WWDTM Low','SF Roll','SF Tap',
  'PM','Arp','Noise','DTMF',
  'Bass','Spreader','Radiolab','Text'
];

export const TILE_OFFSETS = [
  0, 5, 10, 14, 17, 20, 23, 26,
  29, 39, 44, 85, 99, 104, 113, 135
];

// Text 블록(15번)은 파일명이 연속되지 않아서 실제 파일명 배열로 매핑
export const TEXT_TILE_FILES = [
  135,136,137,138,139,140,141,142,
  144,146,147,148,149,152,154,156,
  157,158,159,161,166,167,171,173,
  179,187,192,193,198,199,201,203,
  208,209,225,227,236,245
];

// 강조색 (밝은 무늬색)
export const BLOCK_COLORS = [
  '#FF5043','#FF8E38','#F3D32B','#D5EA24',
  '#8DE741','#30E640','#32EB98','#2FE9CE',
  '#36CBF9','#3488FF','#4347FF','#8751FE',
  '#DD50F9','#FF58D6','#FF5B89','#AAAAAA'
];

// 어두운 배경색
export const BLOCK_BG_COLORS = [
  '#58140D','#52290C','#4F3F0A','#565F0D',
  '#26470C','#08440B','#02481C','#074742',
  '#083D4F','#0B2750','#0D1152','#291351',
  '#441652','#511742','#531427','#343434'
];

// BLOCK_FILTERS는 더 이상 사용하지 않음 (SVG filter 방식으로 교체)
export const BLOCK_FILTERS = Array(16).fill('');
