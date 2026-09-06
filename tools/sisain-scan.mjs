/* 시사IN 챗봇 프로젝트의 기사 뭉치를 훑어, 시사 단어장을 손볼 거리를 뽑아낸다.
   node tools/sisain-scan.mjs [챗봇 레포 경로]        (기본 ../sisain-chatbot)

   빈도만 세면 "어떻게", "아니라", "때문에" 같은 토막이 위로 올라온다.
   그건 시사 용어가 아니므로 여기서 걸러 낸다. 거르는 잣대는 넷이다.

     ① 조사가 붙는가   명사는 뒤에 은·는·이·가·을·를·의·에 가 붙는다.
                      부사와 어미는 안 붙는다 — 어떻게 0.00, 지방선거 0.43.
     ①-2 조사가 여러 가지 붙는가
                      "그럼에도" 의 잘린 토막 "그럼에" 는 뒤에 «도» 만 붙고,
                      "대상으" 는 «로» 만 붙는다. 진짜 명사는 이/가/를/의/에서…
                      서너 가지가 두루 붙는다. 그래서 종류 수도 함께 센다.
     ② 너무 흔한가     기사 열 건 중 한 건 넘게 나오면 일반 명사다 (이야기, 사람들).
     ③ 사람·매체 이름인가  온톨로지의 인물·매체 엔티티는 뺀다 (이재명, 연합뉴스).
     ④ 이미 있는가     단어장에 든 말은 「요즘도 나오는 말」 쪽으로 보낸다.
*/
import fs from 'fs';
import path from 'path';

const repo = process.argv[2] || path.join(process.cwd(), '..', 'sisain-chatbot');
const arts = JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8'));
const onto = JSON.parse(fs.readFileSync(path.join(repo, 'data/ontology.json'), 'utf8'));
const dir = new URL('../packs/', import.meta.url).pathname;
const news = JSON.parse(fs.readFileSync(dir + 'news.json', 'utf8'));
const 있는말 = new Set(news.groups.flatMap(g => g.words.map(w => w[0])));

const JOSA = ['이', '가', '은', '는', '을', '를', '의', '에', '도', '만', '과', '와', '로',
              '부터', '까지', '처럼', '보다', '라고', '으로', '에서', '에게'];
const 붙는말 = ['으로써', '으로서', '에서는', '이라는', '에게서', '으로', '에서', '에게', '까지', '부터',
                '보다', '처럼', '마다', '라고', '와의', '과의', '의', '은', '는', '이', '가', '을', '를',
                '에', '도', '만', '과', '와', '로'];
const 어미 = /(다|요|음|임|함|움|했|한다|된다|하는|하고|해서|하며|이다|같은|같이|적인|적으로|하지|않은|않는|있는|없는|되는|위한|통해|대한|따라|이런|그런|우리|여러|모든|어떤|이번|지난|올해|내년|작년|인지|만들|어딘|무엇|얼마|는지|느냐|하기|나기|되기|가기|오기|보기|까지|부터|사용하|살아남)$/;

const day = d => (d || '').slice(0, 10).replace(/\./g, '-');
const 글 = arts.map(a => {
  const t = [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' ');
  // 우리말 합성어는 붙여 쓰기도 하고 띄어 쓰기도 한다. 단어장의 "표현의자유" 를
  // 기사에서 찾으려면 띄어쓰기를 지우고 맞춰 봐야 한다 (안 그러면 멀쩡한 말이 묵은 말이 된다)
  return { d: day(a.date), t, 붙인: t.replace(/\s+/g, '') };
}).filter(a => a.d);
const 날짜 = 글.map(a => a.d).sort();
const 요즘 = 날짜[Math.floor(날짜.length * 0.75)];
const 최근글 = 글.filter(a => a.d >= 요즘);

/** 사람 이름과 매체 이름은 시사 «용어» 가 아니다 */
const 이름 = new Set();
for (const a of Object.values(onto.articles || {}))
  for (const e of (a.entities || []))
    if (e.type === 'person' || e.subtype === 'media' || e.subtype === 'journalist') 이름.add(e.name);

/** 뒤에 조사가 붙는 비율 — 명사인지 가리는 잣대 */
function 조사비율(w, 글들) {
  let all = 0, josa = 0;
  const 종류 = new Set();
  for (const a of 글들) {
    let i = 0;
    while ((i = a.t.indexOf(w, i)) >= 0) {
      all++;
      const 뒤 = a.t.slice(i + w.length, i + w.length + 3);
      const j = JOSA.find(x => 뒤.startsWith(x));
      if (j) { josa++; 종류.add(j); }
      i += w.length;
      if (all > 400) break;
    }
    if (all > 400) break;
  }
  return { all, 비율: josa / Math.max(1, all), 종류: 종류.size };
}

