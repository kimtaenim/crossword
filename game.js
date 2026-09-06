/* 무한 크로스워드 — 아래로 계속 이어지고, 다 푼 윗부분은 걷어내며 올라붙는 낱말 퍼즐 */
(() => {
'use strict';

/* ───────── 한글 조합기 ───────── */
const CHO  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const VOWEL_PAIR = {'ㅗㅏ':'ㅘ','ㅗㅐ':'ㅙ','ㅗㅣ':'ㅚ','ㅜㅓ':'ㅝ','ㅜㅔ':'ㅞ','ㅜㅣ':'ㅟ','ㅡㅣ':'ㅢ'};
const JONG_PAIR  = {'ㄱㅅ':'ㄳ','ㄴㅈ':'ㄵ','ㄴㅎ':'ㄶ','ㄹㄱ':'ㄺ','ㄹㅁ':'ㄻ','ㄹㅂ':'ㄼ','ㄹㅅ':'ㄽ','ㄹㅌ':'ㄾ','ㄹㅍ':'ㄿ','ㄹㅎ':'ㅀ','ㅂㅅ':'ㅄ'};
const JONG_SPLIT = Object.fromEntries(Object.entries(JONG_PAIR).map(([k, v]) => [v, [k[0], k[1]]]));
const isVowel = j => JUNG.includes(j);

/*
 * 낱말은 두 갈래다. 한글 음절 낱말과 알파벳 약어(AGV, SLAM …).
 * 격자는 글자가 같은지만 보므로 섞여 있어도 그만이지만,
 * 한글 음절과 알파벳 한 글자는 절대 같을 수 없어 알파벳은 알파벳끼리만 교차한다.
 * 입력도 갈라야 한다 — 알파벳 낱말을 고르면 자판이 영문으로 바뀐다.
 */
const isAlpha = ch => ch >= 'A' && ch <= 'Z';

/** 조합 상태 → 화면에 보일 글자 */
function assemble(s) {
  if (!s.cho && !s.jung) return '';
  if (!s.cho) return s.jung;
  if (!s.jung) return s.cho;
  const code = 0xac00 + (CHO.indexOf(s.cho) * 21 + JUNG.indexOf(s.jung)) * 28 + JONG.indexOf(s.jong || '');
  return String.fromCharCode(code);
}
const isFull = s => !!(s.cho && s.jung);

/**
 * 자모 하나를 넣는다.
 * @returns {{done?:string, cur:object}} done 이 있으면 그 글자를 확정하고 다음 칸으로 넘어간다.
 */
function feed(s, j) {
  const cur = { cho: s.cho || '', jung: s.jung || '', jong: s.jong || '' };
  if (isVowel(j)) {
    if (!cur.jung) { cur.jung = j; return { cur }; }               // ㄱ + ㅏ
    if (!cur.cho)  { return { cur: { cho: '', jung: j, jong: '' } }; }
    if (!cur.jong) {                                                // 가 + ㅣ → 개? (ㅏㅣ 는 미조합) / 고 + ㅏ → 과
      const pair = VOWEL_PAIR[cur.jung + j];
      if (pair) { cur.jung = pair; return { cur }; }
      return { done: assemble(cur), cur: { cho: '', jung: j, jong: '' } };
    }
    // 각 + ㅏ → 가 + 가  (받침이 다음 글자의 초성으로 넘어감)
    const sp = JONG_SPLIT[cur.jong];
    const moved = sp ? sp[1] : cur.jong;
    const kept  = sp ? sp[0] : '';
    const done = assemble({ cho: cur.cho, jung: cur.jung, jong: kept });
    return { done, cur: { cho: CHO.includes(moved) ? moved : '', jung: j, jong: '' } };
  }
  // 자음
  if (!cur.cho && !cur.jung) return { cur: { cho: j, jung: '', jong: '' } };
  if (!cur.jung) return { cur: { cho: j, jung: '', jong: '' } };   // 미완성은 버리고 새로 시작
  if (!cur.cho)  return { cur: { cho: j, jung: '', jong: '' } };
  if (!cur.jong) {
    if (JONG.includes(j)) { cur.jong = j; return { cur }; }
    return { done: assemble(cur), cur: { cho: j, jung: '', jong: '' } };
  }
  const pair = JONG_PAIR[cur.jong + j];
  if (pair) { cur.jong = pair; return { cur }; }
  return { done: assemble(cur), cur: { cho: j, jung: '', jong: '' } };
}

/** 조합 상태에서 자모 하나 지우기 */
function unfeed(s) {
  const cur = { cho: s.cho || '', jung: s.jung || '', jong: s.jong || '' };
  if (cur.jong) {
    const sp = JONG_SPLIT[cur.jong];
    cur.jong = sp ? sp[0] : '';
  } else if (cur.jung) {
    const pair = Object.entries(VOWEL_PAIR).find(([, v]) => v === cur.jung);
    cur.jung = pair ? pair[0][0] : '';
  } else if (cur.cho) {
    cur.cho = '';
  } else return null;
  return cur;
}

/** 완성된 음절을 조합 상태로 되돌린다 (칸을 이어서 고칠 때) */
function disassemble(ch) {
  if (!ch) return { cho: '', jung: '', jong: '' };
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) {
    if (CHO.includes(ch)) return { cho: ch, jung: '', jong: '' };
    if (isVowel(ch)) return { cho: '', jung: ch, jong: '' };
    return { cho: '', jung: '', jong: '' };
  }
  return { cho: CHO[Math.floor(code / 588)], jung: JUNG[Math.floor(code / 28) % 21], jong: JONG[code % 28] };
}

/* ───────── 격자 ───────── */
const W = 8;                 // 열 수 (4~5음절 단어가 여유 있게 들어가도록)
const AHEAD = 26;            // 화면 아래로 미리 만들어 두는 줄 수
const BAND = 6;              // 세로 단어가 넘지 못하는 경계의 간격 (= 걷어낼 수 있는 자리)
const TARGET_CROSS = 4;      // 단어 하나가 다른 단어와 겹쳤으면 하는 목표 횟수
const KEEP = BAND * 40;      // 다 푼 줄을 이만큼(240줄) 남겨 두고, 그보다 오래된 것만 버린다
const WINDOW = 14;           // 화면 위아래로 이만큼 줄만 DOM 에 둔다 (판이 끝없이 길어지므로)
const RECENT = 16;            // 최근 이만큼 안에서는 같은 단어를 다시 쓰지 않는다
const key = (x, y) => x + ',' + y;

/*
 * 격자 규칙 — 겹침을 많이 만들기 위한 뼈대.
 *   · 가로 단어는 "가로줄"(한 줄 걸러 한 줄)에만 놓는다.
 *   · 세로 단어는 짝수 칸에만, 가로줄에서 시작하고, 홀수 글자여야 하며,
 *     한 밴드(BAND줄) 안에 다 들어가야 한다.
 * 그래서 겹침은 (짝수 칸 × 가로줄)에서만 생긴다. 한 칸 걸러 한 칸이므로
 * 네 글자 단어는 최대 두 번, 다섯 글자는 세 번, 일곱 글자는 네 번 겹칠 수 있다.
 * 밴드 경계는 세로 단어가 절대 넘지 않으므로 언제나 "걷어낼 수 있는 줄"이 된다.
 * 이러면 새로 놓는 칸이 직각 방향 이웃과 맞닿는 일이 아예 안 생기므로
 * (뜻 없는 두 글자 덩어리가 생길 걱정 없이) 촘촘하게 겹쳐 짤 수 있다.
 * 줄을 걷어내면 줄 번호가 밀리므로 G.par 로 홀짝을 따라간다.
 */
const isARow = y => ((y + G.par) & 1) === 0;
const bandOf = y => Math.floor((y + G.bandOff) / BAND);

let PACK = null;             // 지금 고른 단어장
let PICK = new Set();        // 그중 고른 갈래 이름들
let ONTOPIC = new Set();     // 고른 갈래에 든 단어들 (나머지는 벌점을 받고 뒤로 밀린다)
let KIND = new Map();        // 단어 → 갈래 이름
let BASIC = new Set();       // "기초" 로 표시해 둔 단어 (쉽게 모드에서 먼저 깔린다)
let FRESH = new Set();       // "요즘 말" — 요즘 뉴스에 실제로 자주 나온 말. 앞자리를 준다
let DECO = [];               // 빈자리에 붙일 꾸밈 이모지 (어린이 단어장만 준다)
let EASY = false;            // 쉽게 — 기초 낱말 위주로 깔고, 낱말마다 첫 글자를 열어 준다
let TIERED = false;          // 이 단어장은 «쉽게» 가 난이도를 가른다 — 켜면 기초, 끄면 심화
let BANK = [];               // [[단어, 힌트], ...] — 고른 갈래의 단어만
let INDEX = new Map();       // 음절 → [{wi, pos}]
let EVEN = new Map();        // 음절 → 그 음절을 짝수 번째에 가진 단어 수 (세로로 엮을 여지)
let ALL = new Map();         // 음절 → 그 음절을 가진 단어 수 (가로로 엮을 여지)

const allKinds = pack => pack.groups.map(g => g.name);

// 단어장이 배색을 고를 수 있다. 없으면 기본(델프트 블루)
function paintTheme(pack) {
  if (pack && pack.theme) document.body.dataset.theme = pack.theme;
  else delete document.body.dataset.theme;
}

/*
 * 갈래를 골라도 그 단어만 쓰지는 않는다.
 * 한 갈래는 서른몇 개뿐이라 그것만으로는 서로 물릴 음절이 모자라서
 * 판이 텅텅 비고 겹치지 않는 단어가 절반 가까이 나온다.
 * 그래서 고른 갈래를 크게 우선하되, 자리가 안 나올 때만 같은 단어장의
 * 다른 갈래에서 끌어와 촘촘함을 지킨다.
 */
function loadBank(pack, picked) {
  PACK = pack;
  DECO = Array.isArray(pack.deco) ? pack.deco : [];
  paintTheme(pack);
  TIERED = pack.tiered === true;
  PICK = new Set(picked && picked.length ? picked : allKinds(pack));
  // 층이 두꺼우면 잠그고, 얇으면 우선순위만 준다 (아래 BASIC 을 채운 뒤 정한다)
  ONTOPIC = new Set();
  KIND = new Map();
  BASIC = new Set();
  FRESH = new Set();
  BANK = [];
  for (const g of pack.groups) {
    for (const w of g.words) {
      BANK.push(w);
      KIND.set(w[0], w[2] || g.name);
      if (w[3] === '기초' || g.name === '기초') BASIC.add(w[0]);
      if (w[3] === '요즘' || g.name === '요즘 말') FRESH.add(w[0]);
      if (PICK.has(g.name)) ONTOPIC.add(w[0]);
    }
  }
  HARD = BASIC.size >= LOCKAT ? SHUT : LEAN;
  DEEP = (BANK.length - BASIC.size) >= LOCKAT ? SHUT : LEAN;
  INDEX = new Map();
  EVEN = new Map();
  ALL = new Map();
  BANK.forEach(([w], wi) => {
    [...w].forEach((c, pos) => {
      if (!INDEX.has(c)) INDEX.set(c, []);
      INDEX.get(c).push({ wi, pos });
      ALL.set(c, (ALL.get(c) || 0) + 1);
      if (!(pos & 1)) EVEN.set(c, (EVEN.get(c) || 0) + 1);
    });
  });
}

const pick = a => a[(Math.random() * a.length) | 0];
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const G = {
  cells: new Map(),   // "x,y" → {x,y,ans,ch,solved,across,down,num}
  words: new Map(),   // id → {id,word,clue,x,y,dir,len,solved}
  nextId: 1,
  maxY: -1,
  filledTo: 0,        // 이 줄까지는 겹침을 보강해 둠
  strad: new Map(),   // 줄 → 그 경계를 가로지르는 세로 단어 수
  used: new Map(),    // 단어 → 지금까지 쓴 횟수 (많이 쓴 것은 뒤로 미룬다)
  par: 0,             // 가로줄의 홀짝
  bandOff: 0,         // 밴드 경계의 위치
  top: 0,             // 여기서부터가 아직 푸는 중인 줄. 그 위는 다 푼 줄로 남겨 둔다
  numBase: 0,         // 지나간 줄에 이미 매긴 번호 (번호가 흔들리지 않게 이어서 매긴다)
  depth: 0,           // 지나온 줄 수
  solvedCount: 0,
  score: 0,
  hints: 0,
  recent: [],         // 최근에 쓴 단어 (근처 중복 방지)
};

function fits(word, x, y, dir, needCross) {
  const len = word.length;
  if (x < 0 || y < 0) return -1;
  if (!isARow(y)) return -1;                 // 두 방향 모두 가로줄에서 시작
  if (dir === 'D') {
    if (x & 1) return -1;                    // 세로는 짝수 칸에만
    // 세로가 홀수 글자여야 할 이유는 없다. 끝 글자가 가로줄이 아닌 데 떨어지면
    // 그 칸만 안 걸릴 뿐이고, 그건 크로스워드에서 흔한 모양이다.
    // 홀수만 받던 동안은 창고의 절반(네 글자·여섯 글자)이 세로로는 아예 못 놓여
    // 판에 한 번도 안 나왔다 — 로봇 창고 202개 중 73개가 그랬다.
    if (bandOf(y) !== bandOf(y + len - 1)) return -1;   // 밴드를 넘지 않게
  }
  if (dir === 'A' ? x + len > W : x >= W) return -1;
  const before = dir === 'A' ? key(x - 1, y) : key(x, y - 1);
  const after  = dir === 'A' ? key(x + len, y) : key(x, y + len);
  if (G.cells.has(before) || G.cells.has(after)) return -1;
  let cross = 0;
  for (let i = 0; i < len; i++) {
    const cx = dir === 'A' ? x + i : x, cy = dir === 'A' ? y : y + i;
    const c = G.cells.get(key(cx, cy));
    if (c) {
      if (c.ans !== word[i]) return -1;
      if (dir === 'A' ? c.across !== null : c.down !== null) return -1;
      cross++;
    } else if (dir === 'A') {
      if (G.cells.has(key(cx, cy - 1)) || G.cells.has(key(cx, cy + 1))) return -1;
    } else {
      if (G.cells.has(key(cx - 1, cy)) || G.cells.has(key(cx + 1, cy))) return -1;
    }
  }
  if (needCross && cross === 0) return -1;
  return cross;
}

function place(wi, x, y, dir) {
  const [word, clue] = BANK[wi];
  const id = G.nextId++;
  const w = { id, word, clue, x, y, dir, len: word.length, solved: false };
  G.words.set(id, w);
  for (let i = 0; i < word.length; i++) {
    const cx = dir === 'A' ? x + i : x, cy = dir === 'A' ? y : y + i;
    const k = key(cx, cy);
    let c = G.cells.get(k);
    if (!c) { c = { x: cx, y: cy, ans: word[i], ch: '', solved: false, across: null, down: null, num: 0 }; G.cells.set(k, c); }
    if (dir === 'A') c.across = id; else c.down = id;
    if (cy > G.maxY) G.maxY = cy;
  }
  stradAdd(w, 1);
  G.used.set(word, (G.used.get(word) || 0) + 1);
  G.recent.push(word);
  if (G.recent.length > Math.max(4, Math.min(RECENT, BANK.length >> RECSHIFT))) G.recent.shift();
  return w;
}

/**
 * 세로 단어가 y 줄의 경계를 가로지르면 그 줄은 걷어낼 수 없다.
 * G.strad 는 "그 경계를 가로지르는 세로 단어 수"를 줄마다 세어 둔 것.
 */
function stradAdd(w, sign) {
  if (w.dir !== 'D') return;
  for (let r = w.y + 1; r < w.y + w.len; r++) {
    const n = (G.strad.get(r) || 0) + sign;
    if (n > 0) G.strad.set(r, n); else G.strad.delete(r);
  }
}

function rebuildStrad() {
  G.strad = new Map();
  for (const w of G.words.values()) stradAdd(w, 1);
}

/** 이 단어가 다른 단어와 겹치는 횟수 */
function crossCount(w) {
  let n = 0;
  for (const c of wordCells(w)) if (c.across !== null && c.down !== null) n++;
  return n;
}

/** 이미 여러 번 쓴 단어는 뒤로 미룬다 (겹침 하나 값은 못 넘게 벌점을 묶어 둔다) */
let WEAR = 24, WEARCAP = 120, RECSHIFT = 3;  // 같은 단어를 돌려 쓰지 않게 하는 벌점.
                     // 오래 «겹침 하나 값(100) 은 못 넘게» 24 로 묶어 두었는데, 그러면
                     // 열 번 쓴 말도 벌점이 24 뿐이라 잘 물리는 말만 계속 나왔다.
                     // 창고를 891→1288개로 불린 뒤에는 뚜껑을 120 까지 올려도 판이
                     // 안 성긴다. 300줄에 나오는 서로 다른 말 135→258개(시사),
                     // 최다 반복 10.5→3.0회. 다섯 번을 넘겨 나오는 말이 거의 없다
let OFFPICK = 26;    // 고르지 않은 갈래의 단어에 매기는 벌점.
                     // 겹침 하나 값이 100 이므로 이 값이 100 을 넘으면 사실상 하드 필터가 되는데,
                     // 그러면 고른 갈래 비율은 100% 가 되지만 채움이 0.30, 겹침이 0.78 로 무너진다.
                     // 26 이면 판은 그대로 촘촘하고(겹침 1.4~1.5) 고른 갈래가 절반 남짓 나온다.
/*
 * 한쪽 층만 내보내려면 벌점이 겹침 하나 값(100)을 넘어야 한다 — 그 아래로는
 * «겹치는 쪽» 이 늘 이기므로 반대편 말이 6~18% 씩 섞여 든다. 기초를 고른
 * 사람에게 그 정도가 섞이면 기초로 느껴지지 않는다.
 * 다만 잠그려면 그 층 창고가 넉넉해야 한다. 얇은 층을 잠그면 판이 성겨진다
 * (동물 기초 148개를 잠그니 채움이 0.32에서 0.26으로 떨어졌다).
 * 그래서 창고가 LOCKAT 을 넘을 때만 잠그고, 얇으면 예전처럼 «우선» 만 준다.
 */
let SHUT = 130, LEAN = 34, LOCKAT = 150;
// LOCKAT 은 처음에 180 이었다. 로봇 기초를 «하나마나한 말» 없이 추리니 157개가 됐고,
// 그 크기에서 재 보니 잠그면 채움 0.41→0.33, 안 잠그면 심화가 25% 섞인다.
// 기초를 고른 사람에게 넷 중 하나가 심화면 기초가 아니다 — 채움을 조금 내주고 잠근다.
let HARD = LEAN;    // 쉽게 모드에서 기초가 아닌 말에 매기는 벌점 (loadBank 에서 정해진다)
let DEEP = 20;      // «쉽게» 를 껐을 때 기초 말에 매기는 벌점. 같은 규칙으로 정한다
let NEW = 11;       // 요즘 말에 주는 가산점. 벌점을 깎아 앞자리로 당긴다.
                    // 요즘 말이 일흔다섯 개로 늘어 22 로는 판의 삼분의 이를 차지했다
const wornOut = word =>
  Math.min(WEARCAP, WEAR * (G.used.get(word) || 0)) + (ONTOPIC.has(word) ? 0 : OFFPICK)
  + (EASY && BASIC.size && !BASIC.has(word) ? HARD : 0)
  + (!EASY && TIERED && BASIC.has(word) ? DEEP : 0)
  - (FRESH.has(word) ? NEW : 0);

/**
 * 이 단어를 여기 놓으면 나중에 몇 개나 더 엮을 수 있을지.
 * 아직 안 겹친 "겹칠 수 있는 칸"마다, 거기에 붙일 수 있는 단어가 몇 개인지 더한다.
 * 세로로 붙이려면 그 음절이 단어의 짝수 번째에 있어야 하지만(세로는 가로줄에서 시작),
 * 가로로 붙이는 데는 그런 제약이 없다.
 */
function lookahead(word, x, y, dir) {
  let n = 0;
  const step = dir === 'A' ? 1 : 2;
  const start = dir === 'A' ? ((x & 1) ? 1 : 0) : 0;   // 가로는 짝수 칸에 놓인 글자만
  for (let i = start; i < word.length; i += step * (dir === 'A' ? 2 : 1)) {
    const cx = dir === 'A' ? x + i : x, cy = dir === 'A' ? y : y + i;
    const c = G.cells.get(key(cx, cy));
    if (c && c.across !== null && c.down !== null) continue;     // 이미 겹친 자리
    const table = dir === 'A' ? EVEN : ALL;
    n += Math.min(table.get(word[i]) || 0, 10);
  }
  return n;
}

/**
 * 한 칸을 발판 삼아 직각 방향으로 단어 하나 놓기.
 * 맞는 것 아무거나 집지 않고 후보를 모두 재 본 뒤,
 * 겹침이 가장 많이 생기는 자리를 고른다 (같으면 긴 단어 쪽).
 */
function tryAt(cell, dir, lo, hi) {
  if ((dir === 'A' ? cell.across : cell.down) !== null) return false;
  const cands = INDEX.get(cell.ans);
  if (!cands) return false;
  let best = null, bestScore = -1;
  for (const { wi, pos } of cands) {
    const [word] = BANK[wi];
    if (G.recent.includes(word)) continue;
    const x = dir === 'A' ? cell.x - pos : cell.x;
    const y = dir === 'A' ? cell.y : cell.y - pos;
    if (y < lo) continue;
    if ((dir === 'D' ? y + word.length - 1 : y) > hi) continue;
    const cross = fits(word, x, y, dir, true);
    if (cross < 0) continue;
    const score = cross * 100 + lookahead(word, x, y, dir) + word.length - wornOut(word) + Math.random();
    if (score > bestScore) { bestScore = score; best = { wi, x, y }; }
  }
  if (!best) return false;
  place(best.wi, best.x, best.y, dir);
  return true;
}

/** 겹침이 모자란 단어를 찾아, 아직 안 겹친 칸마다 직각 단어를 붙인다 */
function reinforce(lo, hi) {
  let placed = 0;
  const targets = [];
  for (const w of G.words.values()) {
    const end = w.y + (w.dir === 'D' ? w.len - 1 : 0);
    if (w.y >= lo && end <= hi && crossCount(w) < TARGET_CROSS) targets.push(w);
  }
  for (const w of shuffle(targets)) {
    const cells = wordCells(w);
    const dir = w.dir === 'A' ? 'D' : 'A';
    for (const i of shuffle(cells.map((_, i) => i))) {
      if (crossCount(w) >= TARGET_CROSS) break;
      if (tryAt(cells[i], dir, lo, hi)) placed++;
    }
  }
  return placed;
}

const rowHasAcross = y => {
  for (const c of G.cells.values()) if (c.y === y && c.across !== null) return true;
  return false;
};

/** 한 가로줄에 가로 단어 놓기. free 면 맨땅에도 심는다 */
function seedAcross(y, lo, hi, free) {
  const anchors = [];
  for (const c of G.cells.values()) if (c.y === y && c.across === null) anchors.push(c);
  for (const c of shuffle(anchors)) if (tryAt(c, 'A', lo, hi)) return true;
  if (!free) return false;
  let best = null, bestScore = -1;
  for (let t = 0; t < 120; t++) {
    const wi = (Math.random() * BANK.length) | 0;
    const [word] = BANK[wi];
    if (word.length > W || G.recent.includes(word)) continue;
    const x = (Math.random() * (W - word.length + 1)) | 0;
    if (fits(word, x, y, 'A', false) < 0) continue;
    const score = lookahead(word, x, y, 'A') + word.length - wornOut(word) + Math.random();
    if (score > bestScore) { bestScore = score; best = { wi, x }; }
  }
  if (!best) return false;
  place(best.wi, best.x, y, 'A');
  return true;
}

/**
 * 밴드 하나를 짠다.
 * 순서가 중요하다 — 가로줄을 먼저 다 채워 놓고 세로를 끼우려 하면
 * 세로 단어가 서너 글자를 한꺼번에 맞춰야 해서 거의 안 들어간다.
 * 그래서 이미 놓인 단어에 "한 글자만" 걸치는 자리를 번갈아 늘려 간다.
 */
function buildBand(top) {
  const bottom = top + BAND - 1;
  const aRows = [];
  for (let y = top; y <= bottom; y += 2) aRows.push(y);
  seedAcross(aRows[0], top, bottom, true);
  for (let round = 0; round < 40; round++) {
    let placed = reinforce(top, bottom);
    // 세로 단어가 지나가며 생긴 칸에만 가로 단어를 엮는다
    for (const y of aRows) if (!rowHasAcross(y) && seedAcross(y, top, bottom, false)) placed++;
    if (placed) continue;
    // 더는 엮을 데가 없으면 빈 가로줄 하나에 새 뭉치를 시작한다
    const y = aRows.find(r => !rowHasAcross(r));
    if (y === undefined || !seedAcross(y, top, bottom, true)) break;
  }
}

/** 밴드에 놓인 단어를 모두 되돌린다 (밴드끼리는 서로 물려 있지 않으므로 안전하다) */
function undoFrom(mark, recentMark) {
  for (const [id, w] of [...G.words]) {
    if (id < mark) continue;
    for (const c of wordCells(w)) {
      if (w.dir === 'A') c.across = null; else c.down = null;
      if (c.across === null && c.down === null) G.cells.delete(key(c.x, c.y));
    }
    stradAdd(w, -1);
    const n = (G.used.get(w.word) || 0) - 1;
    if (n > 0) G.used.set(w.word, n); else G.used.delete(w.word);
    G.words.delete(id);
  }
  G.nextId = mark;
  G.recent.length = recentMark;
}

/** 같은 밴드를 여러 번 짜 보고 제일 촘촘하게 물린 것을 남긴다 */
function buildBandBest(top, tries) {
  const mark = G.nextId, recentMark = G.recent.length;
  let best = null;
  for (let t = 0; t < tries; t++) {
    buildBand(top);
    let cross = 0, cells = 0, onTopic = 0;
    for (const [id, w] of G.words) if (id >= mark) { cross += crossCount(w); if (ONTOPIC.has(w.word)) onTopic++; }
    for (const c of G.cells.values()) if (c.y >= top && c.y < top + BAND) cells++;
    const score = cross * 3 + cells + onTopic * 3;   // 촘촘하고, 고른 갈래가 많이 든 밴드로
    const snap = [...G.words.values()].filter(w => w.id >= mark).map(w => [w.word, w.x, w.y, w.dir]);
    if (!best || score > best.score) best = { score, snap };
    undoFrom(mark, recentMark);
    if (best.score >= 9 * 3 + 40) break;      // 충분히 잘 나왔으면 그만
  }
  if (!best) return;
  const at = new Map(BANK.map(([w], i) => [w, i]));
  const made = [];
  for (const [word, x, y, dir] of best.snap) made.push(place(at.get(word), x, y, dir));
  if (G.maxY < top) G.maxY = top;
  G.filledTo = Math.max(G.filledTo, top + BAND - 1);
  if (EASY) giveFirst(made);
}

/*
 * 쉽게 모드에서 첫 글자를 여는 낱말은 «아무 데도 안 걸린 것» 뿐이다.
 * 처음에는 모든 낱말의 첫 글자를 열어 봤는데, 그러면 떠올릴 일이 없어져
 * 외우려고 푸는 판에서 남는 게 없다. 다른 낱말과 한 칸도 겹치지 않는 낱말은
 * 힌트 말고는 실마리가 아예 없으니, 거기만 한 글자를 준다.
 */
function giveFirst(ws) {
  for (const w of ws) {
    if (crossCount(w)) continue;
    const c = wordCells(w)[0];
    if (c && !c.ch) { c.ch = c.ans; c.given = true; }
  }
}

const bandTopAtOrAfter = y => {
  const off = (((y + G.bandOff) % BAND) + BAND) % BAND;
  return off === 0 ? y : y + (BAND - off);
};

/** targetY 줄까지 밴드를 이어 붙인다 */
function grow(targetY) {
  if (G.cells.size === 0) buildBandBest(bandTopAtOrAfter(0), 12);
  let guard = 0;
  while (G.filledTo < targetY && guard++ < 200) buildBandBest(bandTopAtOrAfter(G.filledTo + 1), 12);
  number();
}

/** 화면 순서대로 단어 번호 매기기 (지나간 줄의 번호는 건드리지 않고 그 뒤로 잇는다) */
function number() {
  const starts = [...G.cells.values()].filter(c => !c.past).sort((a, b) => a.y - b.y || a.x - b.x);
  let n = G.numBase;
  for (const c of starts) {
    const a = c.across !== null && G.words.get(c.across).x === c.x && G.words.get(c.across).y === c.y;
    const d = c.down !== null && G.words.get(c.down).x === c.x && G.words.get(c.down).y === c.y;
    c.num = (a || d) ? ++n : 0;
    if (a) G.words.get(c.across).num = c.num;
    if (d) G.words.get(c.down).num = c.num;
  }
}

const wordCells = w => Array.from({ length: w.len }, (_, i) =>
  G.cells.get(key(w.dir === 'A' ? w.x + i : w.x, w.dir === 'A' ? w.y : w.y + i)));

/* ───────── 상태·판정 ───────── */
const S = { cur: null, dir: 'A', comp: { cho: '', jung: '', jong: '' } };

function checkWords(cell) {
  let gained = 0;
  for (const id of [cell.across, cell.down]) {
    if (id === null) continue;
    const w = G.words.get(id);
    if (w.solved) continue;
    const cs = wordCells(w);
    if (cs.every(c => c.ch === c.ans)) {
      w.solved = true;
      cs.forEach(c => { c.solved = true; });
      G.solvedCount++;
      gained += 10 + w.len * 2;
    }
  }
  if (gained) { G.score += gained; flash(gained); }
  return gained;
}

/**
 * 다 채웠는데 틀린 단어를 표시해 둔다.
 * 밴드가 안 걷히는데 어디가 틀렸는지 모르면 손쓸 데가 없다.
 * 어느 칸이 틀렸는지까지는 알려 주지 않는다 — 그건 답을 알려 주는 것이나 같다.
 */
function markBad() {
  for (const w of G.words.values()) {
    if (w.past) continue;
    const cs = wordCells(w);
    w.bad = !w.solved && cs.every(c => c.ch) && cs.some(c => c.ch !== c.ans);
  }
}

/** 아직 푸는 중인 줄 가운데, 위에서부터 통째로 풀린 데까지의 새 경계 (절대 좌표) */
function clearableY() {
  let limit = G.top;
  for (let y = G.top; y <= G.maxY; y++) {
    let ok = true;
    for (let x = 0; x < W; x++) {
      const c = G.cells.get(key(x, y));
      if (c && c.ch !== c.ans) { ok = false; break; }
    }
    if (!ok) break;
    limit = y + 1;
  }
  if (limit === G.top) return G.top;
  let best = G.top;
  for (let y = G.top + 1; y <= limit; y++) {
    let straddle = false;
    for (const w of G.words.values()) {
      if (w.dir === 'D' && w.y < y && w.y + w.len > y) { straddle = true; break; }
    }
    if (!straddle) best = y;
  }
  return best;
}

/*
 * 윗줄을 다 풀면 걷어내는 대신 "지나온 줄"로 넘긴다.
 * 지우지 않으므로 위로 스크롤하면 언제든 다시 볼 수 있고(복습),
 * 대신 색을 한 단계씩 옅게 해서 처리한 데라는 것을 보여 준다.
 * 좌표가 밀리지 않으니 홀짝도 밴드 경계도 번호도 그대로다.
 */
function collapse() {
  const n = clearableY();
  if (n <= G.top) return false;
  const rows = n - G.top;
  for (const c of G.cells.values()) if (c.y >= G.top && c.y < n) c.past = true;
  for (const w of G.words.values())
    if (!w.past && w.y + (w.dir === 'D' ? w.len - 1 : 0) < n) w.past = true;
  G.top = n;
  G.depth += rows;
  G.score += rows * 5;
  // 지나간 칸의 번호는 그대로 두고, 아직 푸는 줄만 그 뒤로 이어 매긴다
  for (const c of G.cells.values()) if (c.past && c.num > G.numBase) G.numBase = c.num;
  if (S.cur) {
    const y = +S.cur.split(',')[1];
    if (y < G.top) S.cur = null;
  }
  forget();
  number();
  return true;
}

/** 너무 오래된 줄은 버린다 — 끝없이 쌓이면 저장도 그리기도 무거워진다 */
function forget() {
  let cut = G.top - KEEP;
  if (cut <= 0) return;
  // 세로 단어가 걸친 자리에서 자르면 반쪽 단어가 남는다. 안 걸친 줄까지 물러난다
  const straddles = y => {
    for (const w of G.words.values()) if (w.dir === 'D' && w.y < y && w.y + w.len > y) return true;
    return false;
  };
  while (cut > 0 && straddles(cut)) cut--;
  if (cut <= 0) return;
  for (const [k, c] of [...G.cells]) if (c.y < cut) G.cells.delete(k);
  for (const [id, w] of [...G.words]) if (w.y + (w.dir === 'D' ? w.len - 1 : 0) < cut) G.words.delete(id);
}

/* ───────── 화면 ───────── */
const board = document.getElementById('board');
const layer = document.getElementById('layer');
const scroller = document.getElementById('scroller');
const els = new Map();       // 칸 객체 → div (화면 언저리에 있는 것만 들고 있는다)
const decos = new Map();     // "x,y" → 빈자리에 붙인 이모지
const nowline = document.createElement('div');   // 여기서부터가 아직 푸는 줄
nowline.id = 'nowline';
nowline.hidden = true;
layer.appendChild(nowline);
let C = 44;                  // 칸 크기(px)

function sizeCells() {
  const avail = Math.min(scroller.clientWidth - 12, 520);
  C = Math.max(28, Math.floor(avail / W));
  document.documentElement.style.setProperty('--c', C + 'px');
  layer.style.width = W * C + 'px';
}

function vanish(cell) {
  const el = els.get(cell);
  if (!el) return;
  els.delete(cell);
  el.remove();      // 화면 밖으로 나간 칸일 뿐이다 — 다시 올라오면 그대로 다시 그린다
}

/*
 * 빈자리 꾸미기 — 어린이 단어장은 판이 휑하면 재미가 없다.
 * 칸이 없는 자리 열몇 곳에 하나꼴로 이모지를 놓는다. 자리와 그림은 좌표로만
 * 정하므로(어림수 아님) 스크롤해서 다시 와도 그 자리에 그대로 있다.
 * 누를 수 없고, 나중에 그 자리에 칸이 생기면 저절로 비켜난다.
 */
const 어림 = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

function renderDeco(from, to) {
  if (!DECO.length) {
    if (decos.size) { for (const el of decos.values()) el.remove(); decos.clear(); }
    return;
  }
  const live = new Set();
  for (let y = Math.max(0, from); y <= to; y++) {
    for (let x = 0; x < W; x++) {
      const k = key(x, y);
      if (G.cells.has(k)) continue;
      const h = 어림(x, y);
      if (h % 6) continue;                     // 여섯 자리에 하나쯤 — 팍팍 붙인다
      live.add(k);
      let el = decos.get(k);
      if (!el) {
        // 그림은 «다른» 해시로 고른다. 자리를 고른 h 를 그대로 나누면
        // 스티커가 열여덟 개라도 h%9==0 인 것들의 h%18 은 두 값뿐이라
        // 판에 강아지와 개구리만 깔린다
        const g = 어림(y + 7919, x + 104729);
        el = document.createElement('div');
        el.className = 'deco';
        el.innerHTML = '<b></b>';
        el.firstChild.textContent = DECO[g % DECO.length];
        // 크기와 기울기를 조금씩 달리해 손으로 붙인 스티커처럼 보이게 한다
        el.style.setProperty('--dz', (0.44 + (g >> 5) % 5 * 0.045).toFixed(3));
        el.style.setProperty('--dr', (((g >> 11) % 25) - 12) + 'deg');
        layer.appendChild(el);
        decos.set(k, el);
      }
      const tf = `translate(${x * C}px, ${y * C}px)`;
      if (el._tf !== tf) { el.style.transform = tf; el._tf = tf; }
      el.classList.toggle('past', y < G.top);
    }
  }
  for (const [k, el] of [...decos]) if (!live.has(k)) { el.remove(); decos.delete(k); }
}

function render() {
  layer.style.height = (G.maxY + 2) * C + 'px';
  const w = curWord();
  const inWord = w ? new Set(wordCells(w)) : null;
  const bad = new Set();
  for (const w of G.words.values()) if (w.bad) for (const c of wordCells(w)) bad.add(c);
  // 판은 이제 지워지지 않고 계속 길어지므로, 화면 언저리만 DOM 에 둔다
  const from = Math.floor(scroller.scrollTop / C) - WINDOW;
  const to = Math.ceil((scroller.scrollTop + scroller.clientHeight) / C) + WINDOW;
  const live = new Set();
  for (const [k, c] of G.cells) {
    if (c.y < from || c.y > to) continue;
    live.add(c);
    let el = els.get(c);
    if (!el) {
      el = document.createElement('div');
      el.className = 'cell';
      el.innerHTML = '<b></b><i></i>';
      el._b = el.firstChild; el._i = el.lastChild;
      el.addEventListener('pointerdown', e => { e.preventDefault(); tap(key(c.x, c.y)); });
      layer.appendChild(el);
      els.set(c, el);
      el.style.transform = `translate(${c.x * C}px, ${c.y * C}px)`;
      if (!c.seen) {                        // 새로 생긴 칸만 나타나는 시늉을 한다
        c.seen = true;
        el.classList.add('born');
        requestAnimationFrame(() => el.classList.remove('born'));
      }
    }
    const txt = c.ch || '', num = c.num ? String(c.num) : '';
    if (el._b.textContent !== txt) el._b.textContent = txt;
    if (el._i.textContent !== num) el._i.textContent = num;
    const tf = `translate(${c.x * C}px, ${c.y * C}px)`;
    if (el._tf !== tf) { el.style.transform = tf; el._tf = tf; }
    el.classList.toggle('solved', c.solved);
    el.classList.toggle('wrong', !c.solved && bad.has(c));
    el.classList.toggle('cur', k === S.cur);
    el.classList.toggle('inword', !!inWord && inWord.has(c));
    el.classList.toggle('past', !!c.past);
  }
  for (const c of [...els.keys()]) if (!live.has(c)) vanish(c);
  renderDeco(from, to);
  nowline.style.transform = `translateY(${G.top * C}px)`;
  nowline.hidden = !G.top;
  document.getElementById('depth').textContent = G.depth;
  document.getElementById('solved').textContent = G.solvedCount;
  document.getElementById('score').textContent = G.score;
  syncKeyboard();
  renderClue();
  renderList();
}

function curWord() {
  if (!S.cur) return null;
  const c = G.cells.get(S.cur);
  if (!c) return null;
  const id = S.dir === 'A' ? c.across : c.down;
  if (id !== null) return G.words.get(id);
  const alt = S.dir === 'A' ? c.down : c.across;
  return alt !== null ? G.words.get(alt) : null;
}

function renderClue() {
  const w = curWord();
  const bar = document.getElementById('clue');
  if (!w) { bar.innerHTML = '<span class="ph">칸을 눌러 시작하세요</span>'; return; }
  const kind = KIND.get(w.word) || '';
  bar.innerHTML =
    '<div class="meta">' +
      `<span class="tag ${w.dir === 'A' ? 'a' : 'd'}">${w.num} ${w.dir === 'A' ? '가로' : '세로'}</span>` +
      (w.bad ? '<span class="tag bad">틀림</span>' : '') +
      `<span class="len">${kind ? kind + ' · ' : ''}${w.len}${isAlpha(w.word[0]) ? '자 (영문)' : '글자'}</span>` +
    '</div>' +
    `<p class="txt">${w.clue}</p>`;
}

function renderList() {
  const box = document.getElementById('list');
  if (!box.offsetParent) return;
  const from = Math.floor(scroller.scrollTop / C) - 2;
  const to = Math.ceil((scroller.scrollTop + scroller.clientHeight) / C) + 2;
  const ws = [...G.words.values()]
    .filter(w => w.y + (w.dir === 'D' ? w.len - 1 : 0) >= from && w.y <= to)
    .sort((a, b) => a.num - b.num);
  const row = w => `<li class="${w.solved ? 'ok' : ''} ${curWord() === w ? 'on' : ''}" data-id="${w.id}">` +
    `<b>${w.num}</b><span>${w.clue}</span></li>`;
  box.innerHTML =
    `<h3>가로</h3><ul>${ws.filter(w => w.dir === 'A').map(row).join('')}</ul>` +
    `<h3>세로</h3><ul>${ws.filter(w => w.dir === 'D').map(row).join('')}</ul>`;
}

document.getElementById('list').addEventListener('click', e => {
  const li = e.target.closest('li');
  if (!li) return;
  const w = G.words.get(+li.dataset.id);
  if (!w) return;
  S.dir = w.dir;
  const cs = wordCells(w);
  S.cur = key((cs.find(c => !c.solved) || cs[0]).x, (cs.find(c => !c.solved) || cs[0]).y);
  S.comp = disassemble(G.cells.get(S.cur).ch);
  scrollTo(G.cells.get(S.cur));
  render();
});

let flashT;
function flash(v) {
  const el = document.getElementById('flash');
  el.textContent = typeof v === 'number' ? '+' + v : v;
  el.classList.add('on');
  clearTimeout(flashT);
  flashT = setTimeout(() => el.classList.remove('on'), 700);
}

function scrollTo(c) {
  const top = c.y * C, bot = top + C;
  const h = scroller.clientHeight;
  // 자판이 올라오면 판이 보이는 높이가 세 줄도 안 된다. 여백을 그만큼 줄여야 칸이 안 가린다
  const m = Math.min(C * 2, Math.max(0, (h - C) / 2));
  const vt = scroller.scrollTop, vb = vt + h;
  if (top < vt + m) scroller.scrollTo({ top: Math.max(0, top - m), behavior: 'smooth' });
  else if (bot > vb - m) scroller.scrollTo({ top: bot - h + m, behavior: 'smooth' });
}

/* ───────── 조작 ───────── */
function tap(k) {
  const c = G.cells.get(k);
  if (!c) return;
  resetShift();
  if (S.cur === k) {
    const other = S.dir === 'A' ? 'D' : 'A';
    if ((other === 'A' ? c.across : c.down) !== null) S.dir = other;
  } else {
    S.cur = k;
    if ((S.dir === 'A' ? c.across : c.down) === null) S.dir = S.dir === 'A' ? 'D' : 'A';
  }
  S.comp = disassemble(c.ch);
  render();
  focusIME();
  scrollTo(c);
}

function advance() {
  const w = curWord();
  if (!w) return;
  const cs = wordCells(w);
  const i = cs.findIndex(c => key(c.x, c.y) === S.cur);
  for (let j = i + 1; j < cs.length; j++) {
    if (!cs[j].solved) { S.cur = key(cs[j].x, cs[j].y); S.comp = disassemble(cs[j].ch); return; }
  }
  const next = cs[i + 1];
  if (next) { S.cur = key(next.x, next.y); S.comp = disassemble(next.ch); }
}

function retreat() {
  const w = curWord();
  if (!w) return false;
  const cs = wordCells(w);
  const i = cs.findIndex(c => key(c.x, c.y) === S.cur);
  if (i <= 0) return false;
  S.cur = key(cs[i - 1].x, cs[i - 1].y);
  S.comp = disassemble(cs[i - 1].ch);
  return true;
}

function input(j) {
  if (!S.cur) return;
  let c = G.cells.get(S.cur);
  if (!c) return;
  if (c.solved) { advance(); c = G.cells.get(S.cur); if (!c || c.solved) { render(); return; } }
  const r = feed(S.comp, j);
  if (r.done !== undefined) {
    c.ch = r.done;
    checkWords(c);
    advance();
    const n = G.cells.get(S.cur);
    if (n && !n.solved) { S.comp = r.cur; n.ch = assemble(r.cur); checkWords(n); }
    else S.comp = disassemble(n ? n.ch : '');
  } else {
    S.comp = r.cur;
    c.ch = assemble(r.cur);
    checkWords(c);
  }
  after();
}

/** 알파벳 칸에 글자 하나를 넣고 다음 칸으로 */
function putChar(ch) {
  if (!S.cur) return;
  let c = G.cells.get(S.cur);
  if (!c) return;
  if (c.solved) { advance(); c = G.cells.get(S.cur); if (!c || c.solved) { render(); return; } }
  c.ch = ch.toUpperCase();
  S.comp = { cho: '', jung: '', jong: '' };
  checkWords(c);
  advance();
  after();
}

function backspace() {
  if (!S.cur) return;
  const c = G.cells.get(S.cur);
  if (!c) return;
  if (!c.solved) {
    const u = unfeed(S.comp);
    if (u && (u.cho || u.jung)) { S.comp = u; c.ch = assemble(u); render(); return; }
    if (c.ch) { c.ch = ''; S.comp = { cho: '', jung: '', jong: '' }; render(); return; }
  }
  if (retreat()) {
    const p = G.cells.get(S.cur);
    if (p && !p.solved) { p.ch = ''; S.comp = { cho: '', jung: '', jong: '' }; }
  }
  render();
}

function hint() {
  resetShift();
  if (!S.cur) return;
  const w = curWord();
  const c = G.cells.get(S.cur);
  const target = (c && !c.solved) ? c : (w ? wordCells(w).find(x => !x.solved) : null);
  if (!target) return;
  target.ch = target.ans;
  G.hints++;
  G.score = Math.max(0, G.score - (EASY ? 4 : 8));
  S.cur = key(target.x, target.y);
  S.comp = disassemble(target.ch);
  checkWords(target);
  advance();
  after();
}

/** 도저히 안 되는 단어를 통째로 연다. 한 칸씩 여는 것과 값은 같다 */
function openWord() {
  resetShift();
  const w = curWord();
  if (!w) return;
  for (const c of wordCells(w)) {
    if (c.solved || c.ch === c.ans) continue;
    c.ch = c.ans;
    G.hints++;
    G.score = Math.max(0, G.score - 8);
    checkWords(c);
  }
  after();
  focusIME();
}

function move(dx, dy) {
  if (!S.cur) return;
  let [x, y] = S.cur.split(',').map(Number);
  for (let i = 0; i < 30; i++) {
    x += dx; y += dy;
    if (x < 0 || x >= W || y < 0) return;
    const c = G.cells.get(key(x, y));
    if (c) { S.cur = key(x, y); S.comp = disassemble(c.ch); scrollTo(c); render(); focusIME(); return; }
    if (y > G.maxY) return;
  }
}

/** 지금 자리에서 가장 가까운 미해결 단어로 옮겨 간다 */
/*
 * 지금 단어를 다 풀었을 때 옮겨 갈 자리.
 * 방금 있던 칸을 지나는 다른 단어가 아직 안 풀렸으면 거기가 제일 자연스럽고,
 * 없으면 화면 안에 있는 단어를 먼저 고른다. 화면 밖으로 튀면 어디로 갔는지 모른다.
 */
/*
 * 지금 낱말을 다 풀었을 때 옮겨 갈 자리.
 *
 * 기준은 «맨 위에 남은 낱말» 이다. 가까운 데로 옮겨 가게 했더니 아래로만
 * 쭉쭉 흘러, 윗줄 여섯 줄을 못 채운 채 판만 길어졌다. 아래를 먼저 풀 수는
 * 있어도 그다음에는 위로 돌아와 마저 채워야 밴드가 걷히고 «해냈다» 가 생긴다.
 *
 * 다만 지금 칸에 십자로 걸린 낱말이 «맨 위에 남은 낱말과 같은 밴드» 에 있으면
 * 그리로 간다. 같은 밴드 안에서는 십자로 이어 가는 편이 훨씬 자연스럽다.
 */
function jumpNearest(quiet) {
  const c = S.cur ? G.cells.get(S.cur) : null;
  let best = null;
  for (const w of G.words.values()) {              // 맨 위에 남은 낱말
    if (w.solved || w.past) continue;
    if (!best || w.y < best.y || (w.y === best.y && w.x < best.x)) best = w;
  }
  if (c && best) {
    for (const id of [c.across, c.down]) {
      const w = id !== null ? G.words.get(id) : null;
      if (w && !w.solved && !w.past && bandOf(w.y) === bandOf(best.y)) { best = w; break; }
    }
  }
  if (!best) return;
  S.dir = best.dir;
  const t = wordCells(best).find(x => !x.solved) || wordCells(best)[0];
  S.cur = key(t.x, t.y);
  S.comp = disassemble(t.ch);
  if (!quiet) scrollTo(t);        // 줄을 넘긴 직후에는 따라 내려가는 스크롤 하나만 쓴다
}

function nextWord(step) {
  resetShift();
  const ws = [...G.words.values()].filter(w => !w.solved).sort((a, b) => a.num - b.num || (a.dir < b.dir ? -1 : 1));
  if (!ws.length) return;
  const cw = curWord();
  let i = cw ? ws.indexOf(cw) : -1;
  i = (i + step + ws.length) % ws.length;
  const w = ws[i];
  S.dir = w.dir;
  const c = wordCells(w).find(x => !x.solved) || wordCells(w)[0];
  S.cur = key(c.x, c.y);
  S.comp = disassemble(c.ch);
  scrollTo(c);
  render();
  focusIME();
}

/** 입력 뒤 뒷정리: 줄 걷어내기 + 아래 생성 + 저장 */
function after() {
  let cleared = 0;
  for (;;) {
    const before = G.depth;
    if (!collapse()) break;
    cleared += G.depth - before;
  }
  ensureAhead();
  markBad();
  if (cleared) {
    flash(cleared + '줄 넘김!');
    board.classList.add('lift');
    setTimeout(() => board.classList.remove('lift'), 400);
  }
  const w = curWord();
  if (!S.cur || (w && w.solved)) jumpNearest(cleared > 0);
  if (cleared) {
    const want = Math.max(0, G.top * C - 6);      // 지나온 줄은 위에 남기고 시선만 내린다
    if (scroller.scrollTop < want) scroller.scrollTo({ top: want, behavior: 'smooth' });
  } else {
    // 지금 쓰는 칸은 언제나 보이는 데 있어야 한다 (자판이 아래를 가리는 폰에서 특히)
    const cc = S.cur && G.cells.get(S.cur);
    if (cc) scrollTo(cc);
  }
  render();
  save();
  if (useIME() && !composing) anchorIME();
}

function ensureAhead() {
  const bottomRow = Math.ceil((scroller.scrollTop + scroller.clientHeight) / C);
  // 위로 올려 복습하는 중이어도 푸는 자리는 늘 넉넉히 깔려 있어야 한다
  const need = Math.max(bottomRow, G.top) + AHEAD;
  if (G.maxY < need) grow(need);
}


/* ───────── 기기 자판(IME) 입력 ─────────
 * 화면 자판을 쓰지 않을 때는 눈에 안 보이는 입력칸에 포커스를 준다.
 * 그러면 폰은 자기가 쓰던 한글 자판(두벌식이든 천지인이든)이 그대로 올라오고,
 * PC는 한/영을 한글에 두고 쳐도 된다.
 *
 * 조합 중인 글자는 브라우저가 입력칸 안에서 만들어 주므로,
 * 우리는 입력칸의 값을 그대로 칸에 비추기만 한다 (imeSync).
 * 조합 중에는 줄을 걷어내지 않는다 — 칸이 사라지면 비출 자리가 어긋나기 때문에,
 * 걷어내기는 조합이 끝나는 순간으로 미룬다.
 */
const ime = document.getElementById('ime');
let imeCells = [];        // 지금 입력이 차례로 들어갈 칸들
let composing = false;
let pendingAfter = false;

/** 지금 고른 낱말이 알파벳 약어인가 */
function alphaMode() {
  const w = curWord();
  return !!w && isAlpha(w.word[0]);
}

// 알파벳 낱말일 때는 기기 자판 대신 내장 영문 자판을 쓴다.
// 한글 자판을 켜 둔 폰에서 영문으로 갈아 끼우게 하는 건 번거롭기만 하다.
//
// 캡스락이 켜져 있는 동안도 기기 IME 를 비켜 간다. 윈도 한글 IME 는 캡스락을
// 시프트처럼 써서 ㅂ 자리에 ㅃ 을 보내는데, 그건 조합이 끝난 결과로 오기 때문에
// 우리 쪽에서 되돌릴 방법이 없다. 숨은 입력칸에서 손을 떼면 IME 가 붙을 자리가
// 없어져 글쇠가 날것으로 오고, 그러면 자리(e.code)와 시프트로 우리가 조합한다.
const useIME = () => document.body.classList.contains('nokb') && !alphaMode() && !CAPS;

/** 지금 선택한 자리에 맞춰 입력칸을 비우고 다시 겨눈다 */
function anchorIME(force) {
  const w = curWord();
  imeCells = [];
  if (w) {
    const cs = wordCells(w);
    const i = Math.max(0, cs.findIndex(c => key(c.x, c.y) === S.cur));
    for (let j = i; j < cs.length; j++) if (!cs[j].solved) imeCells.push(cs[j]);
  }
  if (!composing || force) ime.value = '';
}

function focusIME() {
  if (!useIME()) return;
  anchorIME();
  if (document.activeElement !== ime) ime.focus({ preventScroll: true });
}

/** 입력칸의 글자를 칸에 그대로 비춘다 */
function imeSync() {
  // 줄이 걷혀 칸이 사라졌으면 다시 겨눈다
  if (imeCells.some(c => G.cells.get(key(c.x, c.y)) !== c)) { anchorIME(true); return; }
  if (!imeCells.length) { ime.value = ''; return; }
  const chars = [...ime.value].slice(0, imeCells.length);
  imeCells.forEach((c, i) => { c.ch = chars[i] || ''; });
  const at = imeCells[Math.min(chars.length, imeCells.length - 1)];
  if (at) S.cur = key(at.x, at.y);
  S.comp = disassemble(at ? at.ch : '');
  for (const c of imeCells) checkWords(c);
  if (composing) { render(); save(); pendingAfter = true; }   // 조합 중엔 걷어내기 보류
  else after();
}

ime.addEventListener('compositionstart', () => { composing = true; });
ime.addEventListener('compositionend', () => {
  composing = false;
  // 조합이 끝난 뒤에 값을 손대야 안전하다
  setTimeout(() => {
    if (pendingAfter) { pendingAfter = false; after(); }
    anchorIME(true);
  }, 0);
});
ime.addEventListener('input', imeSync);
ime.addEventListener('blur', () => { composing = false; });

/* ───────── 화면 자판 ───────── */
const ROWS = [
  ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'],
  ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'],
  ['⇧','ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ','⌫'],
];
const SHIFTED = { 'ㅂ':'ㅃ','ㅈ':'ㅉ','ㄷ':'ㄸ','ㄱ':'ㄲ','ㅅ':'ㅆ','ㅐ':'ㅒ','ㅔ':'ㅖ' };
const QWERTY = { q:'ㅂ',w:'ㅈ',e:'ㄷ',r:'ㄱ',t:'ㅅ',y:'ㅛ',u:'ㅕ',i:'ㅑ',o:'ㅐ',p:'ㅔ',
                 a:'ㅁ',s:'ㄴ',d:'ㅇ',f:'ㄹ',g:'ㅎ',h:'ㅗ',j:'ㅓ',k:'ㅏ',l:'ㅣ',
                 z:'ㅋ',x:'ㅌ',c:'ㅊ',v:'ㅍ',b:'ㅠ',n:'ㅜ',m:'ㅡ',
                 Q:'ㅃ',W:'ㅉ',E:'ㄸ',R:'ㄲ',T:'ㅆ',O:'ㅒ',P:'ㅖ' };
let shift = false;

/*
 * 붙어 있는 자판으로 칠 때 어느 자모인지 고른다.
 * e.key 를 그대로 보면 캡스락이 켜져 있을 때 q 가 'Q' 로 와서 ㅂ 자리에 ㅃ 이 박히고,
 * ㅁ(a) 처럼 된소리가 없는 자리는 아예 안 먹힌다. 캡스락은 시프트가 아니다.
 * 그래서 자판의 «자리»(e.code) 로 글쇠를 찾고, 된소리 여부는 시프트로만 정한다.
 *
 * 단, 한글 IME 가 잡고 있는 키는 손대지 않는다. 그때는 조합 결과가 숨은 입력칸으로
 * 따로 들어오므로, 여기서 또 넣으면 둘이 같은 칸을 놓고 다툰다.
 */
function jamoOf(e) {
  if (e.isComposing || e.keyCode === 229) return '';   // IME 조합 중
  if (!/^[A-Za-z]$/.test(e.key)) return '';            // 'Process' · 자모 · 음절은 IME 몫
  const m = /^Key([A-Z])$/.exec(e.code || '');
  const low = (m ? m[1] : e.key).toLowerCase();
  // 시프트를 눌렀어도 된소리가 없는 자리(ㅁ, ㄴ …)는 홑소리 그대로
  return (e.shiftKey && QWERTY[low.toUpperCase()]) || QWERTY[low] || '';
}

/*
 * 한글 IME 를 켜 둔 채 캡스락을 켜면, 운영체제가 캡스락을 시프트처럼 써서
 * ㅂ 자리에 ㅃ 을 보낸다 (소꿉놀이의 «꿉» 이 «꾸ㅃ» 이 되는 그 증상).
 * 두벌식에서 시프트 없이 된소리를 칠 방법은 없으므로, 시프트를 안 눌렀는데 온
 * 된소리는 홑소리로 되돌린다. 반대쪽(시프트를 눌렀는데 홑소리로 오는 것)은
 * 멀쩡한 입력과 구별할 수가 없어 건드리지 않는다.
 */
const SINGLE = { 'ㅃ':'ㅂ', 'ㅉ':'ㅈ', 'ㄸ':'ㄷ', 'ㄲ':'ㄱ', 'ㅆ':'ㅅ', 'ㅒ':'ㅐ', 'ㅖ':'ㅔ' };
const capsOn = e => !!(e.getModifierState && e.getModifierState('CapsLock'));
let CAPS = false;
const unCaps = (j, e) => (!e.shiftKey && capsOn(e) && SINGLE[j]) || j;

const ABC = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M','⌫'],
];
let kbMode = '';

