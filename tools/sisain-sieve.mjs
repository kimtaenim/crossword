/* 고른 낱말을 한 번 더 거른다 — «시사 용어인가, 일상어를 이어 붙인 말인가».
   node tools/sisain-sieve.mjs [챗봇 레포 경로] [--n=60]

   sisain-pick 의 잣대는 말뭉치 통계다. 그것으로 가려지는 데까지는 갔는데,
   «컴퓨터그래픽·영화감독» 과 «내란특검·연합훈련» 은 통계로 안 갈린다.
   토막의 갈래 쏠림도(컴퓨터 93%·그래픽 77% vs 내란 92%·특검 93%),
   붙어 나온 정도(PMI)도, 제목에 오르는 비율도 겹친다. 재 보고 하나씩 버린 잣대들이다.

   갈리지 않는 까닭은 이것이 말뭉치의 성질이 아니라 국어 지식이기 때문이다 —
   «영화» 와 «감독» 을 아는 사람은 «영화감독» 을 따로 배우지 않는다. 그 판단만 모델에 맡긴다.
   통계로 후보를 좁히고(1,100건에서 230여 종), 마지막 한 겹만 모델이 본다.

   API 열쇠는 챗봇 레포의 .env.local 에서 읽는다.
*/
import fs from 'fs';
import path from 'path';

const repo = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2] : path.join(process.cwd(), '..', 'sisain-chatbot');
const N = Number((process.argv.find(a => a.startsWith('--n=')) || '--n=60').slice(4));

const env = {};
for (const line of fs.readFileSync(path.join(repo, '.env.local'), 'utf8').split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}
const KEY = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('ANTHROPIC_API_KEY 가 없습니다'); process.exit(1); }

const 낱말 = fs.readFileSync(0, 'utf8').split(/\s+/).filter(w => /^[가-힣0-9]{3,8}$/.test(w)).slice(0, N);
if (!낱말.length) { console.error('걸러낼 낱말을 표준입력으로 넘기세요'); process.exit(1); }

const PROMPT = `아래 낱말 하나하나를 시사 크로스워드에 실을지 가린다. 셋 중 하나로 답한다.

시사: 뉴스를 읽는 사람이 따로 배워야 뜻을 아는 말. 제도·기구·정책·현상의 이름.
      보기 — 내란특검, 종부세, 연합훈련, 시가총액, 증거인멸, 리얼돌
일상: 흔한 낱말 둘 이상을 이어 붙인 말. 앞뒤를 아는 사람이면 뜻도 아는 말이라 따로 배울 것이 없다.
      보기 — 영화감독, 컴퓨터그래픽, 올림픽공원, 살인사건, 장기투자
전문: 특정 분야 안에서만 쓰는 기술 용어. 시사 지면의 말이 아니다.
      보기 — 순자산, 생산력, 접근법

고유명사(사람·회사·기관 이름)는 «일상» 으로 답한다.
한 줄에 하나씩 "낱말=판정" 꼴로만 적는다. 다른 말은 쓰지 않는다.

낱말:
${낱말.join('\n')}`;

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: PROMPT }],
  }),
});
const j = await res.json();
if (!res.ok) { console.error(JSON.stringify(j).slice(0, 400)); process.exit(1); }
const text = (j.content || []).map(c => c.text || '').join('');

const 판정 = new Map();
for (const line of text.split('\n')) {
  const m = line.match(/^\s*([가-힣0-9]{2,10})\s*=\s*(시사|일상|전문)/);
  if (m) 판정.set(m[1], m[2]);
}
const 묶음 = { 시사: [], 일상: [], 전문: [], 모름: [] };
for (const w of 낱말) 묶음[판정.get(w) || '모름'].push(w);

for (const k of ['시사', '일상', '전문', '모름']) {
  if (!묶음[k].length) continue;
  console.log(`■ ${k} (${묶음[k].length}개)\n  ${묶음[k].join('  ')}\n`);
}
const u = j.usage || {};
console.log(`입력 ${u.input_tokens} / 출력 ${u.output_tokens} 토큰 = 약 ${Math.round((u.input_tokens / 1e6 * 1 + u.output_tokens / 1e6 * 5) * 1400)}원`);
