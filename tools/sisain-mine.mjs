/* 기사를 읽고 시사 낱말을 캐낸다.
   node tools/sisain-mine.mjs [챗봇 레포 경로] [--부터=2026-08-14] [--건수=200] > 새말.json

   sisain-pick 은 말뭉치 통계로 낱말을 골랐다 — 조사가 붙는가, 여러 번 나오는가,
   요즘 솟았는가. 그건 읽을 줄 아는 기계가 없던 시절의 방법이다. 한계가 뚜렷했다.
     · 새 기사가 데려온 새 말은 대개 한 번만 나온다. «여러 번» 을 기다리면 그 주의 말을 놓친다
     · 한 번 나온 말은 조사 종류가 서너 가지까지 안 나와서 멀쩡한 명사가 떨어진다
     · «컴퓨터그래픽» 과 «내란특검» 은 어떤 통계로도 안 갈린다(PMI·제목 비율·토막 갈래 다 재 봤다)
   그래서 기사를 통째로 읽히고 낱말과 힌트를 한 번에 받는다. 기사가 늘면 낱말도 그만큼 는다.

   무엇을 뽑는지는 그동안 사람과 맞춰 온 잣대 그대로다.
     따로 배워야 뜻을 아는 말만. 일상어를 이어 붙인 말(영화감독), 자리 이름(정책실장),
     서류 이름(기소계획서), 고유명사, 분야 전문어(순자산)는 안 뽑는다.

   힌트는 기사에 적힌 것만 가지고 쓴다. 지어내면 푸는 사람이 영영 못 맞힌다.
*/
import fs from 'fs';
import path from 'path';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : path.join(process.cwd(), '..', 'sisain-chatbot');
const 인자 = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const 부터 = 인자('부터') || '';
const 건수 = Number(인자('건수') || 9999);
const 한번에 = Number(인자('한번에') || 3);

const env = {};
for (const line of fs.readFileSync(path.join(repo, '.env.local'), 'utf8').split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}
const KEY = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 가 없습니다'); process.exit(1); }

/** 한 번 끊겼다고 스무 분 작업을 버릴 수는 없다. 세 번까지 쉬었다 다시 부른다 */
async function 불러본다(body, 횟수 = 3) {
  let 마지막;
  for (let i = 0; i < 횟수; i++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(j).slice(0, 200));
      return j;
    } catch (e) {
      마지막 = e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw 마지막;
}

const arts = JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8'));
const onto = JSON.parse(fs.readFileSync(path.join(repo, 'data/ontology.json'), 'utf8')).articles || {};
const dir = fs.existsSync('packs/news.json') ? 'packs/' : '../packs/';
const pack = JSON.parse(fs.readFileSync(dir + 'news.json', 'utf8'));
// --새로 면 단어장을 처음부터 다시 짓는다. 이미 있는 말도 다시 캔다.
const 새로 = process.argv.includes('--새로');
const 있는말 = 새로 ? new Set() : new Set(pack.groups.flatMap(g => g.words.map(w => w[0])));

const day = d => (d || '').slice(0, 10).replace(/\./g, '-');
const 취재 = new Set(['news', 'feature']);
const 글 = arts
  .filter(a => 취재.has(onto[a.id]?.genre))          // 칼럼·서평·만화에서는 안 캔다
  .filter(a => !부터 || day(a.date) >= 부터)
  .sort((a, b) => day(b.date).localeCompare(day(a.date)))
  .slice(0, 건수);

const 갈래 = ['경제와 금융', '정치와 미디어', '환경과 에너지', '사회와 복지', '국제와 안보'];