function buildKeyboard(mode) {
  if (mode === kbMode) return;
  kbMode = mode;
  const kb = document.getElementById('kb');
  kb.innerHTML = '';
  (mode === 'en' ? ABC : ROWS).forEach(row => {
    const r = document.createElement('div');
    r.className = 'krow';
    row.forEach(k => {
      const b = document.createElement('button');
      b.className = 'key' + (k === '⇧' || k === '⌫' ? ' fn' : '');
      b.dataset.k = k;
      b.textContent = k;
      r.appendChild(b);
    });
    kb.appendChild(r);
  });
  if (mode !== 'en') paintShift();
}

// 자판을 갈아 끼워도 누름은 한 번만 — 판마다 붙이면 두 번씩 들어간다
document.getElementById('kb').addEventListener('pointerdown', e => {
  const b = e.target.closest('.key');
  if (!b) return;
  e.preventDefault();
  const k = b.dataset.k;
  if (k === '⌫') { backspace(); resetShift(); return; }
  if (k === '⇧') { shift = !shift; paintShift(); return; }
  if (kbMode === 'en') { putChar(k); return; }
  input(shift ? (SHIFTED[k] || k) : k);
  if (shift) { shift = false; paintShift(); }
});

/** 고른 낱말에 맞춰 자판을 갈아 끼운다 */
function syncKeyboard() {
  const en = alphaMode();
  if (en !== (kbMode === 'en')) shift = false;    // 자판이 갈리면 눌러 둔 ⇧ 도 푼다
  buildKeyboard(en ? 'en' : 'ko');
  document.body.classList.toggle('abc', en);   // 영문일 때는 내장 자판을 반드시 보인다
  if (en) ime.blur();
}

