/* 힌트를 쉽고 재미있게 다시 쓴다. 너무 어려운 낱말은 골라낸다.
   node tools/sisain-polish.mjs [챗봇 레포 경로] [--쓰기]

   기계가 캐 온 힌트는 절반쯤이 사전 뜻풀이 투다 — «~하는 방식», «~하는 관계»,
   «~적 영향력». 뜻은 맞는데 읽어도 그림이 안 그려진다. 그림이 안 그려지면 못 푼다.
   그래서 한 번 더 읽혀 고쳐 쓴다.

   사람이 손으로 고친 힌트는 건드리지 않는다. 어느 것이 사람 것인지는 --사람것 으로 알려 준다
   (없으면 전부 기계 것으로 보고 고친다).

   낯선 말도 빼지 않는다. 초크포인트·린치핀·지경학은 여기서 배우면 되는 말이다 —
   단어장은 아는 말을 확인하는 자리가 아니라 새 말을 만나는 자리다.
   대신 낯선 말일수록 힌트가 가르치게 한다. 그런 말은 따로 표시해 힌트를 더 또렷이 쓴다.

   --쓰기 가 없으면 미리보기만 한다.
*/
import { 힌트규칙, 쓰기설정, 동시에 } from './lib-hint.mjs';
import { 안전모듈, 재료기사 } from './lib-safety.mjs';
import { 도장읽기, 규칙판, 유효한가 } from './lib-stamp.mjs';
import fs from 'fs';
import path from 'path';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : path.join(process.cwd(), '..', 'sisain-chatbot');
const 안전 = 안전모듈(repo);
const WRITE = process.argv.includes('--쓰기');
const 인자 = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];

