/* 힌트가 사실과 맞는지 기사에 대고 검사한다.
   node tools/sisain-verify.mjs [챗봇 레포 경로] [--사람것=목록.txt] [--쓰기]

   기계가 쓴 힌트는 그럴듯한데 틀릴 때가 있다. 열넷을 훑어보다 하나를 잡았다 —
   «남방한계선» 을 «경기도 남쪽에 반도체 공장들이 밀집한 띠» 라고 적었다.
   그 낱말이 반도체 벨트 기사에 섞여 나온 것을 보고 앞뒤를 지어 붙인 것이다.
   뜻을 아는 사람은 웃고 말지만, 모르는 사람은 그대로 배운다. 그게 제일 나쁘다.

   그래서 낱말마다 그 말이 실제로 나온 기사 대목을 다시 붙여 주고 묻는다.
     맞음   — 기사와 어긋나지 않고, 낱말의 뜻으로도 맞다
     고침   — 뜻이 틀렸거나 엉뚱한 데서 끌어왔다. 바로 쓴 힌트를 함께 받는다
     버림   — 기사만으로는 뜻을 알 수 없다. 단어장에서 뺀다

   사람이 손으로 고친 힌트는 검사하지 않는다(--사람것).
   --쓰기 가 없으면 미리보기만 한다.
*/
import { 힌트규칙 } from './lib-hint.mjs';
import { 안전모듈, 재료기사 } from './lib-safety.mjs';
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

const 안전 = 안전모듈(repo);
const arts = 재료기사(안전, JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8')));
const 글 = arts.map(a => [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' '));
const packPath = 'packs/news.json';
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));

let 사람것 = new Set();
const 사람것경로 = 인자('사람것');
if (사람것경로) 사람것 = new Set(fs.readFileSync(사람것경로, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean));

function 대목(w, 개수 = 2) {
  const out = [];
  for (const t of 글) {
    const i = t.indexOf(w);
    if (i < 0) continue;
    out.push(t.slice(Math.max(0, i - 70), i + 80).replace(/\s+/g, ' ').trim());
    if (out.length >= 개수) break;
  }
  return out;
}

const 대상 = [];
for (const g of pack.groups) for (const w of g.words) if (!사람것.has(w[0])) 대상.push(w);
console.error(`검사할 힌트 ${대상.length}개 (사람이 고친 ${사람것.size}개는 건너뛴다)`);

const 물음 = (덩이) => `시사 크로스워드 힌트가 사실과 맞는지 검사한다. 낱말마다 지금 힌트와, 그 말이 실제로 나온 기사 대목을 준다.

셋 중 하나로 답한다.
  맞음 — 낱말의 뜻으로 맞다. 기사와도 어긋나지 않는다
  고침 — 뜻이 틀렸다. 또는 그 낱말과 상관없는 데서 끌어다 붙였다. 바로 쓴 힌트를 함께 적는다
  버림 — 기사만으로는 무슨 말인지 알 수 없다. 단어장에서 뺀다

■ 조심할 것
그 낱말이 기사에 나왔다고 해서, 기사의 이야기가 그 낱말의 뜻인 것은 아니다.
«남방한계선» 이 반도체 기사에 섞여 나왔다고 «반도체 공장이 늘어선 띠» 라고 적으면 틀린 것이다.
낱말 본디의 뜻을 먼저 보고, 기사는 그것을 어기지 않는지 보는 데 쓴다.

■ 고쳐 쓸 때 지킬 것
- 마흔 자 안쪽. 눈에 보이는 장면으로. 중학생이 알아들을 말로.
- 정답이 통째로 들어가면 안 되고, 정답의 세 글자가 잇달아 들어가도 안 된다.
- «~하는 일», «~인 것», «~하는 곳», «~하는 돈», «~하는 사람» 으로 끝낸다.

한 줄에 하나씩 적는다. 맞으면 "낱말|맞음", 고치면 "낱말|고침|새 힌트", 버리면 "낱말|버림".
다른 말은 쓰지 않는다.

${덩이.map(([w, clue]) => `[${w}] 지금 힌트: ${clue}\n${대목(w).map(e => '  · ' + e).join('\n')}`).join('\n\n')}`;

const 묶음크기 = 10;
const 판정 = new Map();
let 입력토큰 = 0, 출력토큰 = 0;

for (let i = 0; i < 대상.length; i += 묶음크기) {
  const 덩이 = 대상.slice(i, i + 묶음크기);
  const j = await 불러본다({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: 물음(덩이) + '\n\n' + 힌트규칙() + '\n\n' + 안전.규칙글() }],
    });
  for (const line of (j.content || []).map(c => c.text || '').join('').split(/\r?\n/)) {
    const m = line.match(/^\s*([가-힣0-9]{2,12})\s*\|\s*(맞음|고침|버림)\s*(?:\|\s*(.+?))?\s*$/);
    if (!m) continue;
    판정.set(m[1], { 답: m[2], clue: m[3] || '' });
  }
  입력토큰 += (j.usage || {}).input_tokens || 0;
  출력토큰 += (j.usage || {}).output_tokens || 0;
  process.stderr.write(`  검사 중 ${Math.min(i + 묶음크기, 대상.length)}/${대상.length}\r`);
}

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

let 맞음 = 0, 고침 = 0, 버림 = 0, 모름 = 0;
const 버린말 = [], 고친예 = [];
const 남길 = [];
for (const g of pack.groups) {
  for (const w of g.words) {
    if (사람것.has(w[0])) { 남길.push(w); continue; }
    const v = 판정.get(w[0]);
    if (!v) { 모름++; 남길.push(w); continue; }
    if (v.답 === '버림') { 버림++; 버린말.push(w[0]); continue; }
    if (v.답 === '고침' && 성한가(w[0], v.clue)) {
      고친예.push([w[0], w[1], v.clue]);
      w[1] = v.clue; 고침++; 남길.push(w); continue;
    }
    if (v.답 === '고침') { 버림++; 버린말.push(w[0]); continue; }   // 고쳐 준 것이 규칙에 어긋나면 뺀다
    맞음++; 남길.push(w);
  }
}
pack.groups = [{ name: pack.groups[0].name, words: 남길 }];

console.error(`\n맞음 ${맞음} · 고침 ${고침} · 버림 ${버림} · 판정 못 받음 ${모름}`);
console.error(`입력 ${입력토큰} / 출력 ${출력토큰} 토큰 = 약 ${Math.round((입력토큰 / 1e6 * 1 + 출력토큰 / 1e6 * 5) * 1400)}원`);
console.error('\n고친 보기:');
for (const [w, o, n] of 고친예.slice(0, 12)) console.error(`  ${w}\n    전: ${o}\n    후: ${n}`);
if (버린말.length) console.error(`\n버린 낱말 ${버린말.length}개: ${버린말.slice(0, 40).join(' ')}`);

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
