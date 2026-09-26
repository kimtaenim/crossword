/* 캐낸 낱말로 시사 단어장을 새로 짓는다.
   node tools/sisain-build.mjs [챗봇 레포 경로] --캔것=새말.json [--쓰기]

   sisain-mine 이 캐낸 것을 받아 packs/news.json 의 «시사 용어» 를 통째로 새로 만든다.

   ■ 줄 세우는 차례 — 새로 나온 것 가운데 자주 나오는 것이 앞이다
   판을 깔 때 앞쪽 낱말이 먼저 쓰인다. 그러니 차례가 곧 «무엇이 판에 자주 뜨는가» 다.
     1. 새말이면서 자주 나오는 말   요즘 들어 처음 보이는데 벌써 여러 기사에 오른 말
     2. 새말                      처음 보이지만 아직 한두 번
     3. 오래된 말 가운데 자주 나오는 것
   «새말» 은 처음 나온 날이 요즘 구간(뒤쪽 25%) 안에 든 말이다.

   ■ 사람이 고친 힌트는 지킨다
   옛 단어장에 있던 낱말이 다시 캐이면, 힌트는 옛것을 쓴다. 사람이 손으로 고쳐 온 것들이라
   기계가 새로 쓴 것으로 덮으면 그 손질이 사라진다. 갈래도 옛것을 따른다.

   --쓰기 가 없으면 미리보기만 한다.
*/
import fs from 'fs';
import path from 'path';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : path.join(process.cwd(), '..', 'sisain-chatbot');
const 인자 = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const 캔것경로 = 인자('캔것');
const WRITE = process.argv.includes('--쓰기');
if (!캔것경로) { console.error('--캔것=<sisain-mine 결과 json> 이 필요합니다'); process.exit(1); }

const arts = JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8'));
const 캔것 = JSON.parse(fs.readFileSync(캔것경로, 'utf8'));
const packPath = 'packs/news.json';
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));

/** 옛 단어장의 힌트와 갈래 — 사람이 고쳐 온 것이라 지킨다 */
/** 사람이 빼기로 한 낱말 — 다시 캐여도 넣지 않는다 */
let 뺀말 = new Set();
try {
  뺀말 = new Set(fs.readFileSync('packs/뺀말.txt', 'utf8').split(/?
/)
    .map(l => l.trim()).filter(l => l && !l.startsWith('#')));
} catch (_) {}

const 옛것 = new Map();
for (const g of pack.groups) for (const w of g.words) 옛것.set(w[0], { clue: w[1], kind: w[2] });

const day = d => (d || '').slice(0, 10).replace(/\./g, '-');
const 글 = arts.map(a => ({
  d: day(a.date),
  붙인: [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' ').replace(/\s+/g, ''),
})).filter(a => a.d);
const 날짜 = 글.map(a => a.d).sort();
const 요즘부터 = 날짜[Math.floor(날짜.length * 0.75)];

const 센다 = w => {
  let 전체 = 0, 요즘 = 0, 처음 = '9999-99-99';
  for (const a of 글) {
    if (!a.붙인.includes(w)) continue;
    전체++;
    if (a.d >= 요즘부터) 요즘++;
    if (a.d < 처음) 처음 = a.d;
  }
  return { 전체, 요즘, 처음 };
};

const rows = [];
for (const [w, clue, kind] of 캔것) {
  const c = 센다(w);
  if (c.전체 === 0) continue;                       // 기사에 없는 말은 캐낸 것이 아니다
  if (뺀말.has(w)) continue;                        // 사람이 빼기로 한 말
  const 옛 = 옛것.get(w);
  const 새말 = c.처음 >= 요즘부터;
  rows.push({
    w,
    clue: 옛 ? 옛.clue : clue,
    kind: 옛 ? 옛.kind : kind,
    손질: !!옛,
    새말,
    ...c,
    순위: 새말 ? (c.전체 >= 3 ? 0 : 1) : 2,
  });
}
rows.sort((a, b) => a.순위 - b.순위 || b.전체 - a.전체 || a.w.localeCompare(b.w));

/* 힌트가 똑같은 낱말이 둘 생기면 푸는 사람은 어느 쪽인지 알 길이 없다.
   앞자리(새말·자주 나오는 쪽)를 남기고 뒤엣것을 버린다. */
const 본힌트 = new Set();
const 버린겹침 = [];
for (let i = 0; i < rows.length; i++) {
  const key = rows[i].clue.replace(/\s+/g, '');
  if (본힌트.has(key)) { 버린겹침.push(rows[i].w); rows.splice(i, 1); i--; continue; }
  본힌트.add(key);
}

const 셈 = (n) => rows.filter(r => r.순위 === n).length;
console.log(`캐낸 것 ${캔것.length}종 → 기사에 있는 것 ${rows.length}종`);
console.log(`  새말이면서 자주 나옴 ${셈(0)}  ·  새말 ${셈(1)}  ·  오래된 말 ${셈(2)}`);
console.log(`  그중 사람이 고친 힌트를 지킨 것 ${rows.filter(r => r.손질).length}종`);
console.log(`  (새말 = ${요즘부터} 이후에 처음 나온 말)\n`);
if (버린겹침.length) console.log(`  힌트가 겹쳐 버린 것 ${버린겹침.length}종: ${버린겹침.slice(0, 12).join(' ')}
`);
console.log('앞자리 스물:');
for (const r of rows.slice(0, 20)) {
  console.log(`  ${r.w.padEnd(10)} 전체 ${String(r.전체).padStart(3)} 요즘 ${String(r.요즘).padStart(3)} 처음 ${r.처음}${r.손질 ? ' (손질한 힌트)' : ''}`);
}

if (!WRITE) { console.log('\n미리보기만 했다. 실제로 지으려면 --쓰기 를 붙일 것.'); process.exit(0); }

pack.groups = [{ name: '시사 용어', words: rows.map(r => [r.w, r.clue, r.kind]) }];

function serialize(pk) {
  const q = s => JSON.stringify(s);
  const head = Object.keys(pk).filter(k => k !== 'groups')
    .map(k => `  ${q(k)}: ${JSON.stringify(pk[k])},`).join('\n');
  const groups = pk.groups.map(gr => {
    const words = gr.words.map(w => '        [' + w.map(q).join(', ') + ']').join(',\n');
    return `    {\n      "name": ${q(gr.name)},\n      "words": [\n${words}\n      ]\n    }`;
  }).join(',\n');
  return `{\n${head}\n  "groups": [\n${groups}\n  ]\n}\n`;
}
fs.writeFileSync(packPath, serialize(pack), 'utf8');
console.log(`\n→ ${packPath} 를 ${rows.length}개로 새로 지었다`);
