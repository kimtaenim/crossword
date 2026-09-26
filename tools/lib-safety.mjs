/* 공용 안전 모듈(시사IN 챗봇 레포 lib/safety.js)을 읽는다. 못 읽으면 멈춘다.
   전에는 못 읽어도 조용히 넘어갔다 — 그 사이 안전 검사 없이 힌트가 만들어지고 나갔다.
   크로스워드 도구는 힌트를 쓰거나 고치기 전에 반드시 이걸 거친다.

   ■ 원본과 사본
   원본은 챗봇 레포 lib/safety.js · lib/quality.js 하나다. 챗봇 레포는 비공개라 GitHub 의 배포 검사
   (.github/workflows/deploy.yml)가 못 읽는다. 그래서 tools/공용/ 에 사본을 둔다.
   챗봇 레포가 곁에 있으면 늘 원본을 읽고, 사본이 다르면 그 자리에서 원본으로 덮어쓴다 —
   손으로 맞출 일이 없고, 사본이 뒤처진 채 커밋되면 배포 검사가 옛 규칙으로 도는 것만 남는다. */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const 사본곳 = fileURLToPath(new URL('./공용/', import.meta.url));
const 요구 = createRequire(import.meta.url);

/** 공용 모듈 하나를 읽는다. 챗봇 레포가 있으면 원본(사본을 맞춰 둔다), 없으면 사본 */
export function 공용(repo, 이름) {
  const 원본 = repo ? path.resolve(repo, 'lib', 이름) : '';
  const 사본 = path.join(사본곳, 이름);
  if (원본 && fs.existsSync(원본)) {
    const 글 = fs.readFileSync(원본, 'utf8');
    if (!fs.existsSync(사본) || fs.readFileSync(사본, 'utf8') !== 글) {
      fs.mkdirSync(사본곳, { recursive: true });
      fs.writeFileSync(사본, 글, 'utf8');
      console.error(`  공용 사본을 원본으로 맞춤: tools/공용/${이름} — 같이 커밋할 것`);
    }
    return 요구(원본);
  }
  return 요구(사본);
}

export function 안전모듈(repo) {
  try {
    const m = 공용(repo, 'safety.js');
    for (const f of ['검사', '규칙글', '피해자물음', '판정읽기', '곁가지', '재료로써도되나']) {
      if (typeof m[f] !== 'function') throw new Error(`${f} 가 없음 — 챗봇 레포를 최신으로 받을 것`);
    }
    return m;
  } catch (e) {
    console.error(`\n안전 모듈을 못 읽었습니다 (${repo || '사본'})\n  ${e.message}\n안전 검사 없이 힌트를 만들거나 내보내지 않습니다.\n`);
    process.exit(1);
  }
}

/** 누설·길이 잣대(lib/quality.js). 못 읽으면 null — 부르는 쪽이 제 나름의 잣대로 본다 */
export function 품질모듈(repo) {
  try { return 공용(repo, 'quality.js'); } catch (_) { return null; }
}

/** 문제·힌트의 재료로 써도 되는 기사만 남긴다 (범죄·참사가 중심인 기사는 뺀다) */
export function 재료기사(안전, arts) {
  const 남김 = arts.filter(a => 안전.재료로써도되나(a).된다);
  if (남김.length < arts.length) console.error(`  재료에서 뺀 기사 ${arts.length - 남김.length}건 (범죄·참사 중심)`);
  return 남김;
}
