/* 로봇 단어장의 예문. 스터디 자료(PDF 에서 뽑은 글, tools/robot-src/*.txt)에서 그 말이 쓰인 문장을
   낱말마다 둘까지 골라 정답을 ㅇㅇㅇ 으로 가리고 단어장에 남긴다(pack.예문). 화면은 시사 단어장과
   같은 자리(힌트 밑, 작은 글씨)에 보여 준다. 기사 번호·날짜·제목은 없다 — 문장만.

   node tools/robot-examples.mjs [--쓰기]

   ■ 고르는 법 (tools/sisain-examples.mjs 와 같은 잣대)
   - 그 말이 든 문장. 바로 앞에 한글이 붙은 것은 그 말이 아니다(«협동로봇» 의 «로봇»).
     띄어 쓴 꼴(«협동 로봇»)도 그 말로 친다.
   - 정답을 가린 뒤에도 정답 조각이 남는 문장은 쓰지 않는다.
   - 사람이 다치거나 숨진 일이 든 문장은 쓰지 않는다.
   - 너무 짧은 문장은 버리고, 긴 문장은 그 말 둘레만 남긴다. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--쓰기');
const 개수 = 2, 최대길이 = 70, 최소길이 = 18;

const file = path.join(root, 'packs/robot.json');
const 원문 = fs.readFileSync(file, 'utf8');
const pack = JSON.parse(원문);
const 낱말 = pack.groups.flatMap(g => g.words.map(w => w[0]));

/* ── 자료 글을 문장으로 ── */
/* PDF 는 줄을 낱말 가운데서도 끊고, 줄 끝의 빈칸은 사라진다. 그래서 두 줄을 이을 때 붙일지 띄울지를 정해야 한다.
   재 보니 반반이었다. 앞줄 끝 토막이 한 글자(«…AI 인» + «재를»)거나 뒷줄 첫 토막이 한 글자(«…HL만» + «도 '골리'»)면
   낱말 가운데서 끊긴 것이고, 단어장의 낱말이 그 자리에 걸쳐 있으면(«현대로» + «템») 역시 붙인다. 나머지는 띄운다 */
// 단어장에 없지만 자료에서 줄 끝에 자주 걸리는 말
const 걸친말 = ['서비스', '레퍼런스', '시나리오', '컨소시엄', '소프트뱅크', '플랫폼', '인프라', '엘리베이터'];
const 홑말 = new Set('약 이 그 등 및 또 새 첫 각 총 뒤 앞 곳 더 덜 잘 못 안 위 밑 옆 곧 늘 꼭 즉 단 때 것 수 중 그 저 두 세 네'.split(' '));
function 이음(a, b) {
  if (!/[가-힣]$/.test(a) || !/^[가-힣]/.test(b)) return a + ' ' + b;
  const 앞토막 = a.match(/[가-힣0-9]+$/)[0], 뒤토막 = b.match(/^[가-힣]+/)[0];   // «24개» 는 세 글자짜리 토막
  const 자리 = a.slice(-8) + b.slice(0, 8);
  if ([...낱말, ...걸친말].some(w => w.length >= 3 && 자리.includes(w) && !a.slice(-8).includes(w) && !b.slice(0, 8).includes(w))) return a + b;
  // 한 글자 토막이라도 «약 170대» 의 «약», «등» 처럼 홀로 서는 말이면 낱말 가운데가 아니다
  if ((앞토막.length <= 1 && !홑말.has(앞토막)) || (뒤토막.length <= 1 && !홑말.has(뒤토막))) return a + b;
  return a + ' ' + b;
}

const 군더더기 = /^(로봇 스터디 (마스터 문서|2차 발제 자료)|\d+|[①-⑳㉑-㉟]+|출처 \S+|시점|회사·기관|내용|매체|분야|누가|무엇을 문제 삼았나|본문|용어|뜻|등장 시기)$/;
// 소제목은 문장이 아니다 — «1985, 델타 로봇 — 병렬 기구의 등장 누가·왜» 처럼 짧고 마침표 없이 끝나며 육하원칙 꼬리가 붙는다
const 소제목 = s => s.length <= 70 && !/[.!?]$/.test(s) && /(누가|무엇을|언제|어디서|어떻게|왜|얼마나|얼마)(·(누가|무엇을|언제|어디서|어떻게|왜|얼마나|얼마))*$/.test(s);
// 문장 꼴인가 — 마침표로 끝나거나, «…내세움» «…겨냥» 처럼 ㅁ 받침 명사꼴·서술형으로 끝난다
const 문장꼴 = s => !(/ — /.test(s) && s.length < 50 && !/[.!?]$/.test(s)) && (/[.!?]$/.test(s) || /[다요죠]$/.test(s) || (/[가-힣]$/.test(s) && (s.charCodeAt(s.length - 1) - 0xac00) % 28 === 16)
  // 표의 «내용» 칸은 «…취지» «…겨냥» 처럼 명사로 끝난다. 서른 자 넘는 것만 문장으로 친다. «③ 손끝과 감각 : …» 같은 차례 줄은 뺀다
  || (s.length >= 30 && /[가-힣]$/.test(s) && !/ : /.test(s)));
