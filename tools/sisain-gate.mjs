/* 관문. 힌트가 제 낱말을 가리키는지 기계가 풀어 보고, 못 가리키면 다시 쓰게 하고,
   그래도 안 되면 그 낱말을 단어장에서 뺀다.

   node tools/sisain-gate.mjs [챗봇 레포 경로] [--맛보기=60] [--쓰기]

   ■ 왜 이 모양인가
   힌트를 기계가 쓰고 검사도 «이 힌트 맞습니까?» 라고 물었더니, 자기가 쓴 것을 자기가 보고
   맞다고 했다. 사람이 풀다가 하나씩 걸러 냈다 — 중소기업, 원내대표, 당대표, 재특회.
   그럴 일이 아니다. 관문이 있어야 한다.

   ■ 객관식으로 묻는 까닭
   정답을 가리고 «무슨 낱말이냐» 고 물으면, 모델이 못 맞히는 이유가 둘로 섞인다.
     ① 힌트가 나쁘다        ② 모델이 그 말을 모른다 (공소청·중대범죄수사청은 모델이 배운 뒤에 생겼다)
   그래서 보기를 준다 — 정답 하나와 단어장에서 뽑은 넷. 말을 몰라도 힌트가 제대로면 고를 수 있다.
   고르지 못하면 그건 힌트 탓이다.

   ■ 관문을 못 넘으면
   한 번은 다시 쓰게 한다(기사 대목을 주고). 다시 쓴 것도 못 넘으면 그 낱말은 빼 둔다.
   사람이 손댄 힌트(packs/손댄힌트.txt)는 검사만 하고 고치지 않는다 — 결과만 알려 준다.

   푸는 쪽은 Sonnet 을 쓴다. 힌트를 쓴 Haiku 와 다른 눈이라야 검사가 된다.
*/
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : path.join(process.cwd(), '..', 'sisain-chatbot');
const 인자 = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const 맛보기 = Number(인자('맛보기') || 0);
const WRITE = process.argv.includes('--쓰기');

const env = {};
for (const line of fs.readFileSync(path.join(repo, '.env.local'), 'utf8').split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}
const KEY = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 가 없습니다'); process.exit(1); }

/* 누설·길이 검사는 시사IN 챗봇 레포의 lib/quality.js 하나를 크로스워드와 퀴즈가 같이 쓴다.
   («재판소원» 힌트에 정답이 들어 있던 것과, 퀴즈에서 «쿠팡Inc» 를 «쿠팡…» 으로 물은 것이
   같은 흠이다. 규칙을 양쪽에 따로 적어 두면 한쪽만 고치고 다른 쪽은 잊는다.) */
const 품질 = (() => {
  try { return createRequire(import.meta.url)(repo + '/lib/quality.js'); }
  catch (_) { return null; }
})();

/* 끈질기게 다시 부른다. 인터넷이 몇 분 끊기는 일이 있다 — 그때마다 스무 분 작업을 버릴 수는 없다.
   2초에서 시작해 1분까지 늘려 가며 여섯 번 해 본다. */
async function 불러본다(body, 횟수 = 6) {
  const 쉬는시간 = [2000, 5000, 10000, 20000, 40000, 60000];
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
      process.stderr.write(`
  다시 부른다 (${i + 1}/${횟수}) — ${String(e.message || e).slice(0, 60)}
`);
      await new Promise(r => setTimeout(r, 쉬는시간[i] || 60000));
    }
  }
  throw 마지막;
}
const 글자 = j => (j.content || []).map(c => c.text || '').join('');

const arts = JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8'));
const 원문 = arts.map(a => ({
  d: (a.date || '').slice(0, 10).replace(/\./g, '-'),
  t: [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' '),
})).sort((a, b) => b.d.localeCompare(a.d));

const packPath = 'packs/news.json';
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const 모든낱말 = pack.groups.flatMap(g => g.words);

