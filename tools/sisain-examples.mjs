/* 예문. 시사 단어장의 낱말마다 그 말이 쓰인 시사IN 기사 둘을 골라, 기사 제목(또는 그 말이 든 문장)에서
   정답을 ㅇㅇㅇ 으로 가리고 날짜·링크와 함께 단어장에 남긴다(pack.예문). 화면은 힌트 밑에 작은 글씨로 보여 준다.

   node tools/sisain-examples.mjs [챗봇 레포 경로] [--쓰기]

   ■ 편집국 결정 (2026-09-27)
   «기사는 제목과 날짜를 같이 표시해. 제목에 ㅇㅇㅇㅇ 라고 표시해. 그러면 예문이 되는 거니까.
    그리고 그 장면을 새 기사가 나올 때마다 갱신하는 파이프라인.»
   모델을 부르지 않는다(비용 없음). 매주 자동 작업이 새 기사를 받은 뒤 돌려서, 새 기사가 나오면 예문이 바뀐다.
   힌트 글은 건드리지 않으므로 안전 도장에는 영향이 없다.

   ■ 고르는 법
   - 범죄·참사가 중심인 기사는 쓰지 않는다(재료기사). 금지어 목록에 걸리는 글도 쓰지 않는다.
   - 제목에 그 말이 들어 있는 기사를 먼저, 없으면 그 말이 여러 번 나온(중심인) 기사에서 그 말이 든 문장을 쓴다.
   - 같은 조건이면 새 기사 먼저. */
import { 안전모듈, 재료기사 } from './lib-safety.mjs';
import fs from 'fs';
import path from 'path';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : path.join(process.cwd(), '..', 'sisain-chatbot');
const WRITE = process.argv.includes('--쓰기');
const 개수 = 2;
const 최대길이 = 60;

const 안전 = 안전모듈(repo);
const arts = 재료기사(안전, JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8')))
  .map(a => ({
    id: String(a.id),
    날: String(a.date || '').slice(0, 10).replace(/-/g, '.'),
    제목: String(a.title || '').replace(/\s+/g, ' ').trim(),
    본문: [a.subtitle, a.summary, a.body].filter(Boolean).join(' ').replace(/\s+/g, ' '),
  }))
  .filter(a => /^\d+$/.test(a.id) && a.제목)
  .sort((a, b) => b.날.localeCompare(a.날));

const 가림 = (글, w) => 글.split(w).join('ㅇ'.repeat(w.length));
// 사람이 다치거나 숨진 일을 퍼즐 재료로 쓰지 않는다(편집국 원칙). 그런 말이 든 제목·문장은 예문으로 안 쓴다
const 다친일 = /사망|숨지|숨진|숨졌|목숨|부상|다쳐|다친|다쳤|피해자|희생|참사|살해|살인|폭행|성폭|성범죄|자살|극단적 선택|유족|시신|중상|학대|추락|질식|익사|분신/;
const 괜찮은글 = 글 => 안전.검사(글).안전 && !안전.곁가지(글).붙음 && !다친일.test(글);

/** 그 말이 든 문장 하나를 최대길이 안쪽으로 */
function 문장(본문, w) {
  const 문장들 = 본문.split(/(?<=[다요까][.?!])\s+|(?<=[.?!])\s+(?=[가-힣A-Z«〈"'‘“])/);
  const 든것 = 문장들.filter(s => s.includes(w) && s.length >= 12).sort((a, b) => a.length - b.length);
  if (!든것.length) return '';
  let s = 든것[0].replace(/^ⓒ\S+\s+\S+\s*/, '').trim();   // 사진 설명 앞의 «ⓒ시사IN 누구» 를 뗀다
  if (s.length > 최대길이) {
    const i = s.indexOf(w);
    const 앞 = Math.max(0, Math.min(i - 20, s.length - 최대길이));
    s = (앞 > 0 ? '…' : '') + s.slice(앞, 앞 + 최대길이).trim() + (앞 + 최대길이 < s.length ? '…' : '');
  }
  return s;
}

function 예문(w) {
  const 제목에 = [], 본문에 = [];
  for (const a of arts) {
    if (a.제목.includes(w)) { if (괜찮은글(a.제목)) 제목에.push({ a, 글: a.제목 }); continue; }
    const n = a.본문.split(w).length - 1;
    if (n >= 2) {
      const s = 문장(a.본문, w);
      if (s && 괜찮은글(s)) 본문에.push({ a, 글: s, n });
    }
  }
  본문에.sort((x, y) => Math.min(y.n, 5) - Math.min(x.n, 5) || y.a.날.localeCompare(x.a.날));
  return [...제목에, ...본문에].slice(0, 개수).map(({ a, 글 }) => ({
    id: a.id, 날: a.날, 제목: 가림(a.제목, w), 예문: 글 === a.제목 ? '' : 가림(글, w),
  }));
}

const packPath = 'packs/news.json';
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const 낱말들 = pack.groups.flatMap(g => g.words).map(w => w[0]);
const 새것 = {};
let 둘 = 0, 하나 = 0, 없음 = 0;
for (const w of 낱말들) {
  const e = 예문(w);
  if (e.length) 새것[w] = e;
  if (e.length >= 2) 둘++; else if (e.length === 1) 하나++; else 없음++;
}
pack.예문 = 새것;
console.error(`예문 — 둘 ${둘} · 하나 ${하나} · 없음 ${없음} (낱말 ${낱말들.length}개)`);
for (const w of 낱말들.slice(0, 3)) for (const e of 새것[w] || []) console.error(`  ${w}: ${e.날} 〈${e.제목}〉 ${e.예문}`);

if (!WRITE) { console.error('\n미리보기만 했다. 실제로 쓰려면 --쓰기 를 붙일 것.'); process.exit(0); }
const q = s => JSON.stringify(s);
const head = Object.keys(pack).filter(k => k !== 'groups').map(k => `  ${q(k)}: ${JSON.stringify(pack[k])},`).join('\n');
const groups = pack.groups.map(g =>
  `    {\n      "name": ${q(g.name)},\n      "words": [\n` +
  g.words.map(w => '        [' + w.map(q).join(', ') + ']').join(',\n') + '\n      ]\n    }').join(',\n');
fs.writeFileSync(packPath, `{\n${head}\n  "groups": [\n${groups}\n  ]\n}\n`, 'utf8');
console.error(`→ ${packPath} 갱신`);