function 문장들(글) {
  const out = [];
  for (const 덩이 of 글.split(/\n\s*\n/)) {
    const 줄 = 덩이.split('\n').map(s => s.trim()).filter(s => s && !군더더기.test(s));
    // 소제목 줄은 버리고, 그 앞뒤를 따로 잇는다
    const 묶음 = [[]];
    for (const l of 줄) { if (소제목(l)) { if (묶음[묶음.length - 1].length) 묶음.push([]); } else 묶음[묶음.length - 1].push(l); }
    for (const 줄들 of 묶음) {
      if (!줄들.length) continue;
      let s = 줄들[0];
      for (let i = 1; i < 줄들.length; i++) s = 이음(s, 줄들[i]);
      s = s.replace(/\s+/g, ' ').replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').trim();
      for (const t of s.split(/(?<=[.!?])\s+(?=[가-힣A-Z0-9«〈"'‘“(])/)) {
        const u = t.trim().replace(/^[①-⑳㉑-㉟]\s*/, '');
        if (u.length >= 최소길이 && u.length <= 260 && 문장꼴(u)) out.push(u);
      }
    }
  }
  return out;
}
/* 2차 발제는 표가 많다. «시점 · 회사·기관 · 내용 · 매체» 표는 읽는 순서대로 뽑으면 칸이 줄 단위로 섞인다.
   그래서 그 자료는 pdftotext -layout 으로 뽑고(*.layout.txt), 칸 자리로 «내용» 칸만 이어 붙인다.
   한글은 두 칸 너비라 자리가 조금씩 밀리지만, 칸 사이가 멀어 가장 가까운 칸으로 붙이면 된다 */
function 표문장들(글) {
  const out = [];
  let 칸 = null;   // [시점, 회사, 내용, 매체] 의 시작 자리
  for (const 덩이 of 글.split(/\n\s*\n/)) {
    const 줄 = 덩이.split('\n').filter(l => l.trim());
    if (!줄.length) continue;
    const 머리 = 줄.find(l => /^\s*시점\s+회사·기관\s+내용\s+매체\s*$/.test(l));
    if (머리) { 칸 = ['시점', '회사·기관', '내용', '매체'].map(h => 머리.indexOf(h)); continue; }
    if (칸 && /^\s*\d{4}\.\d{2}/.test(줄[0])) {
      // 표의 한 줄(행). 조각마다 시작 자리로 어느 칸인지 정하고 «내용» 칸만 잇는다
      const 조각들 = [];
      for (const l of 줄) for (const m of l.matchAll(/\S(?:.*?\S)?(?=\s{3,}|\s*$)/g)) {
        const 자리 = m.index, 어느 = 칸.reduce((b, c, i) => Math.abs(c - 자리) < Math.abs(칸[b] - 자리) ? i : b, 0);
        if (어느 === 2) 조각들.push(m[0]);
      }
      if (!조각들.length) continue;
      let s = 조각들[0];
      for (let i = 1; i < 조각들.length; i++) s = 이음(s, 조각들[i]);
      out.push(...문장들(s));
      continue;
    }
    out.push(...문장들(덩이));
  }
  return out;
}
const 자료 = fs.readdirSync(path.join(root, 'tools/robot-src')).filter(f => f.endsWith('.txt')).sort()
  .flatMap(f => (f.endsWith('.layout.txt') ? 표문장들 : 문장들)(fs.readFileSync(path.join(root, 'tools/robot-src', f), 'utf8')));

/* ── 낱말 찾기·가리기 ── */
const 벗김 = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 뒤에는 토씨(은는이가을를의에과와도로부까으)나 기호·빈칸이 와야 한다. «부산항만공사» 의 «부산항» 은 그 말이 아니다
const 낱말꼴 = w => new RegExp('(?<![가-힣A-Za-z0-9])' + [...w].map(벗김).join('\\s?') + '(?![A-Za-z])(?=[은는이가을를의에과와도로부까으]|[^가-힣]|$)', 'g');
const 가림 = (글, w) => 글.replace(낱말꼴(w), 'ㅇ'.repeat(w.length));
function 조각샘(글, w) {
  const t = 글.replace(낱말꼴(w), '');
  const 최소 = w.length <= 4 ? 2 : 3;
  for (let n = w.length - 1; n >= 최소; n--)
    for (let i = 0; i + n <= w.length; i++) if (t.includes(w.slice(i, i + n))) return true;
  return false;
}
const 다친일 = /사망|숨지|숨진|숨졌|목숨|부상|다쳐|다친|다쳤|피해자|희생|참사|살해|살인|폭행|성폭|성범죄|자살|극단적 선택|유족|시신|중상|학대|추락|질식|익사|분신/;

function 다듬기(s, w) {
  if (s.length <= 최대길이) return s;
  const i = s.search(낱말꼴(w));
  const 앞 = Math.max(0, Math.min(i - 24, s.length - 최대길이));
  let t = s.slice(앞, 앞 + 최대길이);
  // 낱말 가운데서 자르지 않게 — 앞은 첫 띄어쓰기 뒤부터, 뒤는 마지막 띄어쓰기 앞까지
  if (앞 > 0) t = t.replace(/^\S*\s/, '');
  if (앞 + 최대길이 < s.length) t = t.replace(/\s\S*$/, '');
  return (앞 > 0 ? '…' : '') + t.trim() + (앞 + 최대길이 < s.length ? '…' : '');
}

// 그 말이 한 번만 든 문장, 그중 알맞은 길이(30~110자)부터, 같으면 짧은 것.
// 자료 자체를 가리키는 말(«스터디 명제», «3부 참조», «라인업», «출처»)이 든 문장은 밖에서 읽으면 낯설어 뒤로 미룬다
const 자료말 = /스터디|명제|참조|참고|출처|라인업|계보|항목|본 문서|아래 표|위 표|크로스체크|이 용어|이 말|한 줄에/;
// 3점 넘으면 아예 안 쓴다 — 자료를 가리키는 말, «…과 같은» 으로 시작하는 것, 서른 자가 안 되는 토막
const 점수 = (s, w) => (s.match(낱말꼴(w)).length === 1 ? 0 : 2) + (s.length < 30 ? 3 : s.length > 110 ? 1 : 0) + (자료말.test(s) ? 4 : 0)
  + (new RegExp('^' + 낱말꼴(w).source + '(과|와) 같은').test(s) ? 3 : 0);   // «서빙로봇과 같은 구도이며…» 는 그 말을 안 알려 준다
function 예문(w) {
  const 후보 = 자료.filter(s => 낱말꼴(w).test(s) && !조각샘(s, w) && !다친일.test(s) && 점수(s, w) < 3);
  // 같은 점수면 일흔 자 안팎을 먼저 — 제일 짧은 것은 «…의 출발점.» 처럼 토막말이기 쉽다
  후보.sort((a, b) => 점수(a, w) - 점수(b, w) || Math.abs(a.length - 70) - Math.abs(b.length - 70));
  const 고른 = [];
  for (const s of 후보) {
    const t = 가림(다듬기(s, w), w);
    // 표와 줄글에 같은 문장이 있다(«제조비의 60%를 차지하는 액추에이터는…»). 빈칸을 빼고 앞 스무 자가 같으면 같은 문장
    const 꼴 = x => x.replace(/\s+/g, '').slice(0, 20);
    if (고른.some(g => 꼴(g.예문) === 꼴(t))) continue;
    고른.push({ 예문: t });
    if (고른.length >= 개수) break;
  }
  return 고른;
}

/* ── 단어장에 쓰기 ── */
const 표 = {};
for (const w of 낱말) { const es = 예문(w); if (es.length) 표[w] = es; }

// --보기=낱말 : 그 낱말의 후보 문장을 점수와 함께 다 보여 준다 (왜 그 문장이 뽑혔는지 볼 때)
const 보기 = (process.argv.find(a => a.startsWith('--보기=')) || '').slice(5);
if (보기) {
  for (const s of 자료.filter(s => 낱말꼴(보기).test(s))) console.log(조각샘(s, 보기) ? '조각' : 다친일.test(s) ? '다침' : `${점수(s, 보기)}`.padStart(3), '|', s);
  process.exit(0);
}
const n = Object.keys(표).length;
console.log(`자료 문장 ${자료.length}개 · 낱말 ${낱말.length}개 중 예문 있는 것 ${n}개 (${Object.values(표).reduce((a, b) => a + b.length, 0)}문장)`);
if (!WRITE) { for (const w of Object.keys(표).slice(0, 12)) console.log(' ', w, '|', 표[w].map(e => e.예문).join(' | ')); process.exit(0); }

const 본 = '  "예문": {\n' + Object.entries(표).map(([w, es]) => `    ${JSON.stringify(w)}: ${JSON.stringify(es)}`).join(',\n') + '\n  },\n';
let s = 원문.replace(/  "예문": \{[\s\S]*?\n  \},\n(?=  "groups")/, '');
if (!/\n  "groups": \[/.test(s)) throw new Error('groups 를 못 찾음');
s = s.replace(/(\n)(  "groups": \[)/, `$1${본}$2`);
JSON.parse(s);
fs.writeFileSync(file, s);
console.log('packs/robot.json 에 썼다');