/*
 * ⇧ 는 한 글자짜리다 — 누른 뒤 다음 자음 하나에만 걸리고 곧바로 풀린다.
 * 지우거나, 다른 칸으로 옮기거나, 자판이 갈리면 그때도 푼다.
 * 안 그러면 눌러 둔 채로 이어져 다음에 엉뚱한 된소리가 들어간다.
 */
function resetShift() {
  if (!shift) return;
  shift = false;
  if (kbMode !== 'en') paintShift();
}

function paintShift() {
  document.querySelectorAll('#kb .key').forEach(b => {
    const k = b.dataset.k;
    if (k === '⇧') { b.classList.toggle('on', shift); return; }
    if (k === '⌫') return;
    b.textContent = shift ? (SHIFTED[k] || k) : k;
  });
}

/* 캡스락은 켜 두면 한글이 깨진다. 켜져 있는 동안은 대놓고 알려 주고,
   그동안은 기기 IME 대신 우리 조합기로 받는다 */
function paintCaps(e) {
  const on = capsOn(e);
  if (on === CAPS) return;
  CAPS = on;
  const bar = document.getElementById('caps');
  if (bar) bar.hidden = !on;
  if (useIME()) focusIME(); else ime.blur();
  sizeCells(); render();
}
window.addEventListener('keyup', paintCaps);

