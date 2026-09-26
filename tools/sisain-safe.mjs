/* 안전 검사. 나가면 안 되는 힌트를 전수로 걸러 낸다.
   node tools/sisain-safe.mjs [챗봇 레포 경로] [--쓰기]

   ■ 왜
   «실업급여 — 일부에서 여성에게 주면 시럽급여라 부르는 것» 이 나갔다.
   여성 비하 표현을 낱말의 뜻인 것처럼 적었다. «대공수사권» 에는 «빨갱이» 가 들어 있었다.
   기사에 인용된 말을 기계가 그대로 옮긴 것인데, 매체 이름을 달고 나가는 물건에
   이런 것이 섞이면 낱말 하나 틀린 것과는 비교가 안 되는 일이 된다.

   ■ 무엇을 보나
   힌트와 낱말을 함께 놓고, 사람을 깎아내리거나 한쪽으로 기운 데가 있는지 본다.
     · 특정 집단을 비하하거나 조롱하는 말 (빨갱이, 시럽급여, 틀딱…)
     · 성별·나이·지역·출신·장애·성적지향으로 사람을 묶어 규정하는 말
     · 정치적으로 한쪽 편을 드는 서술. 어느 당이 옳다 그르다 하는 투
     · 인용이라 해도 따옴표 없이 옮겨 놓아 매체의 말처럼 읽히는 것
   걸린 것은 그 자리에서 다시 쓰게 한다. 못 고치면 낱말째 뺀다.

   ■ 잣대
   기계가 보기 전에 낱말 목록으로 먼저 턴다(아래 거친말). 목록에 없는 것도 모델이 잡는다.
   사람이 손댄 힌트도 검사한다 — 안전은 예외를 두지 않는다.
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
      process.stderr.write(`\n  다시 부른다 (${i + 1}/${횟수}) — ${String(e.message || e).slice(0, 60)}\n`);
      await new Promise(r => setTimeout(r, 쉬는시간[i] || 60000));
    }
  }
  throw 마지막;
}
const 글자 = j => (j.content || []).map(c => c.text || '').join('');

const arts = JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8'));
const 원문 = arts.map(a => [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' '));
const packPath = 'packs/news.json';
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const 낱말들 = pack.groups.flatMap(g => g.words);
const 할것 = 맛보기 ? 낱말들.slice(0, 맛보기) : 낱말들;

/** 목록으로 먼저 턴다. 여기 걸리면 모델에게 묻지 않고 바로 고쳐 쓴다 */
const 거친말 = /빨갱이|종북|좌빨|수꼴|토착왜구|매국노|틀딱|급식충|맘충|김치녀|한남충|짱깨|쪽바리|병신|미친놈|벙어리|절름발이|장애자|불구자|창녀|화냥|시럽급여|기생충같|떼쓰|밥그릇|철밥통/;

function 대목(w, 개수 = 2) {
  const out = [];
  for (const t of 원문) {
    const i = t.indexOf(w);
    if (i < 0) continue;
    out.push(t.slice(Math.max(0, i - 70), i + 80).replace(/\s+/g, ' ').trim());
    if (out.length >= 개수) break;
  }
  return out;
}

const 물음 = (덩이) => `시사 주간지가 내는 크로스워드의 열쇠다. 나가면 안 되는 것이 섞였는지 본다.

낱말 하나 틀린 것과는 다른 문제다. 매체 이름을 달고 나가는 물건이라, 아래 같은 것이 하나라도
섞이면 매체가 그렇게 말한 것이 된다.

■ 걸러야 하는 것
- 특정 집단을 비하하거나 조롱하는 말 (빨갱이, 시럽급여, 틀딱, 맘충 …)
- 성별·나이·지역·출신·장애·성적지향으로 사람을 묶어 규정하는 서술
  («청년 여성 노동자들의 공통점» 처럼 어떤 처지를 한 집단의 속성인 양 적는 것)
- 정치적으로 한쪽 편을 드는 서술. 어느 당이나 진영이 옳다 그르다 하는 투
- 기사에 인용된 험한 말을 따옴표 없이 옮겨, 매체가 하는 말처럼 읽히게 한 것
- 사람의 위상을 매기는 말 (전 지도자, 거물, 원로 …)

■ 걸러서는 안 되는 것
- 사실을 사실대로 적은 것. 비판적 사실도 사실이면 괜찮다
- 제도나 사건의 이름 자체 (내란·계엄·파업 같은 말은 그 자체로 문제가 아니다)

한 줄에 하나씩 "낱말|괜찮음" 또는 "낱말|고칠것|무엇이 문제인지 한 구절" 꼴로만 적는다.

${덩이.map(w => `[${w[0]}] ${w[1]}`).join('\n')}`;

