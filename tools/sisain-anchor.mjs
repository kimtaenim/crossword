/* 힌트에 «언제 어디서 나온 말인가» 를 붙인다.
   node tools/sisain-anchor.mjs [챗봇 레포 경로] [--사람것=목록.txt] [--맛보기=12] [--쓰기]

   이건 시사 크로스워드다. 그런데 힌트가 사전처럼 뜻만 적고 있었다 —
   «대형마트가 전통시장을 짓누르지 못하도록 영업 요일을 정해 주는 법». 맞는 말이지만
   이걸 읽고 일곱 글자를 떠올릴 사람은 없다. 뜻을 아는 것과 이름을 떠올리는 것은 다른 일이다.

   시사 낱말을 떠올리게 하는 것은 «그 말이 어디서 나왔는가» 다.
   대형마트 새벽배송 다툼이 떠오르면 그 법 이름도 따라온다.
   그래서 힌트를 두 토막으로 짓는다.

     [어디서 나왔나] + [무엇인가]
     «8월 대형마트 새벽배송 다툼에서 도마에 오른, 마트 문 닫는 날을 정한 법»

   기사의 날짜와 제목을 함께 주고, 그 기사에서 이 말이 왜 나왔는지를 앞에 놓게 한다.
   기사에 근거가 없으면 뜻만 남긴다 — 지어낸 맥락은 없느니만 못하다.

   --맛보기=N 이면 N 개만 해 보고 보여 준다. --쓰기 가 없으면 고치지 않는다.
*/
import fs from 'fs';
import path from 'path';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : path.join(process.cwd(), '..', 'sisain-chatbot');
const WRITE = process.argv.includes('--쓰기');
const 인자 = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const 맛보기 = Number(인자('맛보기') || 0);

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
const packPath = 'packs/news.json';
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));

/* 사람이 손댄 힌트는 기계가 다시 쓰지 않는다. 목록을 단어장 옆에 둔다 —
   여기 적어 두지 않으면 다음에 돌릴 때 사람 손질이 덮인다. 실제로 그렇게 덮은 적이 있다. */
const 사람것경로 = 인자('사람것') || 'packs/손댄힌트.txt';
let 사람것 = new Set();
try {
  사람것 = new Set(fs.readFileSync(사람것경로, 'utf8').split(/\r?\n/)
    .map(l => l.trim()).filter(l => l && !l.startsWith('#')));
} catch (_) {}

/* 언제 붙였고, 그때 본 가장 최근 기사가 언제 것인가.
   맥락은 기사에서 오므로 새 기사가 생긴 낱말만 다시 붙이면 된다. */
const 내력경로 = 'packs/힌트내력.json';
let 내력 = {};
try { 내력 = JSON.parse(fs.readFileSync(내력경로, 'utf8')); } catch (_) {}
const 전부 = process.argv.includes('--전부');
const 오늘 = new Date().toISOString().slice(0, 10);

const day = d => (d || '').slice(0, 10).replace(/\./g, '-');
const 글 = arts.map(a => ({
  d: day(a.date),
  제목: a.title || '',
  본문: [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' '),
})).filter(a => a.d).sort((a, b) => b.d.localeCompare(a.d));

/** 그 말이 나온 가장 최근 기사 둘 — 날짜·제목과 그 말 둘레 */
function 나온데(w) {
  const out = [];
  for (const a of 글) {
    const i = a.본문.indexOf(w);
    if (i < 0) continue;
    out.push({ d: a.d, 제목: a.제목, 둘레: a.본문.slice(Math.max(0, i - 70), i + 80).replace(/\s+/g, ' ').trim() });
    if (out.length >= 2) break;
  }
  return out;
}