window.addEventListener('keydown', e => {
  paintCaps(e);
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (k === 'Backspace') {
    if (useIME() && document.activeElement === ime && ime.value) return;  // 입력칸이 알아서 지운다
    e.preventDefault(); backspace(); return;
  }
  if (k === 'Tab') { e.preventDefault(); nextWord(e.shiftKey ? -1 : 1); return; }
  if (k === 'Enter') { e.preventDefault(); nextWord(1); return; }
  if (k === ' ') { e.preventDefault(); if (S.cur) { const c = G.cells.get(S.cur); S.dir = S.dir === 'A' ? 'D' : 'A'; if ((S.dir === 'A' ? c.across : c.down) === null) S.dir = S.dir === 'A' ? 'D' : 'A'; render(); } return; }
  if (k === 'ArrowLeft')  { e.preventDefault(); move(-1, 0); return; }
  if (k === 'ArrowRight') { e.preventDefault(); move(1, 0); return; }
  if (k === 'ArrowUp')    { e.preventDefault(); move(0, -1); return; }
  if (k === 'ArrowDown')  { e.preventDefault(); move(0, 1); return; }
  if (/^[A-Za-z]$/.test(k) && alphaMode()) {
    e.preventDefault(); putChar(k); return;
  }
  const jamo = jamoOf(e);
  if (jamo) { e.preventDefault(); ime.value = ''; anchorIME(true); input(jamo); return; }
  // 한글 IME 가 켜져 있어 자모/음절이 그대로 들어오는 경우
  if (k.length === 1) {
    const cc = k.charCodeAt(0);
    if (cc >= 0x3131 && cc <= 0x3163) { e.preventDefault(); input(unCaps(k, e)); return; }
    if (cc >= 0xac00 && cc <= 0xd7a3) {
      e.preventDefault();
      const d = disassemble(k);
      input(unCaps(d.cho, e)); input(d.jung); if (d.jong) input(d.jong);
    }
  }
});

