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
     ④ 뜻이 부분의 합인가      반도체+산업, 진보+진영, 내란+범 은 앞뒤를 아는 사람이면
                            뜻도 아는 말이다. 힌트를 쓰려 해도 «반도체를 만드는 산업» 처럼
                            동어반복이 된다. 아무 말에나 붙는 꼬리로 끝나면 뺀다.
     ④-2 자리인가 종이인가     정책실장은 자리 이름이고 기소계획서는 서류 이름이다.
                            가리키는 것이 개념이 아니면 낱말로 안 쓴다.
     ⑤ 여러 날에 걸치는가      한 기획에만 몰려 나온 말은 시사 용어가 아니다.
                            컴퓨터그래픽·리얼돌은 한두 날짜의 특집에서만 나왔다.
                            시사 용어는 날을 달리해 거듭 나온다. = 서로 다른 날짜 3일 이상

   명사인지 가리는 잣대(조사)와 고유명사·복수형 거르기는 sisain-scan 과 같다.
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : path.join(process.cwd(), '..', 'sisain-chatbot');
const N = Number((process.argv.find(a => a.startsWith('--n=')) || '--n=40').slice(4));
// --많이 면 문을 넓게 연다: 요즘 2건부터 받고, 날짜·주제 쏠림은 안 본다.
// 시사어인지 아닌지는 뒤에서 sisain-sieve 가 하나하나 본다 —
// 통계는 «낱말인가» 까지만 가리고, «시사어인가» 는 거기서 가린다.
const 많이 = process.argv.includes('--많이');
const 최소건수 = 많이 ? 2 : 3;
const 최소날짜 = 많이 ? 2 : 3;
const 취재하한 = 많이 ? 0.5 : 0.6;

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
// 아무 말에나 붙어 «그 말 + 뻔한 뜻» 이 되는 꼬리. 여기서 끝나면 따로 설명할 것이 없다.
// 좋은 말 13개·나쁜 말 15개를 놓고 맞춰 본 목록이다. 나쁜 쪽 12개가 걸리고 좋은 쪽은 하나도 안 걸린다.
// (굳은 말인지 PMI 로 재 보기도 했는데 못 가렸다 — 연합훈련 −2.2, 녹취록 −2.4 가 사망률 −2.4 와 겹친다.
//  우리말은 토막이 서로 흔해서 굳은 말도 느슨해 보인다. 그래서 꼬리로 가린다.)
const 꼬리 = /.{2,}(산업|진영|업계|세력|계층|권자|주의자|능력|가치|활동|효과|문제|상황|과정|방식|수준|규모|비중|의식|력|률|법|성|자|기|구|당|인|측|범|족|파)$/;
// 자리 이름과 서류 이름 — 가리키는 것이 «개념» 이 아니라 사람이 앉는 자리이거나 종이 한 장이다.
// 정책실장·비대위원장은 누가 그 자리에 있느냐는 이야기고, 기소계획서는 한 사건에서만 나온 서류다.
// 앞토막만 알면 뜻이 나오므로 따로 배울 것이 없다.
const 자리서류 = /.+(실장|원장|위원장|본부장|사장|회장|소장|단장|총장|청장|처장|의장|장관|차관|대표|직|계획서|보고서|제안서|의견서|신청서|합의서|명세서|각서)$/;

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
  if (n < 최소건수) continue;
  if (고유명사(w)) continue;
  // 조사가 붙는지는 요즘 기사만 보면 증거가 모자란다 — 두어 번 나온 말은 조사 종류가
  // 서너 가지까지 안 나온다. 멀쩡한 명사가 그래서 떨어졌다. 전체 기사에서 센다.
  const j = 조사(w, 글);
  if (j.비율 < 0.25 || j.종류 < 3) continue;          // 명사가 아니다
  if (꼬리.test(w)) continue;                         // 뜻이 부분의 합이다
  if (자리서류.test(w)) continue;                     // 자리 이름이거나 서류 이름이다
  const 예전 = 센다(w, 예전글);
  // 예전에 0건이면 급등이 한없이 커진다 — 요즘 3건짜리 «컴퓨터그래픽» 이 맨 위로 올라왔다.
  // 그래서 예전 쪽에 3건을 얹어 두고 센다. 어쩌다 몇 번 나온 말은 위로 못 올라온다.
  const 급등 = (n / 최근글.length) / ((예전 + 3) / 예전글.length);
  const 글들 = 담긴글.get(w);
  const 날짜수 = new Set(글들.map(a => a.d)).size;
  if (날짜수 < 최소날짜) continue;                           // 한 기획에만 몰려 나온 말
  const 취재비 = 글들.filter(a => a.취재).length / 글들.length;
  if (취재비 < 취재하한) continue;                         // 칼럼·서평에 퍼진 말
  const 주제쏠림 = 쏠림(글들.flatMap(a => a.주제));
  if (n / 글.length > 0.1) continue;                  // 너무 흔한 일반어
  rows.push({ w, n, 예전, 날짜수, 급등, 취재비, 주제쏠림, 점수: 급등 * 취재비 * 주제쏠림 });
}
rows.sort((a, b) => b.점수 - a.점수);

/* 같은 이야기를 두 이름으로 부르는 것들 — 초과이윤·초과이익처럼.
   둘 다 넣으면 단어장에 같은 말이 두 번 든다. 앞이나 뒤 두 글자가 같고
   나온 기사가 절반 넘게 겹치면 한 쌍으로 묶어 보여 준다. 고르는 것은 사람 몫이다. */
const 겹침 = [];
for (let i = 0; i < rows.length; i++) {
  for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j];
    const 붙은데 = a.w.slice(0, 2) === b.w.slice(0, 2) || a.w.slice(-2) === b.w.slice(-2);
    if (!붙은데) continue;
    const A = new Set(담긴글.get(a.w)), B = 담긴글.get(b.w);
    const 겹친수 = B.filter(x => A.has(x)).length;
    if (겹친수 / Math.min(A.size, B.length) >= 0.5) 겹침.push([a.w, b.w, 겹친수]);
  }
}

// --words 면 낱말만 한 줄에 하나씩 — sisain-sieve 로 넘겨 거르기 좋게
if (process.argv.includes('--words')) {
  for (const r of rows.slice(0, N)) console.log(r.w);
  process.exit(0);
}
console.log(`기사 ${글.length}건 · 요즘 = ${기준} 이후 ${최근글.length}건 · 후보 ${rows.length}종\n`);
if (겹침.length) {
  console.log('■ 같은 이야기를 두 이름으로 — 하나만 고를 것');
  console.log('  ' + 겹침.map(([a, b, n]) => a + ' <-> ' + b + '(' + n + '건 겹침)').join('  ') + '\n');
}
console.log('낱말        요즘/예전  날짜  급등  취재비중  주제쏠림   점수');
for (const r of rows.slice(0, N)) {
  console.log(`${r.w.padEnd(10)} ${String(r.n).padStart(3)}/${String(r.예전).padEnd(4)} ${String(r.날짜수).padStart(3)} ${r.급등.toFixed(1).padStart(5)} ${(r.취재비 * 100).toFixed(0).padStart(6)}% ${(r.주제쏠림 * 100).toFixed(0).padStart(7)}% ${r.점수.toFixed(1).padStart(6)}`);
}
