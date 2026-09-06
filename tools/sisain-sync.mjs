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
  .map(a => {
    const 원문 = [a.title, a.subtitle, a.summary, a.body].filter(Boolean).join(' ');
    return {
      d: day(a.date),
      원문,                                   // 낱말 경계를 볼 때 쓴다
      붙인: 원문.replace(/\s+/g, ''),         // 낱말을 셀 때 쓴다 (띄어쓰기 차이를 없앤다)
    };
  })
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
const 묵은 = [];   // 낱말도 그 줄기도 기사에 없는 말
const 딴꼴 = [];   // 낱말 그대로는 없는데 줄기는 자주 나오는 말 — 형태가 기사와 다르다

/**
 * 이상 검사: 0회로 나온 낱말이 정말 안 쓰이는 것인지, 꼴만 다른 것인지 가른다.
 * '고령화사회' 는 기사에 없지만 '고령화' 는 17건에 나온다. 그건 묵은 말이 아니라
 * 기사가 쓰지 않는 꼴로 적힌 말이다 — 낱말을 고쳐야지 빼면 안 된다.
 * 앞뒤 토막을 두 글자까지 잘라 보며 가장 많이 나오는 것을 찾는다.
 */
const 줄기최소 = 5;                       // 이보다 적게 나오면 잘린 토막일 뿐이다 ('이상기' 3건)
const 앞토막상한 = 글.length * 0.2;       // 기사 다섯 건에 한 번 넘게 나오면 뜻을 못 가리는 말
const 뒤토막상한 = 글.length * 0.1;       // 뒤토막은 일반명사가 많아 더 엄하게 ('효과' 182건은 탈락)
const 조사 = /[이가은는을를의에도만과와로]$/;

/** 낱말 경계에서 시작한 적이 있는가. 띄어쓰기를 살린 원문으로 본다.
    '업윤리' 는 늘 '직업윤리' 속에만 있어서 경계에서 시작하는 일이 없다 */
const 경계에서 = part => {
  const re = new RegExp('(^|[^가-힣])' + part);
  return 글.some(a => re.test(a.원문));
};

function 줄기찾기(word) {
  // 한국어 합성어는 앞토막이 뜻을 지고 뒤는 일반명사다.
  // 고령화+사회, 난민+문제, 해수면+상승 — 그러니 앞토막을 먼저, 긴 것부터 본다.
  const 쓸만한 = (part, 상한) => {
    if (조사.test(part) && part.length > 2) return null;   // '공약이' — 조사가 붙은 채 잘린 토막
    const n = 센다(part, 글);
    if (n < 줄기최소 || n > 상한) return null;
    if (!경계에서(part)) return null;
    return { part, n };
  };
  for (let len = word.length - 1; len >= 2; len--) {
    const hit = 쓸만한(word.slice(0, len), 앞토막상한);
    if (hit) return hit;
  }
  for (let len = word.length - 1; len >= 2; len--) {
    const hit = 쓸만한(word.slice(word.length - len), 뒤토막상한);
    if (hit) return hit;
  }
  return null;
}

for (const g of pack.groups) {
  for (const w of g.words) {
    let 요즘수 = 센다(w[0], 최근글);
    const 전체수 = 센다(w[0], 글);
    let 줄기로 = null;
    if (전체수 === 0) {
      const 줄기 = 줄기찾기(w[0]);
      if (줄기) {
        // 낱말 그대로는 없어도 줄기가 요즘 나오면 요즘 말로 친다 — 후하게.
        // '이상기후' 는 '기후' 로, '공약이행' 은 '공약' 으로 센다.
        딴꼴.push(`${w[0]} → ${줄기.part}(${줄기.n})`);
        요즘수 = 센다(줄기.part, 최근글);
        줄기로 = 줄기.part;
      } else {
        묵은.push(w[0]);
      }
    }

    const 표시중 = w[3] === '요즘';

    if (요즘수 >= MIN_RECENT) {
      w[3] = '요즘';
      w[4] = 오늘;
      (표시중 ? 갱신 : 올림).push(`${w[0]}(${요즘수}${줄기로 ? '·' + 줄기로 : ''})`);
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
줄('꼴이 기사와 다른 말 — 빼지 말고 낱말을 고칠 것 (낱말 → 기사가 쓰는 토막)', 딴꼴);
줄('낱말도 줄기도 기사에 없는 말 — 뺄지 둘지는 사람이 정한다', 묵은);

/** 지금 파일 모양 그대로 쓴다 — 낱말 한 줄에 하나, 들여쓰기 2칸 */
function serialize(p) {
  const q = s => JSON.stringify(s);
  // groups 만 빼고 위쪽 키는 전부 그대로 옮긴다 — theme·deco 같은 것을 --write 가 지워 버리면 안 된다
  const head = Object.keys(p)
    .filter(k => k !== 'groups')
    .map(k => `  ${q(k)}: ${JSON.stringify(p[k])},`).join('\n');
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