const 대상 = [];
let 그대로둠 = 0;
for (const g of pack.groups) for (const w of g.words) {
  if (사람것.has(w[0])) continue;
  const 자리 = 나온데(w[0]);
  if (!자리.length) continue;              // 기사에 없는 말은 맥락을 붙일 데가 없다
  // 지난번에 본 기사보다 새 기사가 없으면 고칠 까닭이 없다
  const 지난번 = 내력[w[0]]?.기사;
  if (!전부 && 지난번 && 자리[0].d <= 지난번) { 그대로둠++; continue; }
  대상.push({ w, 자리 });
}
const 할것 = 맛보기 ? 대상.slice(0, 맛보기) : 대상;
console.error(`맥락을 붙일 낱말 ${할것.length}개 (전체 ${대상.length}, 사람이 고친 ${사람것.size}개는 건너뛴다)`);

const 물음 = (덩이) => `시사 크로스워드 힌트를 고쳐 쓴다. 지금 힌트는 뜻만 적고 있어서, 읽어도 그 낱말이 떠오르지 않는다.

시사 낱말을 떠올리게 하는 것은 «그 말이 요즘 어디서 나왔는가» 다.
대형마트 새벽배송 다툼이 떠오르면 그 법 이름도 따라온다. 그래서 두 토막으로 짓는다.

  [어디서 나왔나] + [무엇인가]

보기
  전: 대형마트가 전통시장을 짓누르지 못하도록 영업 요일을 정해 주는 법
  후: 대형마트 새벽배송 다툼에서 도마에 오른, 마트 쉬는 날을 정한 법
  (뒤 토막 «마트 쉬는 날을 정한 법» 이 없으면 못 푼다. 그 토막을 지우지 않는다)

■ 지킬 것
- **뒤 토막(무엇인가)은 반드시 남긴다.** 맥락만 적으면 그 말을 모르는 사람은 영영 못 푼다.
  맥락은 떠올리게 돕는 것이지 뜻을 대신하지 않는다. 뜻만 있는 힌트는 되어도, 맥락만 있는 힌트는 안 된다.
- 앞 토막은 기사에 적힌 일에서만 가져온다. 기사에 없으면 지어내지 말고 뜻만 남긴다.
- **앞 토막은 웬만한 사람이 들어 봤을 일이라야 한다.** 그 기사에만 나오는 사람 이름,
  학교 이름, 사건 이름을 붙이면 오히려 더 막힌다 — 그럴 바에는 맥락 없이 뜻만 남긴다.
  (좋음: 대형마트 새벽배송 다툼, 경찰 개혁 논의, 폭염 / 나쁨: 조성현 대령, 배재고 야구부)
- 날짜는 «지난 8월», «올여름» 처럼 두루뭉술하게. 며칠까지 적지 않는다. 연도는 적지 않는다.
- 예순 자 안쪽. 두 토막을 쉼표로 잇는다.
- 정답이 통째로 들어가면 안 되고, 정답의 세 글자가 잇달아 들어가도 안 된다.
- 중학생이 소리 내어 읽고 알아들을 말로. 한자어를 늘어놓지 않는다.
- 거친 말(빨갱이 따위)은 기사에 있어도 옮기지 않는다.
- 맥락을 붙일 수 없으면 지금 힌트를 그대로 적는다. 억지로 붙이지 않는다.

한 줄에 하나씩 "낱말|고친 힌트" 꼴로만 적는다. 다른 말은 쓰지 않는다.

${덩이.map(({ w, 자리 }) => `[${w[0]}] 지금 힌트: ${w[1]}\n${자리.map(z => `  · (${z.d}) ${z.제목}\n    ${z.둘레}`).join('\n')}`).join('\n\n')}`;

const 거친말 = /빨갱이|종북|좌빨|수꼴|토착왜구|매국노|틀딱|급식충|맘충|김치녀|짱깨|쪽바리|병신|미친놈|벙어리|절름발이|장애자|불구자|창녀/;
/* 낯선 이름에 매단 맥락은 걸러 낸다.
   «웬만한 사람이 들어 봤을 일만 쓰라» 고 일러도 모델은 그 기사에만 나오는 이름을 붙인다 —
   조성현 대령, 장윤기 사건, 배재고 야구부. 그 이름을 모르면 맥락이 아니라 걸림돌이다.
   사람 판단에 맡기지 말고 세어서 가른다: 온톨로지에서 그 이름이 몇 건에 나왔는지 보고,
   드문 이름이 힌트에 들어 있으면 그 고침은 버린다(옛 힌트를 그대로 둔다). */
