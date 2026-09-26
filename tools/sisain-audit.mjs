/* 힌트를 기계가 직접 풀어 본다. 못 풀면 그 힌트가 잘못된 것이다.
   node tools/sisain-audit.mjs [챗봇 레포 경로] [--맛보기=40] [--쓰기]

   왜 이걸 만들었나.
   힌트를 기계가 쓰고 기계가 검사했는데, 그 검사가 «이 힌트 맞습니까?» 라고 묻는 식이었다.
   자기가 쓴 것을 자기가 보고 맞다고 하니 틀린 것이 그대로 남았다. 사람이 풀다가
   하나씩 걸러 냈다 — 중소기업, 원내대표, 당대표, 레이오프, 남방한계선. 그럴 일이 아니다.

   그래서 묻는 방식을 바꾼다. 정답을 가리고 «이 힌트가 가리키는 낱말은 무엇인가» 만 묻는다.
   못 맞히면 그 힌트로는 사람도 못 푼다. 맞히면 적어도 가리키기는 한다.
   답을 아는 채로 «맞습니까» 를 묻는 것과 달리, 이건 속일 수가 없다.

   푸는 쪽은 Sonnet 을 쓴다. Haiku 는 힌트를 쓴 당사자이기도 하고,
   사실을 가리는 데서 여러 번 틀렸다(«남방한계선 = 경기도 반도체 공장 띠»).

   두 가지를 함께 본다.
     ① 맞히나            힌트만 보고 그 낱말을 대는가 (세 번까지 후보를 받는다)
     ② 사실이 맞나        기사 대목을 함께 주고, 힌트에 사실과 어긋나는 데가 있는가

   --쓰기 를 붙이면 못 맞힌 힌트와 사실이 틀린 힌트를 packs/고칠힌트.txt 에 적는다.
   단어장은 건드리지 않는다 — 무엇을 어떻게 고칠지는 사람이 본다.
*/
import fs from 'fs';
import path from 'path';

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
const 원문 = arts.map(a => [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' '));
const pack = JSON.parse(fs.readFileSync('packs/news.json', 'utf8'));
const 낱말들 = pack.groups.flatMap(g => g.words);
const 할것 = 맛보기 ? 낱말들.slice(0, 맛보기) : 낱말들;

function 대목(w) {
  for (const t of 원문) {
    const i = t.indexOf(w);
    if (i >= 0) return t.slice(Math.max(0, i - 70), i + 80).replace(/\s+/g, ' ').trim();
  }
  return '';
}

/* ① 정답을 가리고 풀어 보게 한다 */
const 풀어보라 = (덩이) => `한국 시사 크로스워드의 열쇠다. 각 열쇠가 가리키는 낱말을 맞혀라.

답은 한글 세 글자에서 여덟 글자 사이의 시사 용어다. 열쇠마다 후보를 최대 세 개까지 댄다.
확실하지 않아도 가장 그럴듯한 것을 적는다. 모르겠으면 «모름» 이라고 적는다.

한 줄에 하나씩 "번호|후보1,후보2,후보3" 꼴로만 적는다. 다른 말은 쓰지 않는다.

${덩이.map((w, i) => `${i + 1}. ${w[1]}`).join('\n')}`;

/* ② 사실을 본다 */
const 사실보라 = (덩이) => `한국 시사 크로스워드의 낱말과 열쇠다. 열쇠에 사실과 어긋나는 데가 있는지 본다.

기사 대목을 함께 준다. 다만 기사에 없는 것도 네가 아는 상식으로 판단한다 —
«원내대표» 를 «의원들을 모아 주는 사람» 이라고 적었다면, 기사에 그 말이 없어도 틀린 것이다.

  맞음 — 뜻이 맞고 사실도 어긋나지 않는다
  틀림 — 뜻이 틀렸거나, 그 낱말과 상관없는 것을 적었거나, 사실이 어긋난다

한 줄에 하나씩 "낱말|맞음" 또는 "낱말|틀림|무엇이 틀렸는지 한 구절" 꼴로만 적는다.

${덩이.map(w => `[${w[0]}] ${w[1]}${대목(w[0]) ? `\n   기사: ${대목(w[0])}` : ''}`).join('\n\n')}`;