const 물음 = (덩이) => `시사 크로스워드에 실을 낱말을 기사에서 캐낸다. 기사마다 쓸 만한 낱말을 모두 찾아 힌트를 붙인다.

■ 뽑을 것
뉴스를 읽는 사람이 따로 배워야 뜻을 아는 말. 제도·기구·정책·현상·쟁점의 이름.
한글 세 글자에서 여덟 글자까지. 기사에 실제로 나온 말만.
기사 하나에서 서넛은 나온다. 새로 생긴 말만 찾지 말고, 그 기사를 읽는 데 알아야 하는
시사 낱말이면 오래된 말이라도 뽑는다. 본문 깊은 데 한 번 나온 말도 뽑는다.

■ 뽑지 말 것
- 흔한 낱말을 이어 붙인 말. 앞뒤를 아는 사람이면 뜻도 아는 말이라 배울 것이 없다
  (영화감독, 컴퓨터그래픽, 올림픽공원, 살인사건, 장기투자)
- 자리 이름과 서류 이름 (정책실장, 비대위원장, 기소계획서, 제안서)
- 사람·회사·기관·제품의 이름 (이재명, 쿠팡, 국정원, 챗지피티)
- 그 분야 사람끼리만 쓰는 기술 용어 (순자산, 기초자산, 생산력, 접근법).
  다만 뉴스 지면에서 일반 독자가 마주치는 분야어는 뽑는다 (개발경제학, 레버리지, 지경학)
- 그냥 일반 명사 (프로그램, 아이디어, 우리나라)

■ 힌트 규칙
- 마흔 자 안쪽. 한 줄로 읽히게.
- 정답이 힌트에 통째로 들어가면 안 된다. 정답의 세 글자가 잇달아 들어가도 안 된다.
  («유럽연합» 힌트에 «유럽» 은 써도 되고, «온실가스감축목표» 힌트에 «온실가스» 는 안 된다)
- 그 말이 «무엇인가» 를 적는다. 언제 쓰는 말인지, 왜 중요한지는 적지 않는다.
- 사전 뜻풀이처럼 쓰지 않는다. «~하는 방식», «~하는 관계», «~적 영향력» 으로 맺지 않는다.
- 눈에 보이는 장면으로. 누가 무엇을 하는지, 어디서 무슨 일이 벌어지는지.
- 중학생이 소리 내어 읽고 알아들을 말로. 한자어를 늘어놓지 않는다.
- 기사에 없는 사실을 지어내지 않는다. 확실하지 않으면 그 낱말을 아예 뽑지 않는다.
- 존댓말을 쓰지 않는다. «~하는 일», «~인 것», «~하는 곳», «~하는 돈» 으로 끝낸다.

갈래는 다음 다섯 중 하나: ${갈래.join(' / ')}

한 줄에 하나씩 "낱말|갈래|힌트" 꼴로만 적는다. 다른 말은 쓰지 않는다.
쓸 만한 낱말이 없는 기사는 아무 줄도 적지 않는다.

${덩이.map((a, i) => `[기사 ${i + 1}] ${a.title}\n${(a.subtitle || '')}\n${(a.body || '').slice(0, 1600)}`).join('\n\n')}`;

const 캔것 = new Map();
let 입력토큰 = 0, 출력토큰 = 0;

for (let i = 0; i < 글.length; i += 한번에) {
  const 덩이 = 글.slice(i, i + 한번에);
  const j = await 불러본다({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: 물음(덩이) }],
    });
  for (const line of (j.content || []).map(c => c.text || '').join('').split(/\r?\n/)) {
    const m = line.match(/^\s*([가-힣0-9]{3,8})\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*$/);
    if (!m) continue;
    const [, w, k, clue] = m;
    if (!갈래.includes(k) || 있는말.has(w) || 캔것.has(w)) continue;
    캔것.set(w, [w, clue, k]);
  }
  입력토큰 += (j.usage || {}).input_tokens || 0;
  출력토큰 += (j.usage || {}).output_tokens || 0;
  process.stderr.write(`  캐는 중 ${Math.min(i + 한번에, 글.length)}/${글.length} — ${캔것.size}종\r`);
}

/** 여기서 한 번 거른다 — 정답이 새거나 길이가 안 맞으면 버린다 */
// 거친 말·비하 표현이 힌트에 들어가면 안 된다. 기계가 «빨갱이» 를 쓴 적이 있다 —
// 기사에 그런 말이 인용돼 있으면 그대로 따라 쓴다. 사람이 볼 때까지 남아 있으면 안 되는 종류다.
const 거친말 = /빨갱이|종북|좌빨|수꼴|토착왜구|매국노|틀딱|급식충|맘충|김치녀|짱깨|쪽바리|병신|미친놈|벙어리|절름발이|장애자|불구자|창녀/;
const 통과 = [], 버림 = [];
for (const [w, clue, k] of 캔것.values()) {
  let 샘 = false;
  // 두 음절까지는 힌트에 써도 된다(사람이 정한 선). 세 음절부터 막는다
  for (let i = 0; i + 3 <= w.length; i++) if (clue.includes(w.slice(i, i + 3))) 샘 = true;
  if (clue.includes(w)) 샘 = true;
  if (거친말.test(clue)) { 버림.push([w, clue, '거친 말']); continue; }
  if (샘) { 버림.push([w, clue, '정답이 샘']); continue; }
  if (clue.length > 46 || clue.length < 6) { 버림.push([w, clue, '길이']); continue; }
  통과.push([w, clue, k]);
}

console.log(JSON.stringify(통과, null, 0));
console.error(`\n기사 ${글.length}건에서 ${통과.length}종 (버린 것 ${버림.length}종)`);
console.error(`입력 ${입력토큰} / 출력 ${출력토큰} 토큰 = 약 ${Math.round((입력토큰 / 1e6 * 1 + 출력토큰 / 1e6 * 5) * 1400)}원`);
