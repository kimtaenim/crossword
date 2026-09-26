/* 공용 안전 모듈(시사IN 챗봇 레포 lib/safety.js)을 읽는다. 못 읽으면 멈춘다.
   전에는 못 읽어도 조용히 넘어갔다 — 그 사이 안전 검사 없이 힌트가 만들어지고 나갔다.
   크로스워드 도구는 힌트를 쓰거나 고치기 전에 반드시 이걸 거친다. */
import path from 'path';
import { createRequire } from 'module';

export function 안전모듈(repo) {
  const 경로 = path.resolve(repo, 'lib/safety.js');
  try {
    const m = createRequire(import.meta.url)(경로);
    for (const f of ['검사', '규칙글', '피해자물음', '판정읽기', '곁가지', '재료로써도되나']) {
      if (typeof m[f] !== 'function') throw new Error(`${f} 가 없음 — 챗봇 레포를 최신으로 받을 것`);
    }
    return m;
  } catch (e) {
    console.error(`\n안전 모듈을 못 읽었습니다: ${경로}\n  ${e.message}\n안전 검사 없이 힌트를 만들거나 내보내지 않습니다. 챗봇 레포 경로를 확인하세요.\n`);
    process.exit(1);
  }
}

/** 문제·힌트의 재료로 써도 되는 기사만 남긴다 (범죄·참사가 중심인 기사는 뺀다) */
export function 재료기사(안전, arts) {
  const 남김 = arts.filter(a => 안전.재료로써도되나(a).된다);
  if (남김.length < arts.length) console.error(`  재료에서 뺀 기사 ${arts.length - 남김.length}건 (범죄·참사 중심)`);
  return 남김;
}
