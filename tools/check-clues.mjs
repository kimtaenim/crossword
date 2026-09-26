/* 힌트 점검 — 정답이 새거나, 너무 길거나, 겹치는 힌트를 잡아낸다.
   node tools/check-clues.mjs */
import fs from 'fs';
import { createRequire } from 'module';

/* 4겹: 내보내기 직전. 안전 검사에 걸리면 여기서 실패한다 —
   묶음(bundle)도 배포도 이 검사를 지나야 한다. 사람이 «검사를 돌리는» 데 기대지 않는다.
   목록은 시사IN 챗봇 레포의 lib/safety.js 하나를 크로스워드와 퀴즈가 같이 쓴다. */
const 챗봇 = process.env.CHATBOT || '../sisain-chatbot';
let 안전 = null, 품질 = null;
try { 품질 = createRequire(import.meta.url)(챗봇 + '/lib/quality.js'); } catch (_) {}
try { 안전 = createRequire(import.meta.url)(챗봇 + '/lib/safety.js'); }
catch (_) { console.log(`※ 안전 목록을 못 읽었습니다(${챗봇}/lib/safety.js). CHATBOT= 으로 경로를 주세요.
`); }
import { fileURLToPath } from 'url';
// pathname 을 그대로 쓰면 윈도에서 «/C:/...» 가 되어 못 찾는다
const dir = fileURLToPath(new URL('../packs/', import.meta.url));
const names = JSON.parse(fs.readFileSync(dir + 'index.json', 'utf8'));
global.window = { PACKS: names.map(n => JSON.parse(fs.readFileSync(dir + n, 'utf8'))) };

// 힌트에 «언제 어디서 나온 말인가» 를 붙이면서 두 토막이 됐다 —
// [어디서 나왔나] + [무엇인가]. 마흔여섯 자로는 두 토막이 안 들어간다.
// 힌트 줄은 넘치면 스스로 스크롤되므로 예순 자까지 받는다.
const MAXLEN = 60;
let bad = 0, n = 0;
const seen = new Map();
// 일부러 정답의 한 조각을 힌트에 두는 것 — 상표 이름이 곧 실마리인 경우
const ALLOW = { '레고마인드스톰': ['레고'], '소프트웨어': ['웨어'], '하드웨어': ['웨어'], '롯데글로벌로지스': ['롯데'] };   // 서로 반대말로 짚어 준다

for (const pack of window.PACKS) {
  for (const g of pack.groups) {
    for (const [word, clue] of g.words) {
      n++;
      const say = m => { console.log(`  [${pack.id}/${g.name}] ${word}: ${m}\n     ${clue}`); bad++; };
      // 칠 수 있는 글자는 한글 음절, 대문자 영문, 숫자뿐이다 (자판은 칸마다 갈린다)
      if (/[^가-힣A-Z0-9]/.test(word)) say('칠 수 없는 글자가 있음 (한글·대문자·숫자만)');
      // 정답이 그대로 들어 있나
      if (clue.includes(word)) say('힌트에 정답이 그대로 들어 있음');
      // 누설은 공용 모듈이 본다(있으면). 잣대를 크로스워드와 퀴즈가 같이 쓴다
      if (안전 && 품질) {
        const r = 품질.누설(word, clue, { 봐주기: 품질.봐주는길이.크로스워드 });
        if (r.샘 && !(ALLOW[word] || []).includes(r.어디)) say(`정답의 "${r.어디}" 가 그대로 노출됨`);
      }
      // 공용 모듈을 못 읽었을 때만 제 나름대로 본다.
      // 정답의 세 음절 이상이 붙어서 들어 있나.
      // 두 음절까지는 봐준다 — «유럽연합» 힌트에 «유럽» 도 못 쓰면 «큰 대륙의 모임» 같은
      // 두루뭉술한 말밖에 안 남는다. 그렇게 어려워진 낱말을 여럿 뺐다. 사람이 정한 선이다.
      if (!품질) for (let i = 0; i + 3 <= word.length; i++) {
        const bit = word.slice(i, i + 3);
        if ((ALLOW[word] || []).includes(bit)) continue;
        if (clue.includes(bit)) { say(`정답의 "${bit}" 가 그대로 노출됨`); break; }
      }
      if (안전) {
        const r = 안전.검사(`${word} ${clue}`);
        if (!r.안전) say(`나가면 안 되는 말: ${r.걸린말.join(', ')}`);
      }
      if (clue.length > MAXLEN) say(`힌트가 김 (${clue.length}자, ${MAXLEN}자 넘음)`);
      if (clue.length < 6) say('힌트가 너무 짧음');
      if (seen.has(clue)) say(`"${seen.get(clue)}" 와 힌트가 똑같음`);
      seen.set(clue, word);
    }
  }
}
console.log(bad ? `\n힌트 ${n}개 중 문제 ${bad}건` : `힌트 ${n}개 — 문제 없음`);
process.exit(bad ? 1 : 0);
