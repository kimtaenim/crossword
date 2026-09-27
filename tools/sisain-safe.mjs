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
import { 힌트규칙, 쓰기설정 } from './lib-hint.mjs';
import { 안전모듈, 품질모듈, 재료기사 } from './lib-safety.mjs';
import { 도장키, 도장읽기, 도장쓰기, 규칙판, 유효한가 } from './lib-stamp.mjs';
import { 판정물음 as 물음, 난이도물음, 난이도읽기 } from './lib-judge.mjs';
import { 살린말들 } from './lib-hint.mjs';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : path.join(process.cwd(), '..', 'sisain-chatbot');
const WRITE = process.argv.includes('--쓰기');
const 인자 = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const 맛보기 = Number(인자('맛보기') || 0);

const env = {};
try {
  for (const line of fs.readFileSync(path.join(repo, '.env.local'), 'utf8').split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
} catch (_) {}
const KEY = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 가 없습니다'); process.exit(1); }

/* 누설·길이 검사는 시사IN 챗봇 레포의 lib/quality.js 하나를 크로스워드와 퀴즈가 같이 쓴다.
   («재판소원» 힌트에 정답이 들어 있던 것과, 퀴즈에서 «쿠팡Inc» 를 «쿠팡…» 으로 물은 것이
   같은 흠이다. 규칙을 양쪽에 따로 적어 두면 한쪽만 고치고 다른 쪽은 잊는다.) */
const 품질 = 품질모듈(repo);

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

/* 공용 안전 모듈(챗봇 레포 lib/safety.js). 못 읽으면 여기서 멈춘다 — 안전 검사를 건너뛰고 돌지 않는다 */
const 안전 = 안전모듈(repo);
// 다시 쓸 때 붙여 주는 기사 대목도 범죄·참사가 중심인 기사에서는 가져오지 않는다
const arts = 재료기사(안전, JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8')));
const 원문 = arts.map(a => [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' '));
const packPath = 'packs/news.json';
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const 낱말들 = pack.groups.flatMap(g => g.words);
// 지금 규칙으로 도장을 받은 힌트는 다시 묻지 않는다(글도 규칙도 그대로이므로). --전부 면 모두 다시 본다.
// 규칙이 바뀌면 판이 바뀌어 모든 도장이 무효가 되고, 전부 다시 검사받는다.
const 판 = 규칙판(안전);
const 전부 = process.argv.includes('--전부');
const 대상 = 전부 ? 낱말들 : 낱말들.filter(w => !유효한가(도장읽기(), w[0], w[1], 판));
const 할것 = 맛보기 ? 대상.slice(0, 맛보기) : 대상;

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

const 다시쓰라 = (목록) => `시사 주간지 크로스워드의 열쇠를 다시 쓴다. 지금 열쇠에 나가면 안 되는 표현이 있다.

■ 지킬 것
- «문제» 에 적힌 것을 모두 고친다. 뜻을 바로잡고, 장면(누가·어디서 이 말을 쓰는지)을 하나 넣는다.
- 사람을 집단으로 묶어 규정하지 않는다. 한쪽 편을 들지 않는다.
- 기사에 나온 대목을 앞에 붙이지 않는다. 뜻을 장면으로 적는다 («[어디서 나왔나], [무엇인가]» 꼴 금지).
- 실제 사건·사고의 피해자나 가해자, 수사·재판 중인 사람의 이름을 쓰지 않는다.
  (이념·정책을 스스로 내건 널리 알려진 공인은 대표 예로 들 수 있다)
- 예순 자 안쪽. 정답이 통째로 들어가면 안 되고, 정답의 세 글자가 잇달아 들어가도 안 된다.
- 중학생이 소리 내어 읽고 알아들을 말로. «~하는 일», «~인 것», «~하는 곳», «~하는 돈» 으로 끝낸다.

한 줄에 하나씩 "낱말|다시 쓴 열쇠" 꼴로만 적는다.

${목록.map(x => `[${x.w[0]}] 지금 열쇠: ${x.w[1]}\n   문제: ${x.까닭}${대목(x.w[0]).map(e => `\n   기사: ${e}`).join('')}`).join('\n\n')}`;


const 성한가 = (w, clue) => {
  if (!clue || clue.length > 60 || clue.length < 6) return false;
  if (거친말.test(clue) || clue.includes(w)) return false;
  if (!안전.검사(clue).안전) return false;
  if (안전.곁가지(clue).붙음) return false;   // 고쳐 쓴 것에 곁가지를 되붙였으면 버린다
  if (품질 && 품질.누설(w, clue, { 봐주기: 품질.봐주는길이.크로스워드 }).샘) return false;
  if (!품질) for (let i = 0; i + 3 <= w.length; i++) if (clue.includes(w.slice(i, i + 3))) return false;
  return true;
};

/* 판정 모델. 쓰기도 Opus 5.5 라 지금은 같은 모델이 쓰고 판정한다(물음은 따로). SAFE_MODEL 로 바꿀 수 있다 */
const 판정모델 = process.env.SAFE_MODEL || 'claude-opus-5-5';
const 도장 = 도장읽기();
const 찍기 = (w, c) => { 도장[도장키(w, c)] = { 날: new Date().toISOString().slice(0, 10), 모델: 판정모델, 규칙판: 판 }; };
const 묶음 = 30;
let 입력 = 0, 출력 = 0;
const 걸린것 = [], 고친것 = [], 못고친것 = [], 어려운것 = [], 일반어 = [];
const 살린 = 살린말들();

console.error(`힌트 ${할것.length}개를 전수로 본다\n`);

for (let i = 0; i < 할것.length; i += 묶음) {
  const 덩이 = 할것.slice(i, i + 묶음);
  // 두 번 따로 묻는다 — 일반 잣대와 «피해자의 눈». 한 물음에 섞으면 피해자 잣대가 묻힌다
  // (돌려차기 힌트는 사실이고 비하도 없어서 일반 잣대를 그대로 지나갔다).
  const [j, jv, jd] = await Promise.all([
    불러본다({ model: 판정모델, max_tokens: 8000, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 물음(덩이) + '\n\n' + 안전.규칙글() }] }),
    불러본다({ model: 판정모델, max_tokens: 8000, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 안전.피해자물음(덩이.map(w => ({ 이름: w[0], 글: w[1] }))) }] }),
    불러본다({ model: 판정모델, max_tokens: 8000, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 난이도물음(덩이) }] }),
  ]);
  입력 += (j.usage?.input_tokens || 0) + (jv.usage?.input_tokens || 0) + (jd.usage?.input_tokens || 0);
  출력 += (j.usage?.output_tokens || 0) + (jv.usage?.output_tokens || 0) + (jd.usage?.output_tokens || 0);
  const 난이도 = 난이도읽기(글자(jd));

  const 판정 = new Map();
  // 공용 판정읽기를 쓴다. 전에는 한글·숫자 열두 자까지만 읽어서, 영문이 섞이거나 긴 낱말은 판정이 빠졌다
  for (const [이름, v] of 안전.판정읽기(글자(j))) 판정.set(이름.replace(/^\[|\]$/g, ''), v);
  const 피해판정 = 안전.판정읽기(글자(jv));
  for (const [이름, v] of 피해판정) {
    if (v.답 === '고칠것') 판정.set(이름, { 답: '고칠것', 까닭: `피해자의 눈: ${v.까닭 || '괴로운 글'}` });
  }

  const 고칠것 = [];
  for (const w of 덩이) {
    const v = 판정.get(w[0]);
    // 너무 어려운 말은 힌트를 고쳐도 소용없다 — 낱말째 뺀다 (살린말.txt 에 적힌 것은 둔다)
    if (난이도.get(w[0]) === '어려움' && !살린.has(w[0])) { 어려운것.push(w[0]); continue; }
    // 시사와 상관없는 보통 낱말도 뺀다 — 시사 단어장이 «공동체·플라스틱» 으로 채워지면 시사 퍼즐이 아니다
    if (난이도.get(w[0]) === '일반어' && !살린.has(w[0])) { 일반어.push(w[0]); continue; }
    // 기계로 먼저 턴다 — 거친 말, 특정 사건 이름(공용 목록), 뉴스 곁가지 꼴
    const 목록에걸림 = 거친말.test(w[1]) || !안전.검사(w[1]).안전 || 안전.곁가지(w[1]).붙음;
    if (목록에걸림 || v?.답 === '고칠것') {
      const 까닭 = 목록에걸림 ? '거친 말 목록에 걸림' : v.까닭;
      걸린것.push([w[0], w[1], 까닭]);
      고칠것.push({ w, 까닭 });
    } else if (v?.답 === '괜찮음' && 피해판정.get(w[0])?.답 === '괜찮음' && 난이도.has(w[0])) {
      찍기(w[0], w[1]);   // 세 물음(일반·피해자·난이도)에 모두 답을 받고 다 지났다. 하나라도 답이 빠지면 안 찍는다 — 다음에 다시 묻는다
    }
  }

  /* 고쳐 쓰기는 세 번까지 한다. 판정이 왜 걸었는지를 다음 번 쓰기에 그대로 넘긴다.
     (한 번만 쓰고 못 넘으면 낱말째 버리던 때, 721개 가운데 381개가 그렇게 사라졌다 —
     판정은 까다로운데 쓰는 쪽은 한 번뿐이었다.) 세 번 다 못 넘으면 버리지 않고
     도장 없이 단어장에 남긴다. 화면에는 안 나오고, 다음 실행에서 다시 쓴다. */
  let 남은 = 고칠것;
  for (let 차례 = 1; 차례 <= 3 && 남은.length; 차례++) {
    const k = await 불러본다({ ...쓰기설정, messages: [{ role: 'user', content: 다시쓰라(남은) + '\n\n' + 힌트규칙() + '\n\n' + 안전.규칙글() }] });
    입력 += k.usage?.input_tokens || 0; 출력 += k.usage?.output_tokens || 0;
    const 새것 = new Map();
    for (const line of 글자(k).split(/\r?\n/)) {
      const m = line.match(/^\s*\[?([가-힣A-Z0-9]{2,20})\]?\s*\|\s*(.+?)\s*$/);
      if (m) 새것.set(m[1], m[2]);
    }
    // 고쳐 쓴 것도 두 물음(일반 잣대, 피해자의 눈)을 처음부터 다시 거친다. 둘 다 «괜찮음» 이어야 받는다
    const 후보 = 남은.map(x => ({ 이름: x.w[0], 글: 새것.get(x.w[0]) || '' })).filter(x => x.글 && 성한가(x.이름, x.글));
    let 일반 = new Map(), 피해 = new Map();
    if (후보.length) {
      const [kg, kv] = await Promise.all([
        불러본다({ model: 판정모델, max_tokens: 8000, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 물음(후보.map(x => [x.이름, x.글])) + '\n\n' + 안전.규칙글() }] }),
        불러본다({ model: 판정모델, max_tokens: 8000, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 안전.피해자물음(후보) }] }),
      ]);
      입력 += (kg.usage?.input_tokens || 0) + (kv.usage?.input_tokens || 0);
      출력 += (kg.usage?.output_tokens || 0) + (kv.usage?.output_tokens || 0);
      일반 = 안전.판정읽기(글자(kg)); 피해 = 안전.판정읽기(글자(kv));
    }
    const 다음 = [];
    for (const x of 남은) {
      const n = 새것.get(x.w[0]);
      if (n && 성한가(x.w[0], n) && 일반.get(x.w[0])?.답 === '괜찮음' && 피해.get(x.w[0])?.답 === '괜찮음') {
        고친것.push([x.w[0], x.w[1], n]); x.w[1] = n; if (WRITE) 찍기(x.w[0], n);
      } else {
        const 까닭 = !n ? '다시 쓴 답이 없음'
          : !성한가(x.w[0], n) ? '길이·누설·금지어 기계 검사에 걸림 (예순 자 안쪽, 정답 세 글자 금지)'
          : (일반.get(x.w[0])?.까닭 || 피해.get(x.w[0])?.까닭 || '판정 답이 빠짐');
        다음.push({ w: x.w, 까닭: `${x.까닭} / ${차례}번째 고친 것 «${n || ''}» 도 걸림: ${까닭}` });
      }
    }
    남은 = 다음;
  }
  for (const x of 남은) 못고친것.push([x.w[0], x.w[1], x.까닭]);
  process.stderr.write(`  검사 ${Math.min(i + 묶음, 할것.length)}/${할것.length} — 걸린 것 ${걸린것.length} · 고친 것 ${고친것.length} · 못 고친 것 ${못고친것.length}\r`);
}