const 센다 = (w, 글들) => 글들.reduce((n, a) => n + (a.붙인.includes(w) ? 1 : 0), 0);

console.log(`기사 ${arts.length}건 (${날짜[0]} ~ ${날짜[날짜.length - 1]}), 요즘 = ${요즘} 이후 ${최근글.length}건\n`);

// ── 단어장에 있는 말: 아직 살아 있는가
const 있는것 = [...있는말].map(w => ({ w, 요즘: 센다(w, 최근글), 전체: 센다(w, 글) }));
const 묵은 = 있는것.filter(x => x.전체 === 0).map(x => x.w);
console.log('■ 단어장에 있는데 이 뭉치에 한 번도 안 나온 말 — 묵었는지 살펴볼 것');
console.log('  ' + (묵은.join(' ') || '없음') + `  (${묵은.length}개)\n`);
console.log('■ 단어장에 있고 요즘도 자주 나오는 말 (요즘/전체)');
console.log('  ' + 있는것.filter(x => x.요즘 > 0).sort((a, b) => b.요즘 - a.요즘).slice(0, 24)
  .map(x => `${x.w}(${x.요즘}/${x.전체})`).join('  ') + '\n');

// ── 넣을 만한 새 말
const df = new Map();
for (const a of 최근글) {
  const seen = new Set();
  for (const m of a.t.matchAll(/[가-힣]{3,9}/g)) {
    let w = m[0];
    // 조사는 먼저 떼고, 그러고도 세 글자가 넘어야 후보다.
    // "한국에서" → "한국"(두 글자) → 버린다. 조사가 겹쳐 붙기도 하므로("앞으로는")
    // 더 뗄 것이 없을 때까지 되풀이한다
    for (let round = 0; round < 3; round++) {
      const 전 = w;
      for (const j of 붙는말) if (w.length - j.length >= 2 && w.endsWith(j)) { w = w.slice(0, -j.length); break; }
      if (w === 전) break;
    }
    if (w.length < 3 || w.length > 7) continue;
    if (어미.test(w) || 있는말.has(w) || 이름.has(w)) continue;
    seen.add(w);
  }
  for (const w of seen) df.set(w, (df.get(w) || 0) + 1);
}
/* 명사이긴 한데 시사 «용어» 는 아닌 말. 자동으로 가리기 어려워 손으로 적어 둔다 */
const 일반명사 = new Set(('이야기 사람들 사람이 여러분 아이들 시민들 독자들 기자들 노동자들 관계자 당사자 ' +
  '이미지 분위기 메시지 목소리 가능성 나머지 공동체 무언가 언젠가 프로젝트 서비스 콘텐츠 인터뷰 ' +
  '구체적 적극적 대규모 오랫동안 지난해 올해도 시간이 시간을 마지막 대부분 제작진 위원장 대표는 ' +
  '데이터 인프라 플랫폼 온라인 이후에 이전에 시대에 여기서 처음으 대상으 내용으 그럼에 것이라 ' +
  '보이지 보여주 생각하 나아가 그렇기 있을지 아니냐 이어지 가까이 현장에서 지역에서 입장에서 ' +
  '내에서 만들기 설명하기 상당수 대다수 자신들 한마디 어머니 아버지 선생님 주인공').split(/\s+/));

const 흔함 = 최근글.length * 0.10;          // 열 건에 한 번 넘게 나오면 일반 명사다
const 후보 = [...df].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 1500);
const 골라낸 = [];
for (const [w, n] of 후보) {
  if (n > 흔함 || 일반명사.has(w)) continue;
  const { all, 비율, 종류 } = 조사비율(w, 최근글);
  if (all < 6 || 비율 < 0.2 || 종류 < 3) continue;   // 조사가 두루 붙어야 명사다
  골라낸.push({ w, n, 비율: +비율.toFixed(2), 종류 });
  if (골라낸.length >= 80) break;
}
골라낸.sort((a, b) => (b.w.length >= 4) - (a.w.length >= 4) || b.n - a.n);
console.log('■ 단어장에 없는데 요즘 기사에 자주 나오는 말 (기사 수, 조사비율)');
console.log('  ' + 골라낸.map(x => `${x.w}(${x.n})`).join('  '));
console.log('\n  긴 말(네 글자 이상)이 앞에 온다 — 크로스워드에 쓸모 있는 쪽이다.');