/* ───────── 저장 (단어장마다 따로) ───────── */
// 갈래 조합이 다르면 다른 판이므로 저장도 따로 둔다
const kindSig = (pack, picked) => allKinds(pack).map(n => picked.includes(n) ? '1' : '0').join('');
// 난이도를 가른 단어장은 기초 쪽과 심화 쪽이 사실상 다른 판이라 진행도 따로 둔다.
// 기초 쪽은 열쇠를 그대로 둔다 — 갈라지기 전 «로봇 기초» 진행이 그대로 이어지도록
const tierSig = pack => (pack.tiered && !EASY) ? ':심화' : '';
const boardKey = (pack, picked) => 'infinite-crossword:' + pack.id + ':' + kindSig(pack, picked) + tierSig(pack);
const saveKey = () => boardKey(PACK, [...PICK]);
const pickKey = id => 'infinite-crossword:pick:' + id;
const LAST_KEY = 'infinite-crossword:last';
const EASY_KEY = 'infinite-crossword:easy';

/** 그 단어장에서 지난번에 고른 갈래 (없으면 단어장이 정해 둔 기본, 그것도 없으면 전부) */
function savedPick(pack) {
  try {
    const v = JSON.parse(localStorage.getItem(pickKey(pack.id)) || 'null');
    if (Array.isArray(v)) {
      const keep = v.filter(n => allKinds(pack).includes(n));
      if (keep.length) return keep;
    }
  } catch (_) {}
  const def = (pack.default || []).filter(n => allKinds(pack).includes(n));
  return def.length ? def : allKinds(pack);
}
let saveT;