const env = {};
try {   // 자동 작업(GitHub Actions)에는 .env.local 이 없고 키는 환경 변수로 온다
  for (const line of fs.readFileSync(path.join(repo, '.env.local'), 'utf8').split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
} catch (_) {}
const KEY = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 가 없습니다'); process.exit(1); }

/** 한 번 끊겼다고 스무 분 작업을 버릴 수는 없다. 세 번까지 쉬었다 다시 부른다 */
async function 불러본다(body, 횟수 = 3) {
  let 마지막;
  for (let i = 0; i < 횟수; i++) {
    try {
      // 5분 넘게 답이 없으면 끊고 다시 부른다. 대기 제한이 없어 호출 10개가 한꺼번에 멈춘 채 10분 넘게 서 있었다
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        signal: AbortSignal.timeout(5 * 60 * 1000),
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

/* 장면은 시사IN 기사에서 찾는다 (편집국 결정, 2026-09-27). 낱말마다 그 말이 중심인 기사 대목을 셋까지 준다.
   범죄·참사가 중심인 기사는 재료에서 뺀다(재료기사). 고른 기사는 번호를 받아 단어장에 링크로 남긴다(pack.기사). */
const arts = 재료기사(안전, JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8')));
const 원문 = arts.map(a => ({
  id: String(a.id), d: String(a.date || '').slice(0, 10).replace(/\./g, '-'), 제목: a.title || '',
  t: [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' '),
})).sort((a, b) => b.d.localeCompare(a.d));
// 띄어쓰기는 가리지 않는다 — 단어장의 «연임개헌» 이 기사에는 «연임 개헌» 으로 나온다.
// 붙여 찾지 않으면 새 낱말 다섯에 하나꼴로 출처 기사를 못 찾았다 (2026-10-05)
const 꼴 = w => new RegExp(w.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s?'), 'g');
function 기사대목(w, 개수 = 3) {
  const re = 꼴(w), 진한 = [], 스친 = [];
  for (const a of 원문) {
    const n = (a.t.match(re) || []).length;
    if (!n) continue;
    // 제목에 있거나 두 번 이상 나온 기사가 먼저다. 그런 기사가 없을 때만 한 번 스친 기사를 쓴다 — 새 낱말도 출처는 있어야 한다
    (a.제목.match(re) || n >= 2 ? 진한 : 스친).push({ a });
  }
  const 후보 = (진한.length ? 진한 : 스친).sort((x, y) => y.a.d.localeCompare(x.a.d));   // 가장 새 기사부터 (편집국 결정)
  return 후보.slice(0, 개수).map(({ a }) => {
    const i = Math.max(0, a.t.search(re));
    return { id: a.id, 글: `(${a.d} «${a.제목.slice(0, 40)}») ${a.t.slice(Math.max(0, i - 90), i + 110).replace(/\s+/g, ' ').trim()}` };
  });
}

const packPath = 'packs/news.json';
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));

/** 사람이 고친 힌트는 그대로 둔다 */
let 사람것 = new Set();
const 사람것경로 = 인자('사람것');
if (사람것경로) {
  사람것 = new Set(fs.readFileSync(사람것경로, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean));
}

/* --새것만: 자동 작업이 쓴다. 매주 모든 힌트를 다시 쓰면 멀쩡한 힌트가 흔들리고 안전 도장도 다 날아간다.
   그래서 (1) 안전 도장이 없는 힌트(새로 캐 온 말, 고쳐진 말)와 (2) packs/다시쓸말.txt 에 적힌 말만 다시 쓴다. */
const 새것만 = process.argv.includes('--새것만');
const 다시쓸말경로 = 'packs/다시쓸말.txt';
const 다시쓸말 = new Set(fs.existsSync(다시쓸말경로)
  ? fs.readFileSync(다시쓸말경로, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')) : []);
const 도장 = 도장읽기(), 판 = 규칙판(안전);
const 대상 = [];
for (const g of pack.groups) for (const w of g.words) {
  if (사람것.has(w[0])) continue;
  if (새것만 && !다시쓸말.has(w[0]) && 유효한가(도장, w[0], w[1], 판)) continue;
  대상.push(w);
}
console.error(`고칠 힌트 ${대상.length}개 (사람이 고친 ${사람것.size}개는 그대로 둔다)`);

const 물음 = (덩이) => `시사 크로스워드 힌트를 다시 쓴다. 지금 힌트는 뜻은 맞는데 사전 뜻풀이 투라 읽어도 그림이 안 그려진다.

■ 어떻게 고치나
- 장면이 먼저다. 뜻을 적고, 이 말을 실제로 만나는 장면을 반드시 하나 넣는다.
  누가 무엇을 하는지, 어디서 무슨 일이 벌어지는지, 뉴스에서 이 말이 어떤 때 나오는지.
  «통폐합 — 학생이 줄어 옆 학교와 합치며 한 곳은 문을 닫는 일»
- 중학생이 소리 내어 읽고 알아들을 말로. 한자어를 늘어놓지 않는다.
- «~하는 방식», «~하는 관계», «~적 영향력», «~하는 현상» 같은 맺음을 쓰지 않는다.
  «~하는 일», «~인 것», «~하는 곳», «~하는 돈», «~하는 사람» 으로 끝낸다.
- 아는 사람이 옆에서 일러 주듯. 한 가지 구체적인 것을 집어 주면 좋다.
- 정답이 통째로 들어가면 안 된다. 정답의 세 글자가 잇달아 들어가도 안 된다.
  («유럽연합» 힌트에 «유럽» 은 써도 되고, «온실가스감축목표» 힌트에 «온실가스» 는 안 된다)
- 사실과 다른 것을 지어내지 않는다.
- 서른에서 마흔다섯 자쯤으로 짧게. 지금 힌트가 길면 반드시 줄여 새로 쓴다. 맥락은 따로 붙는 예문이 맡는다.
- 낱말 밑에 그 말이 쓰인 시사IN 기사 대목을 준다(번호·날짜·제목). 장면은 이 대목에서 그 말이 실제로 쓰이는 모습을 보고 짓는다.
  다만 기사 속 특정 사건·인물·지명을 힌트로 옮기지 않는다 — 그 말을 누구나 만날 만한 장면으로 바꿔 쓴다.
  «역세권 — 지하철역에서 가까운 지역» (사전 풀이 — 안 된다)
  «역세권 — 집 구하는 사람들이 출퇴근 길을 줄이려 먼저 찾는, 지하철역 가까운 동네» (장면이 있다)
- 사전 풀이에 그친 힌트는 «고칠 데가 없다» 고 보지 말고 반드시 장면을 넣어 새로 쓴다.

■ 함께 가릴 것
그 낱말이 뉴스를 웬만큼 보는 사람에게 낯선 말인가.
  아는말 — 들어 봤을 말
  낯선말 — 그 분야 사람이 아니면 처음 들을 말 (지경학, 초크포인트, 린치핀)

낯선 말이라고 빼지 않는다. 여기서 배우면 되는 말이다. 다만 힌트를 다르게 쓴다 —
그 말을 모르는 사람이 힌트만 읽고도 «아, 그런 걸 그렇게 부르는구나» 하게 쓴다.
쉬운 우리말로 뜻을 먼저 일러 주고, 어디에 쓰이는 말인지 한 가지를 집어 준다.

한 줄에 하나씩 "낱말|아는말 또는 낯선말|고친 힌트|장면을 본 기사 번호" 꼴로만 적는다. 다른 말은 쓰지 않는다.
기사 대목이 없으면 번호 자리에 «없음» 이라고 적는다. 장면이 이미 있으면 지금 힌트를 그대로 적는다.

${덩이.map(([w, clue]) => `${w} | ${clue}${다시쓸말.has(w) ? '   ← 편집국이 다시 쓰라고 한 말. 지금 힌트를 그대로 두지 말고 반드시 새로 쓴다' : ''}` +
  기사대목(w, 2).map(e => `\n    [${e.id}] ${e.글}`).join('')).join('\n')}`;

const 묶음크기 = 25;
const 새힌트 = new Map();
const 새기사 = new Map();   // 낱말 → 장면을 가져온 시사IN 기사 번호
const 어려움 = new Set();
let 입력토큰 = 0, 출력토큰 = 0;

const 묶음들_ = [];
for (let i = 0; i < 대상.length; i += 묶음크기) 묶음들_.push(i);
// 한 번에 여러 묶음을 동시에 부른다 (lib-hint.mjs 의 동시에)
await 동시에(묶음들_, async (i) => {
  const 덩이 = 대상.slice(i, i + 묶음크기);
  const j = await 불러본다({
      ...쓰기설정,   // 힌트는 비싼 모델이 쓴다 (lib-hint.mjs)
      messages: [{ role: 'user', content: 물음(덩이) + '\n\n' + 힌트규칙() + '\n\n' + 안전.규칙글() }],
    });
  for (const line of (j.content || []).map(c => c.text || '').join('').split(/\r?\n/)) {
    const m = line.match(/^\s*([가-힣0-9A-Z]{2,10})\s*\|\s*(아는말|낯선말)\s*\|\s*(.+?)\s*(?:\|\s*(\d+|없음)\s*)?$/);
    if (!m) continue;
    const [, w, 익숙함, clue, 번호] = m;
    // 준 기사 가운데 하나라야 받는다. 없으면 그 말이 가장 중심인 기사를 링크로 단다
    const 준것 = 기사대목(w).map(e => e.id);
    if (준것.length) 새기사.set(w, 준것.includes(번호) ? 번호 : 준것[0]);
    if (익숙함 === '낯선말') 어려움.add(w);      // 빼지는 않는다. 몇 개인지만 센다
    새힌트.set(w, clue);
  }
  입력토큰 += (j.usage || {}).input_tokens || 0;
  출력토큰 += (j.usage || {}).output_tokens || 0;
  process.stderr.write(`  다듬는 중 ${Math.min(i + 묶음크기, 대상.length)}/${대상.length}\r`);
});

/** 고친 힌트도 규칙을 다시 본다 — 못 미치면 옛 힌트를 그대로 둔다 */
// «고칠 데 없음» 같은 대답을 힌트 자리에 그대로 써 넣은 적이 있다. 그런 말은 힌트가 아니다
const 대답찌꺼기 = /^(고칠 데 없음|고친 힌트 없음|고칠 힌트 없음|없음|그대로|동일|변경 없음)$/;
// 거친 말·비하 표현이 힌트에 들어가면 안 된다. 기계가 «빨갱이» 를 쓴 적이 있다 —
// 기사에 그런 말이 인용돼 있으면 그대로 따라 쓴다. 사람이 볼 때까지 남아 있으면 안 되는 종류다.
const 거친말 = /빨갱이|종북|좌빨|수꼴|토착왜구|매국노|틀딱|급식충|맘충|김치녀|짱깨|쪽바리|병신|미친놈|벙어리|절름발이|장애자|불구자|창녀/;
const 성한가 = (w, clue) => {
  if (!clue || clue.length > 80 || clue.length < 6) return false;
  if (거친말.test(clue)) return false;
  if (대답찌꺼기.test(clue.trim())) return false;
  if (clue.includes(w)) return false;
  for (let i = 0; i + 3 <= w.length; i++) if (clue.includes(w.slice(i, i + 3))) return false;
  return true;
};

let 고침 = 0, 그대로 = 0;
const 바뀐 = new Set();
const 남길 = [];
for (const g of pack.groups) {
  for (const w of g.words) {
    const 새것 = 새힌트.get(w[0]);
    if (새것 && 새것 !== w[1] && 성한가(w[0], 새것)) { w[1] = 새것; 고침++; 바뀐.add(w[0]); } else 그대로++;
    남길.push(w);
  }
}
pack.groups = [{ name: pack.groups[0].name, words: 남길 }];
// 기사 링크: 낱말 → 시사IN 기사 번호. 화면은 낱말을 맞힌 뒤에 «관련 기사» 로 보여 준다(game.js)
pack.기사 = pack.기사 || {};
for (const [w, id] of 새기사) if (바뀐.has(w) || !pack.기사[w]) pack.기사[w] = id;
// 다시 쓰지 않은 말(사람이 고친 힌트 등)도 그 말이 가장 중심인 기사를 «관련 기사» 로 단다
for (const w of 남길) if (!pack.기사[w[0]]) { const e = 기사대목(w[0], 1)[0]; if (e) pack.기사[w[0]] = e.id; }
const 남은말 = new Set(남길.map(w => w[0]));
for (const w of Object.keys(pack.기사)) if (!남은말.has(w)) delete pack.기사[w];

console.error(`\n고친 힌트 ${고침} · 그대로 둔 것 ${그대로} · 낯선 말 ${어려움.size}개(빼지 않고 힌트를 더 또렷이 썼다)`);
console.error(`입력 ${입력토큰} / 출력 ${출력토큰} 토큰 = 약 ${Math.round((입력토큰 / 1e6 * 4 + 출력토큰 / 1e6 * 20) * 1400)}원`);
if (어려움.size) console.error(`낯선 말: ${[...어려움].slice(0, 40).join(' ')}`);

if (!WRITE) { console.error('\n미리보기만 했다. 실제로 고치려면 --쓰기 를 붙일 것.'); process.exit(0); }

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
console.error(`→ ${packPath} 갱신 (낱말 ${남길.length}개)`);
if (새것만 && 다시쓸말.size) {
  // 이번에 실제로 새로 쓴 말만 목록에서 지운다 (머리 주석은 남긴다).
  // 전에는 모델이 «그대로 둔다» 고 답해도 지워서, 편집국이 다시 쓰라고 한 «빅테크» 가 그대로 나갔다
  const 한것 = new Set(대상.map(w => w[0]).filter(w => 바뀐.has(w)));
  const 안된것 = [...다시쓸말].filter(w => 대상.some(x => x[0] === w) && !바뀐.has(w));
  if (안된것.length) console.error(`다시쓸말인데 새로 쓰지 못한 것 (목록에 남긴다): ${안된것.join(' ')}`);
  const 줄 = fs.readFileSync(다시쓸말경로, 'utf8').split(/\r?\n/).filter(l => !한것.has(l.trim()));
  fs.writeFileSync(다시쓸말경로, 줄.join('\n'), 'utf8');
}
