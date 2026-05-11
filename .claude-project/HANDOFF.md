---
created: 2026-05-11T18:10:00+09:00
project: naver-ads-mcp
summary: E2E PRD 검증 (US-001~020) + US-020 history drift 수정 (매 호출 1건 보장) + README onboarding 가이드 보강, 389 tests, f0442ed origin/main 푸시
---

## Session Digest

전체 PRD US-001~020을 /tmp/e2e-run.mjs 한 스크립트로 end-to-end 검증했습니다. Naver API와 Anthropic을 모킹한 상태로 generate_report, prepare_weekly_dashboard, prepare_daily_dashboard 세 도구를 연속 호출해 산출 xlsx의 시트 가시성·구조까지 확인했습니다. PRD↔구현 drift 1건 발견: US-020 acceptance는 "광고주당 history 1건"인데 실제 코드는 violations>0일 때만 기록하고 있어 무위반 일자에 누락. `src/mcp/server.ts:634`의 `if` 가드를 제거하고 regression 테스트 1건 추가해 388→389 tests. README에는 §1 SA API 발급 절차, §3 client 키 신규 온보딩/회전/오프보딩 워크플로우를 보강해 운영자 관점 갭을 메웠습니다. 커밋 f0442ed origin/main 푸시 완료.

## Progress

- ✅ E2E PRD 검증 (US-001~020) via /tmp/e2e-run.mjs: 3 tools 연속 호출, 산출 xlsx 시트 가시성 확인
- ✅ US-020 drift 수정: prepare_daily_dashboard가 위반 유무와 무관하게 매핑된 모든 client에 history 1건 작성
- ✅ Regression test 1건 추가 (no-violation 일자도 history 기록되는지)
- ✅ README §1 SA API 신청 가이드 (ads.naver.com 발급, MASTER 권한, SECRET_KEY 1회 노출)
- ✅ README §3 Client 키 운영 가이드 (온보딩 5단계, 회전, 오프보딩, 다중 광고주 주의)
- ✅ 388 → 389 tests passing, typecheck 0, build clean
- ✅ 푸시 완료: f0442ed → origin/main
- ⏳ 6 광고주별 daily_thresholds 튜닝 (실 데이터로 ROAS/CPC/노출 임계값 조정 후 per-client override)
- ⏳ buildDailyRaw live fetch 구현 (현재 stub; production 호출 시 throw)
- ⏳ AE 1명 파일럿 (Phase 4): 비셰프/택스아이 실데이터로 주간+데일리 1회 prepare 흐름 검증

## Next Steps

1. **6 광고주별 daily_thresholds 튜닝**: 실 데이터로 ROAS/CPC/노출 임계값 조정 후 client-mappings.json에 per-client override 추가
2. **buildDailyRaw live fetch 구현**: Phase 0 Naver API 결과를 daily slice로 가공해 production에서 prepare_daily_dashboard 실호출 가능하도록
3. **AE 1명 파일럿 (Phase 4)**: 비셰프/택스아이 실데이터로 주간+데일리 1회 prepare 흐름 검증
4. **history 보관 정책 결정**: prepare_daily_dashboard가 매 호출 1건 작성으로 변경됨에 따라 광고주당 연 365 라인 누적. archive cron 또는 retention 정책 필요 시 사용자 결정
5. **Phase 4 진입 결정**: AE 만족도 측정, hallucination 99% 게이트, 보안 runbook

## Blockers

- 없음

## Watch Out

- **gitignore `output/` 패턴**: 또 다른 디렉토리(`*/output/`)가 생기면 동일 함정. 항상 anchored path (`/output/`) 또는 더 좁은 패턴 사용
- **history schema dual-mode은 기술 부채**: 데일리 엔트리가 늘어나면 DailyHistoryEntrySchema로 분리 권장 (architect note 참고)
- **prepare_daily_dashboard는 dailyPayloadProvider 주입 필수**: live fetch 미구현이므로 production 호출 시 즉시 throw — 테스트는 통과해도 운영 검증 미완
- **per-client daily_thresholds override 머지 패턴**: resolveThresholds()는 partial override 머지, missing key는 default fallback. 새 임계값 필드 추가 시 resolveThresholds도 함께 갱신 필요
- **history resource regex**: `/^(\d{4}-W\d{2}|\d{4}-\d{2}-\d{2})\.jsonl$/` — 새 status 추가 시 regex/테스트 모두 점검
- **신규 — prepare_daily_dashboard history 볼륨**: 이제 모든 매핑된 client에 대해 매 호출 history 1건씩 작성 (6 광고주 × 365일 = 연 2,190 라인). 보관 정책 필요 시 사용자가 archive cron 결정

## Files Touched

- 수정: src/mcp/server.ts (line 634 if 가드 제거), tests/prepare-daily-dashboard.test.ts (신규 테스트 1건), README.md
- 푸시: f0442ed → origin/main