function writeSave() {
  clearTimeout(saveT);
  if (!PACK) return;
  try {
    localStorage.setItem(saveKey(), JSON.stringify({
      depth: G.depth, score: G.score, solvedCount: G.solvedCount, hints: G.hints, filledTo: G.filledTo, par: G.par, bandOff: G.bandOff,
      top: G.top, numBase: G.numBase,
      words: [...G.words.values()].map(w => [w.word, w.x, w.y, w.dir]),
      entries: [...G.cells.values()].filter(c => c.ch).map(c => [c.x, c.y, c.ch]),
      cur: S.cur, dir: S.dir, scroll: Math.round(scroller.scrollTop),
    }));
  } catch (_) {}
}

function save() {
  clearTimeout(saveT);
  saveT = setTimeout(writeSave, 300);
}

/* 탭을 덮거나 앱을 내리면 미뤄 둔 저장을 그 자리에서 마친다.
   폰은 여기서 못 쓰면 그대로 프로세스가 죽어 마지막 몇 글자가 날아간다. */
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') writeSave(); });
addEventListener('pagehide', writeSave);

let pendingScroll = 0;
let settling = 0;        // 이 시각까지는 화면 크기가 바뀌어도 스크롤을 건드리지 않는다

/*
 * 갈래(기초/심화)로 갈라 두었던 단어장을 «쉽게» 스위치 쪽으로 옮기면 저장 열쇠가
 * 바뀐다 (animal:10 → animal:1). 그냥 두면 풀던 판이 없어진 것처럼 보이므로,
 * 새 열쇠가 비어 있을 때 한 번만 옛 열쇠 가운데 제일 많이 푼 것을 옮겨 온다.
 */
