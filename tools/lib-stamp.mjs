/* 안전 도장. 모델 검사(sisain-safe)를 지난 힌트에만 찍힌다.

   ■ 왜
   모델 검사는 «누가 돌리면» 도는 것이었다. 안 돌려도 힌트는 main 에 올라가고 그대로 배포됐다.
   시럽급여·빨갱이·돌려차기·«급진 세력» 이 다 그렇게 나갔다.
   이제 도장은 낱말과 힌트 글 그대로에 찍힌다. 힌트를 한 글자라도 고치면 도장이 사라지고,
   check-clues 가 «모델 검사를 아직 안 거침» 으로 실패하며, 실패하면 배포가 안 된다.
   손으로 고친 힌트도 예외가 없다. */
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const 곳 = fileURLToPath(new URL('../packs/안전도장.json', import.meta.url));

export const 도장키 = (낱말, 힌트) =>
  crypto.createHash('sha256').update(`${낱말}\t${힌트}`).digest('hex').slice(0, 20);

export function 도장읽기() {
  try { return JSON.parse(fs.readFileSync(곳, 'utf8')); } catch (_) { return {}; }
}

/** 지금 있는 힌트에 대한 도장만 남기고 새 도장을 더해 쓴다 */
export function 도장쓰기(도장, 지금힌트들) {
  const 남길 = new Set(지금힌트들.map(([w, c]) => 도장키(w, c)));
  const out = {};
  for (const k of Object.keys(도장).sort()) if (남길.has(k)) out[k] = 도장[k];
  fs.writeFileSync(곳, JSON.stringify(out, null, 0).replace(/,"/g, ',\n"') + '\n', 'utf8');
  return Object.keys(out).length;
}
