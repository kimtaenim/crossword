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
import fs from 'fs';
import path from 'path';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : path.join(process.cwd(), '..', 'sisain-chatbot');
const WRITE = process.argv.includes('--쓰기');
const 인자 = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];

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

const packPath = 'packs/news.json';
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));

/** 사람이 고친 힌트는 그대로 둔다 */
let 사람것 = new Set();
const 사람것경로 = 인자('사람것');
if (사람것경로) {
  사람것 = new Set(fs.readFileSync(사람것경로, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean));
}

const 대상 = [];
for (const g of pack.groups) for (const w of g.words) if (!사람것.has(w[0])) 대상.push(w);
console.error(`고칠 힌트 ${대상.length}개 (사람이 고친 ${사람것.size}개는 그대로 둔다)`);

const 물음 = (덩이) => `시사 크로스워드 힌트를 다시 쓴다. 지금 힌트는 뜻은 맞는데 사전 뜻풀이 투라 읽어도 그림이 안 그려진다.

■ 어떻게 고치나
- 눈에 보이는 장면으로. 누가 무엇을 하는지, 어디서 무슨 일이 벌어지는지.
- 중학생이 소리 내어 읽고 알아들을 말로. 한자어를 늘어놓지 않는다.
- «~하는 방식», «~하는 관계», «~적 영향력», «~하는 현상» 같은 맺음을 쓰지 않는다.
  «~하는 일», «~인 것», «~하는 곳», «~하는 돈», «~하는 사람» 으로 끝낸다.
- 마흔 자 안쪽. 한 줄로 읽히게.
- 아는 사람이 옆에서 일러 주듯. 한 가지 구체적인 것을 집어 주면 좋다.
- 정답이 통째로 들어가면 안 된다. 정답의 세 글자가 잇달아 들어가도 안 된다.
  («유럽연합» 힌트에 «유럽» 은 써도 되고, «온실가스감축목표» 힌트에 «온실가스» 는 안 된다)
- 지금 힌트에 없는 사실을 지어내지 않는다. 뜻이 헷갈리면 고치지 말고 그대로 둔다.

■ 함께 가릴 것
그 낱말이 뉴스를 웬만큼 보는 사람에게 낯선 말인가.
  아는말 — 들어 봤을 말
  낯선말 — 그 분야 사람이 아니면 처음 들을 말 (지경학, 초크포인트, 린치핀)

낯선 말이라고 빼지 않는다. 여기서 배우면 되는 말이다. 다만 힌트를 다르게 쓴다 —
그 말을 모르는 사람이 힌트만 읽고도 «아, 그런 걸 그렇게 부르는구나» 하게 쓴다.
쉬운 우리말로 뜻을 먼저 일러 주고, 어디에 쓰이는 말인지 한 가지를 집어 준다.

한 줄에 하나씩 "낱말|아는말 또는 낯선말|고친 힌트" 꼴로만 적는다. 다른 말은 쓰지 않는다.
고칠 데가 없으면 지금 힌트를 그대로 적는다.

${덩이.map(([w, clue]) => `${w} | ${clue}`).join('\n')}`;

const 묶음크기 = 25;
const 새힌트 = new Map();
const 어려움 = new Set();
let 입력토큰 = 0, 출력토큰 = 0;

for (let i = 0; i < 대상.length; i += 묶음크기) {
  const 덩이 = 대상.slice(i, i + 묶음크기);
  const j = await 불러본다({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: 물음(덩이) }],
    });
  for (const line of (j.content || []).map(c => c.text || '').join('').split(/\r?\n/)) {
    const m = line.match(/^\s*([가-힣0-9]{2,10})\s*\|\s*(아는말|낯선말)\s*\|\s*(.+?)\s*$/);
    if (!m) continue;
    const [, w, 익숙함, clue] = m;
    if (익숙함 === '낯선말') 어려움.add(w);      // 빼지는 않는다. 몇 개인지만 센다
    새힌트.set(w, clue);
  }
  입력토큰 += (j.usage || {}).input_tokens || 0;
  출력토큰 += (j.usage || {}).output_tokens || 0;
  process.stderr.write(`  다듬는 중 ${Math.min(i + 묶음크기, 대상.length)}/${대상.length}\r`);
}

/** 고친 힌트도 규칙을 다시 본다 — 못 미치면 옛 힌트를 그대로 둔다 */
// «고칠 데 없음» 같은 대답을 힌트 자리에 그대로 써 넣은 적이 있다. 그런 말은 힌트가 아니다
const 대답찌꺼기 = /^(고칠 데 없음|고친 힌트 없음|고칠 힌트 없음|없음|그대로|동일|변경 없음)$/;
// 거친 말·비하 표현이 힌트에 들어가면 안 된다. 기계가 «빨갱이» 를 쓴 적이 있다 —
// 기사에 그런 말이 인용돼 있으면 그대로 따라 쓴다. 사람이 볼 때까지 남아 있으면 안 되는 종류다.
const 거친말 = /빨갱이|종북|좌빨|수꼴|토착왜구|매국노|틀딱|급식충|맘충|김치녀|짱깨|쪽바리|병신|미친놈|벙어리|절름발이|장애자|불구자|창녀/;
const 성한가 = (w, clue) => {
  if (!clue || clue.length > 46 || clue.length < 6) return false;
  if (거친말.test(clue)) return false;
  if (대답찌꺼기.test(clue.trim())) return false;
  if (clue.includes(w)) return false;
  for (let i = 0; i + 3 <= w.length; i++) if (clue.includes(w.slice(i, i + 3))) return false;
  return true;
};

let 고침 = 0, 그대로 = 0;
const 남길 = [];
for (const g of pack.groups) {
  for (const w of g.words) {
    const 새것 = 새힌트.get(w[0]);
    if (새것 && 새것 !== w[1] && 성한가(w[0], 새것)) { w[1] = 새것; 고침++; } else 그대로++;
    남길.push(w);
  }
}
pack.groups = [{ name: pack.groups[0].name, words: 남길 }];

console.error(`\n고친 힌트 ${고침} · 그대로 둔 것 ${그대로} · 낯선 말 ${어려움.size}개(빼지 않고 힌트를 더 또렷이 썼다)`);
console.error(`입력 ${입력토큰} / 출력 ${출력토큰} 토큰 = 약 ${Math.round((입력토큰 / 1e6 * 1 + 출력토큰 / 1e6 * 5) * 1400)}원`);
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