function migrate(pack) {
  if (!pack.tiered || !EASY) return;      // 옛 판은 기초 갈래였으니 기초 쪽으로만 옮긴다
  const 새열쇠 = boardKey(pack, [...PICK]);
  const 지금꼴 = kindSig(pack, [...PICK]);
  try {
    if (localStorage.getItem(새열쇠)) return;
    const 머리 = 'infinite-crossword:' + pack.id + ':';
    let 옛것 = null, 깊이 = -1;
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(머리)) continue;
      const 꼴 = k.slice(머리.length);
      if (!/^[01]+$/.test(꼴) || 꼴 === 지금꼴) continue;   // 옛 갈래 조합만 (심화 쪽은 건드리지 않는다)
      const d = JSON.parse(localStorage.getItem(k) || 'null');
      if (d && d.words && d.words.length && (d.depth | 0) > 깊이) { 깊이 = d.depth | 0; 옛것 = k; }
    }
    if (옛것) { localStorage.setItem(새열쇠, localStorage.getItem(옛것)); localStorage.removeItem(옛것); }
  } catch (_) {}
}

function load() {
  let data;
  try { data = JSON.parse(localStorage.getItem(saveKey()) || 'null'); } catch (_) { return false; }
  if (!data || !data.words || !data.words.length) return false;
  const at = new Map(BANK.map(([w], i) => [w, i]));
  G.cells = new Map(); G.words = new Map(); G.nextId = 1; G.maxY = -1; G.strad = new Map(); G.used = new Map();
  G.par = data.par | 0; G.bandOff = data.bandOff | 0;
  G.top = data.top | 0; G.numBase = data.numBase | 0;
  for (const [word, x, y, dir] of data.words) {
    const wi = at.get(word);
    if (wi === undefined) continue;      // 단어장이 바뀌어 사라진 단어는 건너뛴다
    place(wi, x, y, dir);
  }
  for (const [x, y, ch] of (data.entries || [])) {
    const c = G.cells.get(key(x, y));
    if (c) c.ch = ch;
  }
  for (const w of G.words.values()) {
    const cs = wordCells(w);
    if (cs.every(c => c.ch === c.ans)) { w.solved = true; cs.forEach(c => { c.solved = true; }); }
    if (w.y + (w.dir === 'D' ? w.len - 1 : 0) < G.top) w.past = true;   // 지나온 줄인지는 위치가 말해 준다
  }
  for (const c of G.cells.values()) if (c.y < G.top) c.past = true;
  G.filledTo = data.filledTo | 0; G.depth = data.depth | 0;
  G.score = data.score | 0; G.solvedCount = data.solvedCount | 0; G.hints = data.hints | 0;
  number();
  if (data.cur && G.cells.has(data.cur)) { S.cur = data.cur; S.dir = data.dir === 'D' ? 'D' : 'A'; }
  pendingScroll = data.scroll | 0;
  return true;
}

/* ───────── 단어장 고르기 ───────── */
function clearBoard() {
  G.cells = new Map(); G.words = new Map(); G.nextId = 1; G.maxY = -1; G.filledTo = 0;
  G.strad = new Map(); G.used = new Map(); G.par = 0; G.bandOff = 0;
  G.top = 0; G.numBase = 0;
  G.depth = 0; G.score = 0; G.solvedCount = 0; G.hints = 0; G.recent = [];
  S.cur = null; S.dir = 'A'; S.comp = { cho: '', jung: '', jong: '' };
  els.forEach(el => el.remove());
  els.clear();
  decos.forEach(el => el.remove());
  decos.clear();
  scroller.scrollTop = 0;
}

function startPack(pack, fresh, picked) {
  loadBank(pack, picked);
  clearBoard();
  if (fresh) { try { localStorage.removeItem(saveKey()); } catch (_) {} }
  try {
    localStorage.setItem(LAST_KEY, pack.id);
    localStorage.setItem(pickKey(pack.id), JSON.stringify([...PICK]));
  } catch (_) {}
  document.getElementById('packname').textContent = packLabel(pack, [...PICK]);
  document.title = pack.name + ' 크로스워드';
  pendingScroll = 0;
  migrate(pack);
  if (!load()) grow(AHEAD);
  if (pendingScroll) {                       // 보던 자리까지는 판이 깔려 있어야 그리로 갈 수 있다
    const need = Math.ceil((pendingScroll + scroller.clientHeight) / C) + AHEAD;
    if (G.maxY < need) grow(need);
  }
  ensureAhead();
  render();
  if (pendingScroll) { scroller.scrollTop = pendingScroll; settling = Date.now() + 900; render(); }
}

const packSize = (pack, picked) =>
  pack.groups.reduce((n, g) => n + (picked.includes(g.name) ? g.words.length : 0), 0);

function progressOf(pack, picked) {
  try {
    const d = JSON.parse(localStorage.getItem(boardKey(pack, picked)) || 'null');
    return d ? (d.depth | 0) : 0;
  } catch (_) { return 0; }
}

/** 그 단어장에 기초로 표시된 말이 몇 개인지 */
const basicCount = p => p.groups.reduce((a, g) =>
  a + (g.name === '기초' ? g.words.length : g.words.filter(w => w[3] === '기초').length), 0);

/** 단어장 딱지에 붙일 난이도 꼬리표 */
function basicOf(p) {
  const n = basicCount(p);
  if (p.tiered) {                       // 두 쪽으로 갈린 단어장은 지금 어느 쪽인지 늘 적어 준다
    const all = p.groups.reduce((a, g) => a + g.words.length, 0);
    return EASY ? ` · 기초 ${n}개` : ` · 심화 ${all - n}개`;
  }
  return EASY && n ? ` · 기초 ${n}개` : '';
}

/** 위쪽 단어장 이름표 — 갈래와 난이도까지 붙인다 */
function packLabel(pack, picked) {
  // 갈래 하나만 골랐으면 숫자 대신 그 이름을 보여 준다 (동물 퀴즈 · 기초)
  const part = (pack.groups.length > 1 && picked.length < pack.groups.length)
    ? (picked.length === 1 ? ` · ${picked[0]}` : ` · ${picked.length}/${pack.groups.length}갈래`) : '';
  const tier = pack.tiered ? (EASY ? ' · 기초' : ' · 심화') : (EASY ? ' · 쉽게' : '');
  return pack.emoji + ' ' + pack.name + part + tier;
}

function buildChooser() {
  document.getElementById('packs').innerHTML = window.PACKS.map(p => {
    const picked = savedPick(p);
    const n = packSize(p, picked);
    const done = progressOf(p, picked);
    const part = (p.groups.length > 1 && picked.length < p.groups.length)
      ? (picked.length === 1 ? ` · ${picked[0]}` : ` · ${picked.length}/${p.groups.length}갈래`) : '';
    return `<button class="pack" data-id="${p.id}">
      <span class="pe">${p.emoji}</span>
      <span class="pt"><b>${p.name}</b><i>${p.desc}</i>
        <u>단어 ${n}개${part}${basicOf(p)}${done ? ` · 지나온 줄 ${done}` : ''}</u></span>
    </button>`;
  }).join('');
}

let kindPack = null, kindPick = [];