const onto = JSON.parse(fs.readFileSync(path.join(repo, 'data/ontology.json'), 'utf8')).articles || {};
const 이름빈도 = new Map();
for (const a of Object.values(onto)) {
  for (const e of new Set((a.entities || []).map(x => x.name))) {
    이름빈도.set(e, (이름빈도.get(e) || 0) + 1);
  }
}
const 널리알려진 = 8;      // 기사 여덟 건 넘게 나온 이름이라야 «들어 봤을» 이름으로 친다
const 드문이름들 = [...이름빈도].filter(([n, c]) => c < 널리알려진 && n.length >= 2).map(([n]) => n);
const 낯선이름 = (clue) => 드문이름들.some(n => clue.includes(n));

// 모델이 프롬프트의 규칙 문장을 힌트 자리에 그대로 옮겨 적은 적이 있다 — «기사에 없으면 뜻만 남김».
const 규칙따라적음 = /^(기사에 없으면|고칠 데 없음|고친 힌트 없음|뜻만 남김|그대로|없음|지금 힌트)/;
const 성한가 = (w, clue) => {
  if (규칙따라적음.test(clue.trim())) return false;
  if (낯선이름(clue)) return false;
  if (!clue || clue.length > 60 || clue.length < 6) return false;
  if (거친말.test(clue) || clue.includes(w)) return false;
  for (let i = 0; i + 3 <= w.length; i++) if (clue.includes(w.slice(i, i + 3))) return false;
  return true;
};

const 묶음크기 = 8;
const 새것 = new Map();
let 입력토큰 = 0, 출력토큰 = 0;

for (let i = 0; i < 할것.length; i += 묶음크기) {
  const 덩이 = 할것.slice(i, i + 묶음크기);
  const j = await 불러본다({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: 물음(덩이) }],
    });
  for (const line of (j.content || []).map(c => c.text || '').join('').split(/\r?\n/)) {
    const m = line.match(/^\s*([가-힣0-9]{2,12})\s*\|\s*(.+?)\s*$/);
    if (m) 새것.set(m[1], m[2]);
  }
  입력토큰 += (j.usage || {}).input_tokens || 0;
  출력토큰 += (j.usage || {}).output_tokens || 0;
  process.stderr.write(`  맥락 붙이는 중 ${Math.min(i + 묶음크기, 할것.length)}/${할것.length}\r`);
}

let 고침 = 0, 그대로 = 0;
const 보기 = [];
const 적을것 = [];
for (const { w, 자리 } of 할것) {
  const n = 새것.get(w[0]);
  if (n && n !== w[1] && 성한가(w[0], n)) { 보기.push([w[0], w[1], n]); w[1] = n; 고침++; }
  else 그대로++;
  // 고쳤든 그대로 뒀든, 이 기사까지는 봤다고 적어 둔다. 안 그러면 다음에 또 물어본다
  적을것.push([w[0], 자리[0].d]);
}

console.error(`\n맥락을 붙인 힌트 ${고침} · 그대로 둔 것 ${그대로}`);
console.error(`입력 ${입력토큰} / 출력 ${출력토큰} 토큰 = 약 ${Math.round((입력토큰 / 1e6 * 1 + 출력토큰 / 1e6 * 5) * 1400)}원\n`);
for (const [w, o, n] of 보기.slice(0, 20)) console.error(`■ ${w}\n   전: ${o}\n   후: ${n}`);

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
for (const [w, 기사] of 적을것) 내력[w] = { at: 오늘, 기사 };
fs.writeFileSync(내력경로, JSON.stringify(내력, null, 0).replace(/\},/g, '},\n '), 'utf8');
console.error(`→ ${packPath} 갱신 · ${내력경로} 에 ${적을것.length}개를 적었다`);
