---
created: 2026-06-04T00:00:00+09:00
project: naver-ads-mcp
summary: Humax AX 강의 계획서 5~7회차 작성·커밋·푸시 (7b08dcb). Vercel 배포를 5→6회로 이동해 5회 과부하·6회 콘솔 클릭쇼 동시 해소. 코드 변경 없음, 문서 전용.
---

## Session Digest

문서 전용 세션. `docs/references/humax-lecture-plan-v2.docx`(4회차 원본)를 출처로 Humax AX 강의 5~7회차 계획서를 신규 작성. 사용자 피드백으로 Vercel 배포를 5회→6회 앞부분으로 이동 → 5회 과부하와 6회 "콘솔 클릭쇼" 약점을 한 번에 해소. Google Cloud Console 한 곳만 깊게(Kakao/Naver는 자료 자습). 7b08dcb 커밋·푸시 완료. 사이드 작업: client_url.csv URL 유효성 Playwright 검증, yangjucc.co.kr 로그인 시도(중단).

## Progress

- ✅ **강의 계획서 작성**: `docs/references/humax-lecture-plan-5-7.md` (5~7회차, 각 120min 모듈 분배 + 적합성 분석)
  - 5회: SQL · Supabase · Next.js (로컬) — DB+로컬 웹까지
  - 6회: Vercel 배포(5회서 이동) + Google Cloud Console 단일 심화
  - 7회: gstack + Railway Remote MCP (캡스톤, DRI R 완성)
- ✅ **부담 분산 개정**: Vercel 위치 5→6 이동으로 두 리스크 동시 해소. 시간 합 정합 검증(세 회차 모두 120min)
- ✅ **원본 docx 동봉**: humax-lecture-plan-v2.docx 함께 커밋
- ✅ **7b08dcb 커밋·푸시 완료** (prettier가 .md 표 정렬 자동 적용)
- ✅ **보안 정리**: 세션 중 생성한 /tmp/yangju_creds.txt(평문 자격증명) 삭제

## Next Steps

1. (강의 운영) 5회 TS 깊이 최소화 여부 사전 결정 — "동작하는 페이지" 한정 권장
2. (강의 운영) 6·7회 직전 콘솔/스킬 UI 스크린샷 갱신 (Google Cloud·gstack·Railway 변동 잦음)
3. (선택) Kakao/Naver 자습 자료 별도 작성 — 본문은 자료 제공으로만 명시됨

## Blockers

- 없음 (문서 작업 완료)

## Watch Out

- **7회차 하드 선행조건**: 3회 로컬 naver-ads-mcp 설치 미완료자는 Remote MCP 변환 불가
- yangjucc.co.kr 로그인 기능은 미완 — 사용자가 Playwright 수동 로그인으로 방향 전환했고 그것도 중단됨. 재개 시 인증 컨텍스트(본인 계정 여부) 먼저 확인
- `.env`에 YANGJU_ID/YANGJU_PW 평문 존재 (gitignore됨). 노출 우려 시 로테이션 권장

## Files Touched

- `docs/references/humax-lecture-plan-5-7.md` (신규)
- `docs/references/humax-lecture-plan-v2.docx` (신규, 원본 동봉)
- `client_url.csv` (URL 유효성 결과 컬럼 추가 — gitignored, 미커밋)
