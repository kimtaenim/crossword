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
import { 잣대글 } from './lib-judge.mjs';

const 곳 = fileURLToPath(new URL('../packs/안전도장.json', import.meta.url));

/** 안전 규칙의 판. 규칙(lib/safety.js 의 규칙글·피해자 물음, lib-judge.mjs 의 판정·난이도 물음)이 바뀌면 판이 바뀌고, 옛 판의 도장은 무효가 된다 —
    규칙을 조이면 이미 나간 힌트도 새 규칙으로 다시 검사받는다 */
export const 규칙판 = (안전) =>
  crypto.createHash('sha256').update(안전.규칙글() + '\n' + 안전.피해자물음([]) + '\n' + 잣대글()).digest('hex').slice(0, 12);

/** 이 도장이 지금 규칙으로 찍힌 것인가 */
export const 유효한가 = (도장, 낱말, 힌트, 판) => {
  const d = 도장[도장키(낱말, 힌트)];
  return !!d && d.규칙판 === 판;
};

export const 도장키 = (낱말, 힌트) =>
  crypto.createHash('sha256').update(`${낱말}\t${힌트}`).digest('hex').slice(0, 20);

export function 도장읽기() {
  try { return JSON.parse(fs.readFileSync(곳, 'utf8')); } catch (_) { return {}; }
}

/** 지금 있는 힌트에, 지금 규칙판으로 찍힌 도장만 남겨 쓴다. 화면(game.js)은 이 파일에 있는 것만 보여 준다 */
export function 도장쓰기(도장, 지금힌트들, 판) {
  const 남길 = new Set(지금힌트들.map(([w, c]) => 도장키(w, c)));
  const out = {};
  for (const k of Object.keys(도장).sort()) if (남길.has(k) && (!판 || 도장[k].규칙판 === 판)) out[k] = 도장[k];
  fs.writeFileSync(곳, JSON.stringify(out, null, 0).replace(/,"/g, ',\n"') + '\n', 'utf8');
  return Object.keys(out).length;
}