const 모델 = 'claude-sonnet-5';
const 묶음 = 15;
let 입력 = 0, 출력 = 0;
const 못맞힘 = [], 사실틀림 = [];

console.error(`힌트 ${할것.length}개를 검사한다 — ① 풀어 보기 ② 사실 보기\n`);

for (let i = 0; i < 할것.length; i += 묶음) {
  const 덩이 = 할것.slice(i, i + 묶음);

  const a = await 불러본다({ model: 모델, max_tokens: 4000, messages: [{ role: 'user', content: 풀어보라(덩이) }] });
  입력 += a.usage?.input_tokens || 0; 출력 += a.usage?.output_tokens || 0;
  const 답 = new Map();
  for (const line of (a.content || []).map(c => c.text || '').join('').split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s*[.|]\s*(.+?)\s*$/);
    if (m) 답.set(Number(m[1]), m[2].split(/[,·]/).map(s => s.trim().replace(/\s+/g, '')));
  }
  덩이.forEach((w, k) => {
    const 후보 = 답.get(k + 1) || [];
    if (!후보.includes(w[0])) 못맞힘.push([w[0], w[1], 후보.slice(0, 3).join(' / ') || '(답 없음)']);
  });

  const b = await 불러본다({ model: 모델, max_tokens: 4000, messages: [{ role: 'user', content: 사실보라(덩이) }] });
  입력 += b.usage?.input_tokens || 0; 출력 += b.usage?.output_tokens || 0;
  for (const line of (b.content || []).map(c => c.text || '').join('').split(/\r?\n/)) {
    const m = line.match(/^\s*([가-힣0-9]{2,12})\s*\|\s*틀림\s*\|?\s*(.*)$/);
    if (m) {
      const w = 할것.find(x => x[0] === m[1]);
      if (w) 사실틀림.push([m[1], w[1], m[2] || '']);
    }
  }
  process.stderr.write(`  검사 중 ${Math.min(i + 묶음, 할것.length)}/${할것.length} — 못 맞힘 ${못맞힘.length} · 사실 틀림 ${사실틀림.length}\r`);
}

const 값 = Math.round((입력 / 1e6 * 3 + 출력 / 1e6 * 15) * 1400);
console.error(`\n\n못 맞힌 힌트 ${못맞힘.length}개 (${Math.round(못맞힘.length / 할것.length * 100)}%) · 사실이 틀린 힌트 ${사실틀림.length}개`);
console.error(`입력 ${입력} / 출력 ${출력} 토큰 = 약 ${값}원\n`);

console.log('■ 못 맞힌 힌트 — 이 힌트로는 사람도 못 푼다 (낱말 / 힌트 / 기계가 댄 답)');
for (const [w, c, g] of 못맞힘.slice(0, 40)) console.log(`  ${w}\n    ${c}\n    → ${g}`);
console.log('\n■ 사실이 틀린 힌트');
for (const [w, c, why] of 사실틀림.slice(0, 40)) console.log(`  ${w}\n    ${c}\n    → ${why}`);

if (WRITE) {
  const 목록 = [...new Set([...못맞힘.map(r => r[0]), ...사실틀림.map(r => r[0])])];
  fs.writeFileSync('packs/고칠힌트.txt',
    '# 기계가 스스로 풀어 보고 못 풀었거나, 사실이 틀린 힌트. 사람이 보고 고친다.\n' +
    '# node tools/sisain-audit.mjs ../sisain-chatbot --쓰기 로 다시 만든다.\n\n' +
    목록.join('\n') + '\n', 'utf8');
  console.error(`→ packs/고칠힌트.txt 에 ${목록.length}개를 적었다`);
}
