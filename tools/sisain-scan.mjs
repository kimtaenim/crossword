/* 시사IN 챗봇 프로젝트의 기사 뭉치를 훑어, 시사 단어장을 손볼 거리를 뽑아낸다.
   node tools/sisain-scan.mjs [챗봇 레포 경로]        (기본 ../sisain-chatbot)

   1) 단어장에 있는 말이 요즘도 나오는지 (안 나오면 묵은 말)
   2) 단어장에 없는데 요즘 자주 나오는 말 (넣을 만한 말)
   힌트는 사람이 쓴다 — 여기서는 «무엇을» 만 고른다. */
import fs from 'fs';
import path from 'path';

const repo = process.argv[2] || path.join(process.cwd(), '..', 'sisain-chatbot');
const arts = JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8'));
const dir = new URL('../packs/', import.meta.url).pathname;
const news = JSON.parse(fs.readFileSync(dir + 'news.json', 'utf8'));
const words = news.groups.flatMap(g => g.words.map(w => [w[0], g.name]));

const day = d => (d || '').slice(0, 10).replace(/\./g, '-');
const dates = arts.map(a => day(a.date)).filter(Boolean).sort();
const 최근 = dates[Math.floor(dates.length * 0.75)];      // 최근 사분의 일
const text = arts.map(a => ({ d: day(a.date), t: [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' ') }));

const 센다 = w => {
  let all = 0, now = 0, last = '';
  for (const a of text) if (a.t.includes(w)) { all++; if (a.d >= 최근) now++; if (a.d > last) last = a.d; }
  return { all, now, last };
};

console.log(`기사 ${arts.length}건 (${dates[0]} ~ ${dates[dates.length - 1]}), 최근 기준일 ${최근}\n`);

const 묵은 = [], 살아있는 = [];
for (const [w, g] of words) {
  const c = 센다(w);
  (c.all === 0 ? 묵은 : 살아있는).push({ w, g, ...c });
}
console.log('■ 단어장에 있는데 이 뭉치에 한 번도 안 나온 말 — 묵었는지 살펴볼 것');
console.log('  ' + 묵은.map(x => x.w).join(' ') + `  (${묵은.length}개)\n`);
console.log('■ 요즘 자주 나오는 말 (최근 기사 수 / 전체)');
console.log('  ' + 살아있는.sort((a, b) => b.now - a.now).slice(0, 30)
  .map(x => `${x.w}(${x.now}/${x.all})`).join('  ') + '\n');

// 넣을 만한 새 말 — 명사처럼 생긴 세 글자 이상 토막을, 요즘 기사에서만 센다
const 있는말 = new Set(words.map(([w]) => w));
const 끝맺음 = /(다|요|음|임|함|했|한다|된다|하는|하고|해서|하며|이다|같은|같이|적인|적으로|하지|않은|않는|있는|없는|되는|위한|통해|대한|따라|이런|그런|우리|여러|모든|어떤|이번|지난|올해|내년|작년)$/;
const 조사 = ['으로써','으로서','에서는','이라는','에게서','으로','에서','에게','까지','부터','보다','처럼','마다','라고','와의','과의','의','은','는','이','가','을','를','에','도','만','과','와','로'];
const df = new Map();
for (const a of text) {
  if (a.d < 최근) continue;
  const seen = new Set();
  for (const m of a.t.matchAll(/[가-힣]{3,9}/g)) {
    let w = m[0];
    for (const j of 조사) if (w.length - j.length >= 3 && w.endsWith(j)) { w = w.slice(0, -j.length); break; }
    if (w.length < 3 || w.length > 7 || 끝맺음.test(w) || 있는말.has(w)) continue;
    seen.add(w);
  }
  for (const w of seen) df.set(w, (df.get(w) || 0) + 1);
}
console.log('■ 단어장에 없는데 최근 기사에 자주 나오는 토막 (사람이 골라야 한다)');
console.log('  ' + [...df].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([w, n]) => `${w}(${n})`).join('  '));