// 판정(opus 5.5: 입력 $4·출력 $20 /백만 토큰)이 대부분이라 그 값으로 어림한다
const 값 = Math.round((입력 / 1e6 * 4 + 출력 / 1e6 * 20) * 1400);
console.error(`\n\n걸린 것 ${걸린것.length} · 고친 것 ${고친것.length} · 못 고친 것(다음에 다시) ${못고친것.length} · 너무 어려워 뺄 것 ${어려운것.length}`);
if (어려운것.length) console.log('■ 너무 어려워 뺄 말\n  ' + 어려운것.join(' '));
if (일반어.length) console.log('■ 시사 용어가 아니라 뺄 말\n  ' + 일반어.join(' '));
console.error(`입력 ${입력} / 출력 ${출력} 토큰 = 약 ${값}원\n`);

console.log('■ 고친 것');
for (const [w, o, n] of 고친것) console.log(`  ${w}\n    전: ${o}\n    후: ${n}`);
console.log('\n■ 세 번 고쳐도 못 넘은 것 — 도장 없이 남겨 다음에 다시 쓴다');
for (const [w, c, why] of 못고친것) console.log(`  ${w} (${why})\n    ${c}`);

if (!WRITE) {
  // 미리보기에서도 걸리지 않은 힌트에는 도장을 찍는다(글이 그대로이므로). 걸린 것이 있으면 실패로 끝난다
  console.error(`도장 ${도장쓰기(도장, 낱말들, 판)}개 (packs/안전도장.json)`);
  console.error('\n미리보기만 했다. 실제로 고치려면 --쓰기 를 붙일 것.');
  process.exit(걸린것.length || 어려운것.length || 일반어.length ? 1 : 0);
}

