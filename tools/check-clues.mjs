/* 힌트 점검 — 정답이 새거나, 너무 길거나, 겹치는 힌트를 잡아낸다.
   node tools/check-clues.mjs */
import fs from 'fs';
const dir = new URL('../packs/', import.meta.url).pathname;
const names = JSON.parse(fs.readFileSync(dir + 'index.json', 'utf8'));
global.window = { PACKS: names.map(n => JSON.parse(fs.readFileSync(dir + n, 'utf8'))) };

const MAXLEN = 46;              // 힌트 줄이 두 줄을 넘지 않는 길이
let bad = 0, n = 0;
const seen = new Map();

for (const pack of window.PACKS) {
  for (const g of pack.groups) {
    for (const [word, clue] of g.words) {
      n++;
      const say = m => { console.log(`  [${pack.id}/${g.name}] ${word}: ${m}\n     ${clue}`); bad++; };
      // 정답이 그대로 들어 있나
      if (clue.includes(word)) say('힌트에 정답이 그대로 들어 있음');
      // 정답의 두 음절 이상이 붙어서 들어 있나
      for (let i = 0; i + 2 <= word.length; i++) {
        const bit = word.slice(i, i + 2);
        if (clue.includes(bit)) { say(`정답의 "${bit}" 가 그대로 노출됨`); break; }
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