const 다시쓰라 = (목록) => `시사 주간지 크로스워드의 열쇠를 다시 쓴다. 지금 열쇠에 나가면 안 되는 표현이 있다.

■ 지킬 것
- 문제가 된 표현을 빼고, 그 낱말이 무엇인지를 담담하게 적는다.
- 사람을 집단으로 묶어 규정하지 않는다. 한쪽 편을 들지 않는다.
- 그 말이 요즘 기사에 나온 대목이 있으면 앞에 짧게 붙인다. 없으면 뜻만 적는다.
- 예순 자 안쪽. 정답이 통째로 들어가면 안 되고, 정답의 세 글자가 잇달아 들어가도 안 된다.
- 중학생이 소리 내어 읽고 알아들을 말로. «~하는 일», «~인 것», «~하는 곳», «~하는 돈» 으로 끝낸다.

한 줄에 하나씩 "낱말|다시 쓴 열쇠" 꼴로만 적는다.

${목록.map(x => `[${x.w[0]}] 지금 열쇠: ${x.w[1]}\n   문제: ${x.까닭}${대목(x.w[0]).map(e => `\n   기사: ${e}`).join('')}`).join('\n\n')}`;

const 성한가 = (w, clue) => {
  if (!clue || clue.length > 60 || clue.length < 6) return false;
  if (거친말.test(clue) || clue.includes(w)) return false;
  for (let i = 0; i + 3 <= w.length; i++) if (clue.includes(w.slice(i, i + 3))) return false;
  return true;
};

const 모델 = 'claude-sonnet-5';
const 묶음 = 30;
let 입력 = 0, 출력 = 0;
const 걸린것 = [], 고친것 = [], 못고친것 = [];

console.error(`힌트 ${할것.length}개를 전수로 본다\n`);

for (let i = 0; i < 할것.length; i += 묶음) {
  const 덩이 = 할것.slice(i, i + 묶음);
  const j = await 불러본다({ model: 모델, max_tokens: 3000, messages: [{ role: 'user', content: 물음(덩이) }] });
  입력 += j.usage?.input_tokens || 0; 출력 += j.usage?.output_tokens || 0;

  const 판정 = new Map();
  for (const line of 글자(j).split(/\r?\n/)) {
    const m = line.match(/^\s*([가-힣0-9]{2,12})\s*\|\s*(괜찮음|고칠것)\s*\|?\s*(.*)$/);
    if (m) 판정.set(m[1], { 답: m[2], 까닭: m[3] || '' });
  }

  const 고칠것 = [];
  for (const w of 덩이) {
    const v = 판정.get(w[0]);
    const 목록에걸림 = 거친말.test(w[1]);
    if (목록에걸림 || v?.답 === '고칠것') {
      const 까닭 = 목록에걸림 ? '거친 말 목록에 걸림' : v.까닭;
      걸린것.push([w[0], w[1], 까닭]);
      고칠것.push({ w, 까닭 });
    }
  }

  if (고칠것.length) {
    const k = await 불러본다({ model: 모델, max_tokens: 3000, messages: [{ role: 'user', content: 다시쓰라(고칠것) }] });
    입력 += k.usage?.input_tokens || 0; 출력 += k.usage?.output_tokens || 0;
    const 새것 = new Map();
    for (const line of 글자(k).split(/\r?\n/)) {
      const m = line.match(/^\s*([가-힣0-9]{2,12})\s*\|\s*(.+?)\s*$/);
      if (m) 새것.set(m[1], m[2]);
    }
    for (const x of 고칠것) {
      const n = 새것.get(x.w[0]);
      if (n && 성한가(x.w[0], n)) { 고친것.push([x.w[0], x.w[1], n]); x.w[1] = n; }
      else 못고친것.push([x.w[0], x.w[1], x.까닭]);
    }
  }
  process.stderr.write(`  검사 ${Math.min(i + 묶음, 할것.length)}/${할것.length} — 걸린 것 ${걸린것.length} · 고친 것 ${고친것.length} · 못 고친 것 ${못고친것.length}\r`);
}

const 값 = Math.round((입력 / 1e6 * 3 + 출력 / 1e6 * 15) * 1400);
console.error(`\n\n걸린 것 ${걸린것.length} · 고친 것 ${고친것.length} · 못 고쳐 뺄 것 ${못고친것.length}`);
console.error(`입력 ${입력} / 출력 ${출력} 토큰 = 약 ${값}원\n`);

console.log('■ 고친 것');
for (const [w, o, n] of 고친것) console.log(`  ${w}\n    전: ${o}\n    후: ${n}`);
console.log('\n■ 못 고쳐 뺄 것');
for (const [w, c, why] of 못고친것) console.log(`  ${w} (${why})\n    ${c}`);

if (!WRITE) { console.error('\n미리보기만 했다. 실제로 고치려면 --쓰기 를 붙일 것.'); process.exit(0); }

const 뺄이름 = new Set(못고친것.map(r => r[0]));
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
    '\n# 안전 검사에 걸렸는데 고쳐 쓰지도 못한 말\n' + [...뺄이름].join('\n') + '\n', 'utf8');
}
console.error(`→ ${packPath} 갱신 (낱말 ${pack.groups[0].words.length}개)`);
