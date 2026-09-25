/* 거른 낱말에 힌트를 붙인다.
   cat 시사.txt | node tools/sisain-clue.mjs [챗봇 레포 경로] > 새말.json

   낱말 하나에 힌트 한 줄과 갈래 하나를 붙인다. 지어내지 않게, 그 말이 실제로 나온
   기사 대목을 함께 준다 — 없는 뜻을 만들어 붙이면 푸는 사람이 영영 못 맞힌다.

   힌트 규칙은 단어장이 이미 지키고 있는 것과 같다.
     · 마흔 자 안쪽. 힌트 줄이 두 줄을 넘으면 읽다 만다
     · 정답의 두 글자가 잇달아 들어가면 안 된다 (check-clues 가 다시 본다)
     · 뜻을 적는다. «언제 쓰는 말인가» 가 아니라 «무엇인가» 를 적는다
     · 장면이 보이게. 「제도」 보다 「누가 무엇을 하는 일」

   갈래는 단어장의 다섯 중 하나로 고른다.

   결과는 JSON 줄로 낸다. 사람이 훑어보고 packs/news.json 에 넣는다 —
   이 도구는 파일을 직접 고치지 않는다.
*/
import fs from 'fs';
import path from 'path';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : path.join(process.cwd(), '..', 'sisain-chatbot');

const env = {};
for (const line of fs.readFileSync(path.join(repo, '.env.local'), 'utf8').split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}
const KEY = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 가 없습니다'); process.exit(1); }

const arts = JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8'));
const 글 = arts.map(a => [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' '));
const 낱말 = fs.readFileSync(0, 'utf8').split(/\s+/).filter(w => /^[가-힣0-9]{3,8}$/.test(w));
if (!낱말.length) { console.error('힌트를 붙일 낱말을 표준입력으로 넘기세요'); process.exit(1); }

/** 그 말이 나온 대목을 몇 개 모은다 — 앞뒤 예순 자씩 */
function 대목(w, 개수 = 3) {
  const out = [];
  for (const t of 글) {
    const i = t.indexOf(w);
    if (i < 0) continue;
    out.push(t.slice(Math.max(0, i - 60), i + 70).replace(/\s+/g, ' ').trim());
    if (out.length >= 개수) break;
  }
  return out;
}

const 갈래 = ['경제와 금융', '정치와 미디어', '환경과 에너지', '사회와 복지', '국제와 안보'];

const 물음 = (덩이) => `시사 크로스워드에 실을 낱말에 힌트를 붙인다. 낱말마다 기사에서 그 말이 나온 대목을 함께 준다.

힌트 규칙
- 마흔 자 안쪽. 한 줄로 읽히게 짧게.
- 정답 글자를 힌트에 쓰지 않는다. 정답의 두 글자가 잇달아 들어가도 안 된다.
  («공시가격» 힌트에 «가격» 을 쓰면 안 된다)
- 그 말이 «무엇인가» 를 적는다. 언제 쓰는 말인지, 왜 중요한지를 적지 않는다.
- 사전 뜻풀이처럼 쓰지 않는다. «~하는 방식», «~하는 관계», «~적 영향력» 같은 맺음을 쓰지 않는다.
- 눈에 보이는 장면으로 적는다. 누가 무엇을 하는지, 어디서 무슨 일이 벌어지는지.
  «제도» 나 «체계» 라는 말로 뭉뚱그리지 않는다.
- 한자어를 늘어놓지 않는다. 중학생이 소리 내어 읽고 알아들을 말로 쓴다.
- 아는 사람이 옆에서 일러 주듯 쓴다. 한 가지 구체적인 것을 집어 준다 —
  숫자 하나, 그 말이 실제로 오르내린 자리 하나.
- 존댓말을 쓰지 않는다. «~하는 일», «~인 것», «~하는 곳», «~하는 돈» 으로 끝낸다.
- 기사 대목에 없는 사실을 지어내지 않는다. 확실하지 않으면 그 낱말은 건너뛴다.

갈래는 다음 다섯 중 하나를 고른다: ${갈래.join(' / ')}

한 줄에 하나씩 "낱말|갈래|힌트" 꼴로만 적는다. 다른 말은 쓰지 않는다.
뜻을 모르겠거나 힌트를 쓸 수 없는 낱말은 그 줄을 아예 적지 않는다.

${덩이.map(({ w, ex }) => `[${w}]\n${ex.map(e => '  · ' + e).join('\n')}`).join('\n\n')}`;

const 묶음크기 = 12;
const 결과 = [];
let 입력토큰 = 0, 출력토큰 = 0;

for (let i = 0; i < 낱말.length; i += 묶음크기) {
  const 덩이 = 낱말.slice(i, i + 묶음크기).map(w => ({ w, ex: 대목(w) })).filter(x => x.ex.length);
  if (!덩이.length) continue;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: 물음(덩이) }],
    }),
  });
  const j = await res.json();
  if (!res.ok) { console.error(JSON.stringify(j).slice(0, 300)); process.exit(1); }
  const text = (j.content || []).map(c => c.text || '').join('');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([가-힣0-9]{3,8})\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*$/);
    if (!m) continue;
    const [, w, k, clue] = m;
    if (!갈래.includes(k)) continue;
    if (!낱말.includes(w)) continue;
    결과.push([w, clue, k]);
  }
  입력토큰 += (j.usage || {}).input_tokens || 0;
  출력토큰 += (j.usage || {}).output_tokens || 0;
  process.stderr.write(`  힌트 붙이는 중 ${Math.min(i + 묶음크기, 낱말.length)}/${낱말.length}\r`);
}

/** 여기서 한 번 거른다 — 정답이 새거나 너무 길면 버린다. 사람이 다시 볼 것까지 줄인다 */
const 통과 = [], 버림 = [];
for (const [w, clue, k] of 결과) {
  if (clue.length > 46) { 버림.push([w, clue, '너무 김']); continue; }
  if (clue.length < 6) { 버림.push([w, clue, '너무 짧음']); continue; }
  let 샘 = false;
  for (let i = 0; i + 2 <= w.length; i++) if (clue.includes(w.slice(i, i + 2))) 샘 = true;
  if (샘 || clue.includes(w)) { 버림.push([w, clue, '정답이 샘']); continue; }
  통과.push([w, clue, k]);
}

console.log(JSON.stringify(통과, null, 0));
console.error(`\n붙인 것 ${통과.length}개 · 버린 것 ${버림.length}개`);
for (const [w, clue, 왜] of 버림) console.error(`  ${왜}: ${w} — ${clue}`);
console.error(`입력 ${입력토큰} / 출력 ${출력토큰} 토큰 = 약 ${Math.round((입력토큰 / 1e6 * 1 + 출력토큰 / 1e6 * 5) * 1400)}원`);
