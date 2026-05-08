# Product Sense — Naver Ads MCP

## 사용자 페르소나

**helloMAX AE (광고 운영자)**

- 네이버 검색광고 캠페인을 매일/매주 운영하는 실무자
- Excel 기반 helloMAX 보고서를 클라이언트에게 정기 제출
- API 인증 방식(HMAC-SHA256)을 직접 구현할 역량 없음
- 반복적인 데이터 수집·붙여넣기 작업에 시간 낭비 중

## 핵심 문제

네이버 검색광고 성과 데이터를 helloMAX 10시트 Excel 포맷으로 만들려면:

1. 네이버 광고 관리 시스템에서 여러 보고서를 수동 다운로드
2. 각 시트(캠페인/매체/키워드/상품/검색어)에 붙여넣기
3. 합계·피벗 수식 재입력

이 과정이 매 보고 주기마다 30-60분 소요. 실수 가능성 높음.

## 핵심 원칙

### 1. AE-in-the-Loop

AI가 데이터를 자동 수집하고 Excel을 생성하지만, **최종 확인·제출은 AE가 직접 수행**.

- 생성된 Excel은 "완성본"이 아닌 "초안 + 검증 요청"
- 숫자 이상 징후는 AE가 판단

### 2. No AI Math

**집계·계산은 코드(TypeScript)가 수행하고, AI(LLM)는 계산하지 않는다.**

- LLM 부동소수점 오류 방지
- 재현 가능한 집계: 동일 입력 → 동일 출력 보장
- RAW 데이터는 원본 그대로 보존 (API 응답 변환 없이 저장)

### 3. Audit Everything

모든 데이터 출처는 추적 가능해야 한다.

- RAW 시트: API에서 받은 원본 데이터 (17-20 컬럼)
- PIVOT 시트: RAW에서 집계한 결과 (공식 명시)
- 브랜드검색 영역별 성과: API 미지원 → hidden placeholder (숨기지 않으면 오해 소지)

## 브랜드검색 영역별 성과 제외 이유

Naver Search Ad API는 브랜드검색 영역별(PC/모바일, 파워링크/쇼핑 등) 분리 데이터를 미지원.
(참조: GitHub Issue [naver/searchad-apidoc#1072](https://github.com/naver/searchad-apidoc/issues/1072))

**처리 방침**: 해당 시트를 hidden placeholder로 생성. AE가 수동으로 채울 수 있도록 구조 유지.
Web 자동화(Playwright 등)는 ToS 회색지대 + 봇 탐지 리스크 → **공식 API 미지원 기능은 자동화 불가**로 명시.

## Out of Scope (현재 버전)

- 브랜드검색 영역별 성과 자동화 (Naver API 미지원)
- 보고서 클라이언트 직접 발송 (이메일/슬랙 연동)
- 다중 광고주 계정 동시 처리 (현재 단일 `.env` 기반)
- 데이터 히스토리 DB 저장 (stateless MCP server)