let 손댄 = new Set();
try {
  손댄 = new Set(fs.readFileSync('packs/손댄힌트.txt', 'utf8').split(/\r?\n/)
    .map(l => l.trim()).filter(l => l && !l.startsWith('#')));
} catch (_) {}

const 할것 = 맛보기 ? 모든낱말.slice(0, 맛보기) : 모든낱말;
/* 쓰는 쪽과 푸는 쪽에 다른 모델을 둔다.
   힌트는 잘 써야 하니 좋은 모델(Sonnet)이 쓰고, 푸는 것은 약한 모델(Haiku)이 한다.
   약한 모델이 보기에서 골라낼 수 있으면 실력 없는 사람도 풀 수 있다는 뜻이다 —
   좋은 모델이 푸는 시험은 «어려운 힌트도 통과» 시켜 버려서 쉬운지를 가리지 못한다. */
const 쓰는모델 = 'claude-sonnet-5';
const 푸는모델 = 'claude-haiku-4-5-20251001';
let 입력 = 0, 출력 = 0;

function 대목(w, 개수 = 2) {
  const out = [];
  for (const a of 원문) {
    const i = a.t.indexOf(w);
    if (i < 0) continue;
    out.push(`(${a.d}) ${a.t.slice(Math.max(0, i - 70), i + 80).replace(/\s+/g, ' ').trim()}`);
    if (out.length >= 개수) break;
  }
  return out;
}

/** 보기 다섯 — 정답과, 글자 수가 비슷한 다른 낱말 넷 */
function 보기만들기(w) {
  const 또래 = 모든낱말.filter(x => x[0] !== w[0] && Math.abs(x[0].length - w[0].length) <= 1);
  const 뽑은 = [];
  const 쓴것 = new Set();
  while (뽑은.length < 4 && 또래.length) {
    const c = 또래[Math.floor(Math.random() * 또래.length)][0];
    if (!쓴것.has(c)) { 쓴것.add(c); 뽑은.push(c); }
  }
  const 다섯 = [w[0], ...뽑은].sort(() => Math.random() - 0.5);
  return 다섯;
}

/** 관문 통과 여부를 묶음으로 묻는다 */
async function 풀려보기(덩이) {
  const 물음 = `한국 시사 크로스워드의 열쇠다. 각 열쇠가 가리키는 낱말을 보기에서 고른다.

낱말을 처음 들어 봐도 괜찮다. 열쇠가 가리키는 쪽을 고르면 된다.
고를 수 없을 만큼 열쇠가 흐릿하면 «못고름» 이라고 적는다.

한 줄에 하나씩 "번호|고른낱말" 꼴로만 적는다. 다른 말은 쓰지 않는다.

${덩이.map((x, i) => `${i + 1}. ${x.w[1]}\n   보기: ${x.보기.join(' / ')}`).join('\n')}`;
  const j = await 불러본다({ model: 푸는모델, max_tokens: 3000, messages: [{ role: 'user', content: 물음 }] });
  입력 += j.usage?.input_tokens || 0; 출력 += j.usage?.output_tokens || 0;
  const 답 = new Map();
  for (const line of 글자(j).split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s*[.|]\s*(.+?)\s*$/);
    if (m) 답.set(Number(m[1]), m[2].replace(/\s+/g, ''));
  }
  return 덩이.map((x, i) => ({ ...x, 고른것: 답.get(i + 1) || '' }));
}

