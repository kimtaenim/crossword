/* 한 파일짜리 배포본을 만든다 — 아티팩트처럼 외부 파일을 못 가져오는 데 쓴다.
   node tools/bundle.mjs [나갈파일]                                        */
import fs from 'fs';
const root = new URL('../', import.meta.url).pathname;
const out = process.argv[2] || root + 'crossword-bundle.html';

const html = fs.readFileSync(root + 'index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const title = head.match(/<title>([\s\S]*?)<\/title>/)[1];
const style = head.match(/<style>[\s\S]*?<\/style>/)[0];

const names = JSON.parse(fs.readFileSync(root + 'packs/index.json', 'utf8'));
const packs = names.map(n => JSON.parse(fs.readFileSync(root + 'packs/' + n, 'utf8')));

const inlined = body.replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
  `<script>\n${fs.readFileSync(root + src, 'utf8')}\n</script>`);

// 아티팩트는 <!doctype>/<html>/<head>/<body> 를 스스로 씌우므로 알맹이만 낸다
fs.writeFileSync(out,
  `<title>${title}</title>\n${style}\n` +
  `<script>window.PACKS_INLINE = ${JSON.stringify(packs)};</script>\n` +
  inlined);

const kb = n => (n / 1024).toFixed(0) + 'KB';
console.log(`${out} — ${kb(fs.statSync(out).size)}, 단어장 ${packs.length}개 ` +
  `(${packs.reduce((n, p) => n + p.groups.reduce((m, g) => m + g.words.length, 0), 0)}단어)`);
