/* 한 파일짜리 배포본을 만든다 — 아티팩트처럼 외부 파일을 못 가져오는 데 쓴다.
   node tools/bundle.mjs [나갈파일]                                        */
import fs from 'fs';
import { fileURLToPath } from 'url';
// pathname 을 그대로 쓰면 윈도에서 «/C:/...» 가 되어 C:\C:\... 를 찾는다
const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.argv[2] || root + 'crossword-bundle.html';

const html = fs.readFileSync(root + 'index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const title = head.match(/<title>([\s\S]*?)<\/title>/)[1];
const style = head.match(/<style>[\s\S]*?<\/style>/)[0];

const names = JSON.parse(fs.readFileSync(root + 'packs/index.json', 'utf8'));
const 날것 = names.map(n => JSON.parse(fs.readFileSync(root + 'packs/' + n, 'utf8')));
// 시사 단어장은 안전 도장이 찍힌 힌트만 싣는다 (game.js 의 도장거르기와 같은 잣대)
import { 도장키, 도장읽기 } from './lib-stamp.mjs';
const 도장 = 도장읽기();
const packs = 날것.map(p => p.id !== 'news' ? p : { ...p, groups: p.groups
  .map(g => ({ ...g, words: g.words.filter(w => 도장[도장키(w[0], w[1])]) }))
  .filter(g => g.words.length) }).filter(p => p.groups.length);

// src 에 붙은 ?v=… 는 캐시를 밀어내려고 단 것이라 파일 이름에서 떼고 읽는다
const inlined = body.replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
  `<script>\n${fs.readFileSync(root + src.split('?')[0], 'utf8')}\n</script>`);

// 아티팩트는 <!doctype>/<html>/<head>/<body> 를 스스로 씌우므로 알맹이만 낸다
fs.writeFileSync(out,
  `<title>${title}</title>\n${style}\n` +
  `<script>window.PACKS_INLINE = ${JSON.stringify(packs)};</script>\n` +
  inlined);

const kb = n => (n / 1024).toFixed(0) + 'KB';
console.log(`${out} — ${kb(fs.statSync(out).size)}, 단어장 ${packs.length}개 ` +
  `(${packs.reduce((n, p) => n + p.groups.reduce((m, g) => m + g.words.length, 0), 0)}단어)`);
