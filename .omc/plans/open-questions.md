# Open Questions

## naver-ads-access-plan - 2026-05-08
- [ ] "접속"은 단순 로그인 검증인가, 데이터/캠페인 조회인가, 자동 작업 실행인가? — 전체 구현 범위와 아키텍처를 결정함
- [ ] Naver 검색광고 API 키(CUSTOMER_ID/ACCESS_LICENSE/SECRET_KEY) 발급 가능한가? — Option A vs B의 갈림길
- [ ] 운영 환경은 로컬 CLI / 서버 데몬 / Vercel 함수 / GitHub Actions 중 어디인가? — 패키징·배포·환경변수 주입 방식 결정
- [ ] ID/PW만 사용해야 하는 강제 사유가 있는가? (예: API 발급 권한 없음) — Option B로 갈 수밖에 없는 경우를 사전에 파악
- [ ] 필요한 광고 데이터의 광고 상품 유형은? (검색광고만 / GFA 포함 / 브랜드검색 포함 / 쇼핑검색 포함) — Search Ad API는 검색광고(SA)만 커버하므로, 다른 상품이 필요하면 Hybrid 경로 또는 Plan 재설계 필요 [R-2]
