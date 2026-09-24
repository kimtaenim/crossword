/* 넣을 만한 시사 낱말을 골라 준다.
   node tools/sisain-pick.mjs [챗봇 레포 경로] [--n 40]

   sisain-scan 은 «명사인가» 까지만 가린다. 그래서 프로그램·아이디어·우리나라가
   위로 올라왔다. 명사이고 요즘 기사에 자주 나오는 것은 맞지만 시사 «용어» 는 아니다.

   시사 용어를 가려내는 잣대를 셋 더 둔다. 셋 다 «퍼져 있는가, 몰려 있는가» 를 본다.

     ① 때가 몰리는가 (급등)   시사 용어는 어떤 시기에 솟는다. 파병·종부세·새벽배송.
                            프로그램·아이디어는 일 년 내내 평평하다.
                            = 요즘 기사 등장률 ÷ 예전 기사 등장률
     ② 갈래가 몰리는가        시사 용어는 취재기사에 몰린다. 칼럼·서평·만화에까지
                            고루 퍼진 말은 일반어다. = 취재기사 비중
     ③ 주제가 몰리는가        시사 용어는 한두 주제에 붙는다(종부세→부동산·조세).
                            일반어는 모든 주제에 퍼진다. = 최빈 주제 두 개의 비중

   명사인지 가리는 잣대(조사)와 고유명사·복수형 거르기는 sisain-scan 과 같다.
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : path.join(process.cwd(), '..', 'sisain-chatbot');
const N = Number((process.argv.find(a => a.startsWith('--n=')) || '--n=40').slice(4));

const arts = JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8'));
const onto = JSON.parse(fs.readFileSync(path.join(repo, 'data/ontology.json'), 'utf8')).articles || {};
const dir = fileURLToPath(new URL('../packs/', import.meta.url));
const 있는말 = new Set(JSON.parse(fs.readFileSync(dir + 'news.json', 'utf8'))
  .groups.flatMap(g => g.words.map(w => w[0])));

const JOSA = ['이', '가', '은', '는', '을', '를', '의', '에', '도', '만', '과', '와', '로',
              '부터', '까지', '처럼', '보다', '라고', '으로', '에서', '에게'];
const 붙는말 = ['으로써', '으로서', '에서는', '이라는', '에게서', '으로', '에서', '에게', '까지', '부터',
                '보다', '처럼', '마다', '라고', '와의', '과의', '의', '은', '는', '이', '가', '을', '를',
                '에', '도', '만', '과', '와', '로'];
const 어미 = /(다|요|음|임|함|움|했|한다|된다|하는|하고|해서|하며|이다|같은|같이|적인|적으로|하지|않은|않는|있는|없는|되는|위한|통해|대한|따라|이런|그런|우리|여러|모든|어떤|이번|지난|올해|내년|작년|인지|만들|어딘|무엇|얼마|는지|느냐|하기|나기|되기|가기|오기|보기|까지|부터|사용하|살아남)$/;

const day = d => (d || '').slice(0, 10).replace(/\./g, '-');
const 취재 = new Set(['news', 'feature']);
const 글 = arts.map(a => ({
  d: day(a.date),
  t: [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' '),
  취재: 취재.has(onto[a.id]?.genre),
  주제: onto[a.id]?.topics || [],
})).filter(a => a.d);

const 날짜 = 글.map(a => a.d).sort();
const 기준 = 날짜[Math.floor(날짜.length * 0.75)];
const 최근글 = 글.filter(a => a.d >= 기준);
const 예전글 = 글.filter(a => a.d < 기준);

const 이름 = new Set();
for (const a of Object.values(onto)) for (const e of (a.entities || []))
  if (e.type === 'person' || e.type === 'org') 이름.add(e.name);
const 이름목록 = [...이름];
const 고유명사 = w => 이름.has(w) || 이름목록.some(n => n.length > w.length && n.endsWith(w));

function 조사(w, 글들) {
  let all = 0, josa = 0; const 종류 = new Set();
  for (const a of 글들) {
    let i = 0;
    while ((i = a.t.indexOf(w, i)) >= 0 && all <= 400) {
      all++;
      const j = JOSA.find(x => a.t.startsWith(x, i + w.length));
      if (j) { josa++; 종류.add(j); }
      i += w.length;
    }
    if (all > 400) break;
  }
  return { 비율: josa / Math.max(1, all), 종류: 종류.size };
}

/** 후보 모으기 — 요즘 기사에서 조사를 떼고 남은 세 글자 이상 말 */
const 최근수 = new Map(), 담긴글 = new Map();
for (const a of 최근글) {
  const seen = new Set();
  for (const m of a.t.matchAll(/[가-힣]{3,9}/g)) {
    let w = m[0];
    for (let r = 0; r < 3; r++) {
      const 전 = w;
      for (const j of 붙는말) if (w.length - j.length >= 2 && w.endsWith(j)) { w = w.slice(0, -j.length); break; }
      if (w === 전) break;
    }
    if (w.length < 3 || w.length > 7) continue;
    if (어미.test(w) || 있는말.has(w) || /들$/.test(w) || /(씨|님|군|양)$/.test(w)) continue;
    seen.add(w);
  }
  for (const w of seen) {
    최근수.set(w, (최근수.get(w) || 0) + 1);
    if (!담긴글.has(w)) 담긴글.set(w, []);
    담긴글.get(w).push(a);
  }
}

const 센다 = (w, 글들) => 글들.reduce((n, a) => n + (a.t.includes(w) ? 1 : 0), 0);
const 쏠림 = (목록) => {                       // 최빈 둘이 차지하는 비중
  const c = new Map();
  for (const x of 목록) c.set(x, (c.get(x) || 0) + 1);
  const v = [...c.values()].sort((a, b) => b - a);
  return 목록.length ? (v[0] + (v[1] || 0)) / 목록.length : 0;
};

const rows = [];
for (const [w, n] of 최근수) {
  if (n < 3) continue;
  if (고유명사(w)) continue;
  const j = 조사(w, 최근글);
  if (j.비율 < 0.25 || j.종류 < 3) continue;          // 명사가 아니다
  const 예전 = 센다(w, 예전글);
  const 급등 = (n / 최근글.length) / ((예전 + 0.5) / 예전글.length);
  const 글들 = 담긴글.get(w);
  const 취재비 = 글들.filter(a => a.취재).length / 글들.length;
  const 주제쏠림 = 쏠림(글들.flatMap(a => a.주제));
  if (n / 글.length > 0.1) continue;                  // 너무 흔한 일반어
  rows.push({ w, n, 예전, 급등, 취재비, 주제쏠림, 점수: 급등 * 취재비 * 주제쏠림 });
}
rows.sort((a, b) => b.점수 - a.점수);

console.log(`기사 ${글.length}건 · 요즘 = ${기준} 이후 ${최근글.length}건 · 후보 ${rows.length}종\n`);
console.log('낱말        요즘/예전   급등  취재비중  주제쏠림   점수');
for (const r of rows.slice(0, N)) {
  console.log(`${r.w.padEnd(10)} ${String(r.n).padStart(3)}/${String(r.예전).padEnd(4)} ${r.급등.toFixed(1).padStart(6)} ${(r.취재비 * 100).toFixed(0).padStart(6)}% ${(r.주제쏠림 * 100).toFixed(0).padStart(7)}% ${r.점수.toFixed(1).padStart(6)}`);
}