/** 사실이 맞는지 — 기사 대목과 상식으로 */
async function 사실보기(덩이) {
  const 물음 = `한국 시사 크로스워드의 낱말과 열쇠다. 열쇠에 사실과 어긋나는 데가 있는지 본다.
기사 대목을 함께 주되, 기사에 없는 것도 아는 상식으로 판단한다.
낱말을 처음 들어 본다면 «모름» 이라고 적는다 — 모르는 것을 틀렸다고 하지 않는다.

한 줄에 하나씩 "낱말|맞음" / "낱말|틀림|무엇이 틀렸는지" / "낱말|모름" 꼴로만 적는다.

${덩이.map(x => `[${x.w[0]}] ${x.w[1]}${대목(x.w[0]).map(e => `\n   ${e}`).join('')}`).join('\n\n')}`;
  const j = await 불러본다({ model: 쓰는모델, max_tokens: 3000, messages: [{ role: 'user', content: 물음 }] });
  입력 += j.usage?.input_tokens || 0; 출력 += j.usage?.output_tokens || 0;
  const 답 = new Map();
  for (const line of 글자(j).split(/\r?\n/)) {
    const m = line.match(/^\s*([가-힣0-9]{2,12})\s*\|\s*(맞음|틀림|모름)\s*\|?\s*(.*)$/);
    if (m) 답.set(m[1], { 판정: m[2], 까닭: m[3] || '' });
  }
  return 답;
}

/** 못 넘은 힌트를 다시 쓴다 — 한 번만 */
async function 다시쓰기(목록) {
  if (!목록.length) return new Map();
  const 물음 = `시사 크로스워드 열쇠를 다시 쓴다. 지금 열쇠로는 그 낱말을 가리키지 못한다.

■ 지킬 것
- 그 낱말이 «무엇인가» 를 먼저 또렷이 적는다. 한 낱말만 가리키게 적는다.
- 그 말이 요즘 기사에 나온 대목이 있으면 앞에 짧게 붙인다. 없으면 뜻만 적는다.
- 예순 자 안쪽. 정답이 통째로 들어가면 안 되고, 정답의 세 글자가 잇달아 들어가도 안 된다.
- 중학생이 소리 내어 읽고 알아들을 말로. «~하는 일», «~인 것», «~하는 곳» 으로 끝낸다.
- 기사에 없는 사실을 지어내지 않는다. 그 낱말의 뜻을 모르겠으면 «모름» 이라고 적는다.

한 줄에 하나씩 "낱말|다시 쓴 열쇠" 꼴로만 적는다.

${목록.map(x => `[${x.w[0]}] 지금 열쇠: ${x.w[1]}${대목(x.w[0]).map(e => `\n   ${e}`).join('')}`).join('\n\n')}`;
  const j = await 불러본다({ model: 쓰는모델, max_tokens: 3000, messages: [{ role: 'user', content: 물음 }] });
  입력 += j.usage?.input_tokens || 0; 출력 += j.usage?.output_tokens || 0;
  const 답 = new Map();
  for (const line of 글자(j).split(/\r?\n/)) {
    const m = line.match(/^\s*([가-힣0-9]{2,12})\s*\|\s*(.+?)\s*$/);
    if (m && m[2] !== '모름') 답.set(m[1], m[2]);
  }
  return 답;
}

const 거친말 = /빨갱이|종북|좌빨|수꼴|토착왜구|매국노|틀딱|급식충|맘충|김치녀|짱깨|쪽바리|병신|미친놈|벙어리|절름발이|장애자|불구자|창녀/;
const 성한가 = (w, clue) => {
  if (!clue || clue.length > 60 || clue.length < 6) return false;
  if (거친말.test(clue) || clue.includes(w)) return false;
  if (품질 && 품질.누설(w, clue, { 봐주기: 품질.봐주는길이.크로스워드 }).샘) return false;
  if (!품질) for (let i = 0; i + 3 <= w.length; i++) if (clue.includes(w.slice(i, i + 3))) return false;
  return true;
};

/* ───────── 관문을 돌린다 ───────── */
const 묶음 = 15;
const 통과 = [], 고쳐통과 = [], 뺄것 = [], 사실틀림 = [];

