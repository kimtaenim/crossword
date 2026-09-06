/* 시사 단어장을 시사IN 기사 뭉치와 맞춘다.
   node tools/sisain-sync.mjs [챗봇 레포 경로] [--write]
                              (기본 ../sisain-chatbot, --write 없으면 미리보기만)

   사람이 쓴 것은 건드리지 않는다. 낱말(w[0]), 힌트(w[1]), 갈래(w[2]), 그룹 배치 모두 그대로다.
   이 도구가 손대는 칸은 뒤의 두 칸뿐이다.

     w[3] = '요즘'        게임이 이걸 보고 그 낱말을 먼저 깔아 준다 (game.js → FRESH)
     w[4] = '2026-09-06'  마지막으로 기사에 나온 것을 확인한 날

   «요즘» 은 굳는 표시가 아니라 도는 표시다.
     · 최근 기사에 MIN_RECENT 건 이상 나오면 → 표시를 붙이고 날짜를 오늘로 갱신
     · 안 나오는데 마지막 확인이 STALE_DAYS(4주) 를 넘겼으면 → 표시를 뗀다
     · 안 나와도 4주가 안 지났으면 → 그대로 둔다
   그래서 계속 나오는 말은 계속 요즘 말로 남고, 조용해진 말은 4주 뒤 저절로 빠진다.

   '오늘' 은 벽시계가 아니라 기사 뭉치의 마지막 날짜다. 같은 데이터로 다시 돌려도 결과가 안 흔들린다.

   요즘인지 아닌지는 기사에서 센다. 띄어쓰기는 지우고 맞춘다 —
   단어장의 "표현의자유" 가 기사에는 "표현의 자유" 로 나오기 때문이다.
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : path.join(process.cwd(), '..', 'sisain-chatbot');
const WRITE = process.argv.includes('--write');
const MIN_RECENT = Number(process.env.MIN_RECENT || 3);    // 최근 기사 몇 건에 나와야 «요즘» 인가
const STALE_DAYS = Number(process.env.STALE_DAYS || 28);   // 안 나온 채 이만큼 지나면 표시를 뗀다

const packDir = fileURLToPath(new URL('../packs/', import.meta.url));
const packPath = packDir + 'news.json';
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const arts = JSON.parse(fs.readFileSync(path.join(repo, 'data/articles.json'), 'utf8'));

const day = d => (d || '').slice(0, 10).replace(/\./g, '-');
const 글 = arts
  .map(a => ({
    d: day(a.date),
    붙인: [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' ').replace(/\s+/g, ''),
  }))
  .filter(a => a.d);

const 날짜 = 글.map(a => a.d).sort();
const 오늘 = 날짜[날짜.length - 1];                        // 기사 뭉치 기준의 오늘
const 요즘날 = 날짜[Math.floor(날짜.length * 0.75)];
const 최근글 = 글.filter(a => a.d >= 요즘날);
const 센다 = (w, 글들) => 글들.reduce((n, a) => n + (a.붙인.includes(w) ? 1 : 0), 0);
const 며칠전 = d => Math.round((new Date(오늘) - new Date(d)) / 86400000);

console.log(`기사 ${arts.length}건 (${날짜[0]} ~ ${오늘})`);
console.log(`요즘 = ${요즘날} 이후 ${최근글.length}건 · 기준 ${MIN_RECENT}건 이상 · 유효기간 ${STALE_DAYS}일\n`);

const 올림 = [];   // 표시를 새로 붙인 말
const 갱신 = [];   // 계속 나와서 날짜만 새로 찍은 말
const 유예 = [];   // 요즘 안 나오지만 아직 4주가 안 지난 말
const 내림 = [];   // 4주가 지나 표시를 뗀 말
const 묵은 = [];   // 전체 기사에 한 번도 안 나온 말

for (const g of pack.groups) {
  for (const w of g.words) {
    const 요즘수 = 센다(w[0], 최근글);
    const 전체수 = 센다(w[0], 글);
    if (전체수 === 0) 묵은.push(w[0]);

    const 표시중 = w[3] === '요즘';

    if (요즘수 >= MIN_RECENT) {
      w[3] = '요즘';
      w[4] = 오늘;
      (표시중 ? 갱신 : 올림).push(`${w[0]}(${요즘수})`);
      continue;
    }
    if (!표시중) continue;

    const 마지막 = w[4] || 오늘;          // 날짜가 없던 옛 표시는 오늘 확인한 것으로 친다
    const 지난 = 며칠전(마지막);
    if (지난 >= STALE_DAYS) { w.length = 3; 내림.push(`${w[0]}(${지난}일)`); }
    else { w[4] = 마지막; 유예.push(`${w[0]}(${STALE_DAYS - 지난}일 남음)`); }
  }
}

const 줄 = (제목, 목록) => {
  console.log(`■ ${제목} (${목록.length}개)`);
  console.log('  ' + (목록.join('  ') || '없음') + '\n');
};

줄('요즘 표시를 새로 붙인 말', 올림);
줄('계속 나와서 날짜를 갱신한 말', 갱신);
줄(`아직 유효기간이 남은 말 (${STALE_DAYS}일 안)`, 유예);
줄('유효기간이 지나 표시를 뗀 말', 내림);
줄('기사에 한 번도 안 나온 말 — 뺄지 둘지는 사람이 정한다', 묵은);

/** 지금 파일 모양 그대로 쓴다 — 낱말 한 줄에 하나, 들여쓰기 2칸 */
function serialize(p) {
  const q = s => JSON.stringify(s);
  const head = ['id', 'name', 'emoji', 'desc']
    .filter(k => p[k] !== undefined)
    .map(k => `  ${q(k)}: ${q(p[k])},`).join('\n');
  const groups = p.groups.map(g => {
    const words = g.words
      .map(w => '        [' + w.map(q).join(', ') + ']')
      .join(',\n');
    return `    {\n      "name": ${q(g.name)},\n      "words": [\n${words}\n      ]\n    }`;
  }).join(',\n');
  return `{\n${head}\n  "groups": [\n${groups}\n  ]\n}\n`;
}

if (WRITE) {
  fs.writeFileSync(packPath, serialize(pack), 'utf8');
  console.log(`→ ${packPath} 갱신`);
} else {
  console.log('미리보기만 했다. 실제로 고치려면 --write 를 붙일 것.');
}