// 못 고친 것은 빼지 않는다 — 도장 없이 남아 화면에는 안 나오고, 다음 실행에서 다시 쓴다
const 뺄이름 = new Set([...어려운것, ...일반어]);
pack.groups[0].words = pack.groups[0].words.filter(w => !뺄이름.has(w[0]));
const q = s => JSON.stringify(s);
const head = Object.keys(pack).filter(k => k !== 'groups')
  .map(k => `  ${q(k)}: ${JSON.stringify(pack[k])},`).join('\n');
const groups = pack.groups.map(g =>
  `    {\n      "name": ${q(g.name)},\n      "words": [\n` +
  g.words.map(w => '        [' + w.map(q).join(', ') + ']').join(',\n') + '\n      ]\n    }').join(',\n');
fs.writeFileSync(packPath, `{\n${head}\n  "groups": [\n${groups}\n  ]\n}\n`, 'utf8');
const 오늘 = new Date().toISOString().slice(0, 10);
if (일반어.length) fs.appendFileSync('packs/뺀말.txt',
  `\n# ${오늘} 시사 용어가 아닌 보통 낱말\n` + 일반어.join('\n') + '\n', 'utf8');
if (어려운것.length) fs.appendFileSync('packs/뺀말.txt',
  `\n# ${오늘} 너무 어려운 말 (보통 독자가 뜻을 짐작 못 함). 살리려면 살린말.txt 에 적는다\n` + 어려운것.join('\n') + '\n', 'utf8');
console.error(`→ ${packPath} 갱신 (낱말 ${pack.groups[0].words.length}개)`);
console.error(`도장 ${도장쓰기(도장, pack.groups.flatMap(g => g.words), 판)}개 (packs/안전도장.json) — 같이 커밋할 것`);