for (let i = 0; i < 할것.length; i += 묶음) {
  const 덩이 = 할것.slice(i, i + 묶음).map(w => ({ w, 보기: 보기만들기(w) }));

  let 푼결과 = await 풀려보기(덩이);
  const 사실 = await 사실보기(덩이);

  // 첫판에 못 넘은 것 — 힌트가 가리키지 못하거나 사실이 틀린 것
  const 다시할것 = [];
  for (const x of 푼결과) {
    const f = 사실.get(x.w[0]);
    const 사실나쁨 = f?.판정 === '틀림';
    if (사실나쁨) 사실틀림.push([x.w[0], x.w[1], f.까닭]);
    if (x.고른것 === x.w[0] && !사실나쁨) { 통과.push(x.w[0]); continue; }
    if (손댄.has(x.w[0])) { 통과.push(x.w[0]); continue; }   // 사람 힌트는 고치지 않는다
    다시할것.push(x);
  }

  // 한 번 다시 쓰고 다시 물어본다
  if (다시할것.length) {
    const 새것 = await 다시쓰기(다시할것);
    const 재시험 = [];
    for (const x of 다시할것) {
      const n = 새것.get(x.w[0]);
      if (n && 성한가(x.w[0], n)) 재시험.push({ w: [x.w[0], n, x.w[2]], 보기: x.보기, 원래: x.w });
    }
    const 푼것2 = 재시험.length ? await 풀려보기(재시험) : [];
    const 넘은것 = new Set(푼것2.filter(x => x.고른것 === x.w[0]).map(x => x.w[0]));
    for (const x of 다시할것) {
      const r = 재시험.find(y => y.w[0] === x.w[0]);
      if (r && 넘은것.has(x.w[0])) { x.w[1] = r.w[1]; 고쳐통과.push([x.w[0], r.원래[1], r.w[1]]); }
      else 뺄것.push([x.w[0], x.w[1], x.고른것 || '못고름']);
    }
  }
  process.stderr.write(`  관문 ${Math.min(i + 묶음, 할것.length)}/${할것.length} — 통과 ${통과.length} · 고쳐서 통과 ${고쳐통과.length} · 뺄 것 ${뺄것.length}\r`);
}

const 값 = Math.round((입력 / 1e6 * 3 + 출력 / 1e6 * 15) * 1400);
console.error(`\n\n통과 ${통과.length} · 고쳐서 통과 ${고쳐통과.length} · 못 넘어 뺄 것 ${뺄것.length} · 사실 틀림 ${사실틀림.length}`);
console.error(`입력 ${입력} / 출력 ${출력} 토큰 = 약 ${값}원\n`);

console.log('■ 고쳐서 통과한 것');
for (const [w, o, n] of 고쳐통과.slice(0, 30)) console.log(`  ${w}\n    전: ${o}\n    후: ${n}`);
console.log('\n■ 두 번 해도 못 넘은 것 — 뺀다 (낱말 / 힌트 / 기계가 고른 답)');
for (const [w, c, g] of 뺄것.slice(0, 40)) console.log(`  ${w}  ← ${g}\n    ${c}`);

if (!WRITE) { console.error('\n미리보기만 했다. 실제로 고치려면 --쓰기 를 붙일 것.'); process.exit(0); }

const 뺄이름 = new Set(뺄것.map(r => r[0]));
pack.groups[0].words = pack.groups[0].words.filter(w => !뺄이름.has(w[0]));
const q = s => JSON.stringify(s);
const head = Object.keys(pack).filter(k => k !== 'groups')
  .map(k => `  ${q(k)}: ${JSON.stringify(pack[k])},`).join('\n');
const groups = pack.groups.map(g =>
  `    {\n      "name": ${q(g.name)},\n      "words": [\n` +
  g.words.map(w => '        [' + w.map(q).join(', ') + ']').join(',\n') + '\n      ]\n    }').join(',\n');
fs.writeFileSync(packPath, `{\n${head}\n  "groups": [\n${groups}\n  ]\n}\n`, 'utf8');
if (뺄이름.size) {
  fs.appendFileSync('packs/뺀말.txt',
    '\n# 관문을 두 번 못 넘은 말 — 힌트를 다시 써도 그 낱말을 가리키지 못했다\n' +
    [...뺄이름].join('\n') + '\n', 'utf8');
}
console.error(`→ ${packPath} 갱신 (낱말 ${pack.groups[0].words.length}개)`);