function buildKinds() {
  document.getElementById('p2title').textContent = kindPack.emoji + ' ' + kindPack.name;
  document.getElementById('kinds').innerHTML = kindPack.groups.map(g =>
    `<button class="kind${kindPick.includes(g.name) ? ' on' : ''}" data-k="${g.name}">
       <b>${g.name}</b><u>${g.words.length}</u></button>`).join('');
  const n = packSize(kindPack, kindPick);
  const all = kindPick.length === kindPack.groups.length;
  const note = document.getElementById('poolnote');
  note.textContent = all
    ? `단어 ${n}개 — 이 단어장 전부`
    : `고른 갈래 ${n}개를 우선해서 냅니다 — 판의 ${kindPick.length === 1 ? '절반 남짓' : kindPick.length === 2 ? '일곱 할쯤' : '여덟 할쯤'}.`
      + ` 한 갈래만으로는 서로 물릴 음절이 모자라 판이 성겨지므로, 남는 자리는 같은 단어장에서 채웁니다.`;
  note.classList.toggle('warn', kindPick.length === 1);
}

function openKinds(pack) {
  kindPack = pack;
  paintTheme(pack);            // 고른 단어장의 배색을 미리 입어 본다
  kindPick = savedPick(pack);
  buildKinds();
  document.getElementById('pane1').hidden = true;
  document.getElementById('pane2').hidden = false;
}

document.getElementById('packs').addEventListener('click', e => {
  const b = e.target.closest('.pack');
  if (!b) return;
  const pack = window.PACKS.find(p => p.id === b.dataset.id);
  if (pack.groups.length < 2) {          // 갈래가 하나뿐이면 고를 게 없다
    document.getElementById('chooser').close();
    startPack(pack, false, null);
    focusIME();
    return;
  }
  openKinds(pack);
});

document.getElementById('kinds').addEventListener('click', e => {
  const b = e.target.closest('.kind');
  if (!b) return;
  const k = b.dataset.k;
  if (kindPick.includes(k)) {
    if (kindPick.length === 1) return;          // 하나는 남겨 둔다
    kindPick = kindPick.filter(x => x !== k);
  } else {
    kindPick = allKinds(kindPack).filter(n => n === k || kindPick.includes(n));
  }
  buildKinds();
});

document.getElementById('backpane').addEventListener('click', () => {
  paintTheme(PACK);            // 안 고르고 돌아왔으니 원래 배색으로
  buildChooser();
  document.getElementById('pane2').hidden = true;
  document.getElementById('pane1').hidden = false;
});

document.getElementById('startpack').addEventListener('click', () => {
  document.getElementById('chooser').close();
  startPack(kindPack, false, kindPick);
  focusIME();
});

function paintEasy() {
  const b = document.getElementById('easy');
  b.setAttribute('aria-pressed', EASY ? 'true' : 'false');
}

document.getElementById('easy').addEventListener('click', () => {
  const 갈린판 = !!(PACK && PACK.tiered);
  if (갈린판) writeSave();       // 지금 판은 지금 쪽(기초/심화)에 남겨 두고 넘어간다
  EASY = !EASY;
  try { localStorage.setItem(EASY_KEY, EASY ? '1' : '0'); } catch (_) {}
  paintEasy();
  buildChooser();
  if (갈린판) { startPack(PACK, false, [...PICK]); return; }   // 반대쪽 판을 꺼내 온다
  // 켠 보람이 바로 있어야 한다 — 지금 판에 깔린 낱말에도 첫 글자를 열어 준다
  if (EASY && PACK) {
    giveFirst([...G.words.values()].filter(w => !w.past && !w.solved));
    render(); writeSave();      // 곧바로 써 둔다 — 여기서 단어장을 바로 고르면 미뤄 둔 저장은 늦는다
  }
  if (PACK) document.getElementById('packname').textContent = packLabel(PACK, [...PICK]);
});

// 갈래 고르다 그냥 닫으면(Esc 등) 미리 입어 본 배색을 벗는다
document.getElementById('chooser').addEventListener('close', () => paintTheme(PACK));

function openChooser() {
  buildChooser();
  paintEasy();
  document.getElementById('pane2').hidden = true;
  document.getElementById('pane1').hidden = false;
  document.getElementById('chooser').showModal();
}

/* ───────── 조작 붙이기 ───────── */
document.getElementById('packname').addEventListener('click', openChooser);
document.getElementById('new').addEventListener('click', () => {
  if (G.solvedCount && !confirm('이 단어장의 진행을 버리고 새로 시작할까요?')) return;
  startPack(PACK, true, [...PICK]);
});
document.querySelector('.cluebar').addEventListener('pointerdown', e => {
  if (e.target.closest('button')) e.preventDefault();   // 눌러도 자판이 내려가지 않게
});
document.getElementById('hint').addEventListener('click', () => { hint(); focusIME(); });
document.getElementById('open').addEventListener('click', openWord);
document.getElementById('prev').addEventListener('click', () => nextWord(-1));
document.getElementById('next').addEventListener('click', () => nextWord(1));
document.getElementById('help').addEventListener('click', () => document.getElementById('howto').showModal());
document.getElementById('howto').addEventListener('click', e => { if (e.target.id === 'howto') e.target.close(); });
document.getElementById('kbtoggle').addEventListener('click', () => {
  document.body.classList.toggle('nokb');
  if (useIME()) focusIME(); else ime.blur();     // 두 자판이 같이 뜨지 않게
  setTimeout(() => { sizeCells(); render(); }, 50);
});

let scrollT;
scroller.addEventListener('scroll', () => {
  clearTimeout(scrollT);
  scrollT = setTimeout(() => { ensureAhead(); render(); save(); }, 80);   // 보던 자리도 같이 남긴다
}, { passive: true });

let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { sizeCells(); render(); }, 120);
});

/*
 * 폰에서 자판이 올라오면 화면 아래가 덮인다.
 * 어떤 브라우저는 화면 높이를 줄여 주지만(안드로이드) 어떤 브라우저는
 * 그냥 위에 덮어씌운다(iOS). 그래서 실제로 보이는 높이에 몸통을 맞춰
 * 힌트 줄이 자판에 가리지 않게 하고, 고른 칸을 다시 보이는 곳으로 끌어온다.
 */
const vv = window.visualViewport;
if (vv) {
  let vvT;
  const fit = () => {
    clearTimeout(vvT);
    vvT = setTimeout(() => {
      document.body.style.height = Math.round(vv.height) + 'px';
      sizeCells();
      render();
      // 자판이 올라와 칸을 가릴 때만 끌어온다. 그리고 막 들어와 보던 자리로
      // 옮기는 동안에는 건드리지 않는다 — 안 그러면 복원한 자리가 딸려 간다
      const covered = vv.height < window.innerHeight - 60;
      if (covered && Date.now() > settling) {
        const c = S.cur && G.cells.get(S.cur);
        if (c) scrollTo(c);
      }
    }, 60);
  };
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', fit);
}

/* ───────── 시작 ───────── */
/*
 * 단어장은 packs/*.json 에 따로 두고 여기서 읽어 온다.
 * 파일을 하나 더 얹고 index.json 에 이름만 적으면 단어장이 늘어난다.
 * 다만 fetch 를 쓰므로 file:// 로 열면 브라우저가 막는다 — 서버가 있어야 한다.
 */
async function loadPacks() {
  // 한 파일로 묶어 배포할 때는 단어장을 미리 박아 넣는다 (fetch 할 데가 없다)
  if (Array.isArray(window.PACKS_INLINE) && window.PACKS_INLINE.length) return window.PACKS_INLINE;
  const base = new URL('packs/', location.href);
  const names = await (await fetch(new URL('index.json', base))).json();
  const packs = await Promise.all(
    names.map(async n => {
      const r = await fetch(new URL(n, base));
      if (!r.ok) throw new Error(`${n}: ${r.status}`);
      return r.json();
    }));
  return packs.filter(p => p && p.groups && p.groups.length);
}

function showLoadError(err) {
  document.getElementById('clue').innerHTML =
    '<span class="ph">단어장을 못 읽었습니다 — ' + String(err.message || err) + '</span>';
  document.getElementById('board').innerHTML =
    '<div class="oops"><b>단어장을 불러오지 못했습니다.</b>' +
    '<p>파일을 직접 열면(file://) 브라우저가 packs 폴더 읽기를 막습니다.' +
    ' 간단한 서버로 여세요.</p><code>npx http-server .</code>' +
    '<p>깃허브 페이지스로 올린 주소에서는 그냥 됩니다.</p></div>';
  console.error(err);
}

async function boot() {
  try { EASY = localStorage.getItem(EASY_KEY) === '1'; } catch (_) {}
  document.body.classList.add('nokb');    // 기본은 기기 자판, ⌨ 로 내장 자판 전환
  buildKeyboard('ko');
  sizeCells();
  // 단어장이 오기 전까지는 빈 판이라, 무슨 일이 일어나는지 알려 준다
  document.getElementById('clue').innerHTML = '<span class="ph">단어장 불러오는 중…</span>';
  window.PACKS = await loadPacks();
  if (!window.PACKS.length) throw new Error('단어장이 비어 있습니다');

  // ?pack=news 처럼 주소로 단어장을 집어 주면 고르는 창 없이 바로 그 단어장으로 간다.
  // 남의 페이지에 iframe 으로 얹을 때 쓴다 — 시사IN 위젯은 시사 용어만 보여 준다
  let fromUrl = null;
  try { fromUrl = window.PACKS.find(p => p.id === new URLSearchParams(location.search).get('pack')); } catch (_) {}

  let first = null;
  try { first = window.PACKS.find(p => p.id === localStorage.getItem(LAST_KEY)); } catch (_) {}
  const firstPack = fromUrl || first || window.PACKS[0];
  startPack(firstPack, false, savedPick(firstPack));
  if (!first && !fromUrl) openChooser();     // 처음 왔으면 단어장부터 고르게 한다
}

boot().catch(showLoadError);

if (location.search.includes('debug'))
  window.__cw = { G, S, get W() { return W; }, key, grow, collapse, clearableY, render, wordCells,
                  input, hint, openWord, after, markBad, nextWord, crossCount, startPack, curWord, focusIME, anchorIME,
                  tune: (w, c, r, o) => { WEAR = w; WEARCAP = c; RECSHIFT = r; if (o !== undefined) OFFPICK = o; },
                  tune2: (h, d) => { if (h !== undefined) HARD = h; if (d !== undefined) DEEP = d; },
                  get 층벌점() { return { HARD, DEEP, 기초: BASIC.size, 창고: BANK.length }; },
                  useIME,
                  get ONTOPIC() { return ONTOPIC; }, get PACK() { return PACK; }, get BANK() { return BANK; } };
})();
