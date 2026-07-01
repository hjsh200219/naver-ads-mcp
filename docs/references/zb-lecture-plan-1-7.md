# Humax AX 강의 계획서 — 전체 7회차 (v2 기반)

> 전체 7회 일관 설계. 1~4회(전반) = DRI 중 D + I 토대, 5~7회(후반) = 인터넷 배포된 자동화 자산.
> 강의 철학·DRI 모델·산출물 합격 기준은 v2 계획서 기준을 7회로 재배분 (아래 인라인 수록).
> **각 회차 2시간(120min) 가정** (v2 동일 기준). 사례·맥락은 본 **naver-ads-mcp** 로 통일.

---

## 강의 철학 (v2 동일)

핵심 메시지: **"Claude를 1개 앱(Chat)으로 쓰지 말고, 전체 생태계로 써서 업무를 자동화하라."**

- 기존 인식: Claude = 채팅창 + 파일 업로드.
- 실제 가치: **Desktop(자연어 자동화) → IDE(Code로 풀 자동화 빌드) → Remote(무인 스케줄 실행)** 진화.

자동화 자산 정의 (전 회차 공통 합격 기준): ❌ "매번 물어봄"(수동 보조)이 아니라 ✅ **트리거(시간/이벤트/명령) → 결과(파일/DB/URL/알림) 자동 실행**(자동화 자산).

### DRI 모델 (강의 척추)

| 단계 | 명칭    | 환경                                | 학습 곡선 | 강의 회차               |
| ---- | ------- | ----------------------------------- | --------- | ----------------------- |
| D    | Desktop | Claude Desktop (Chat, Cowork, 확장) | 낮음      | **1회**                 |
| I    | IDE     | Claude Code (VS Code / Terminal)    | 중간~높음 | **2회 본격 + 3·4회**    |
| R    | Remote  | Schedule + Remote MCP (무인 실행)   | 중간      | **1회 약속 → 7회 완성** |

전반 4회 = "코드는 개발자 영역" → **본인이 도구 빌드**, "결과는 엑셀로 끝" → **DB·웹·배포**로 인식 전환.

---

## 1회차: Claude Desktop 풀활용 — DRI 중 D + R 도입 (2h)

> DRI: **D 풀활용**. Chat/Cowork 분기 + Desktop 7대 기능 + Extension. R(무인 실행)은 개념 약속(7회 회수).
> 트리거→결과: **Schedule(시간 트리거) → 데이터 자동 갱신 / Skill 1줄 → 산출물 자동 생성**

### 모듈 1-1: DRI 모델 소개 (15min)

- **목표**: 7회 강의 전체 지도 + 본 회차 위치 명확화
- **내용**:
  - DRI 도식: Desktop → IDE → Remote 진화 경로
  - 1회 = D 풀활용 + R 도입 / 2회 = I 본격 / 3·4회 = I 심화 / 5~7회 = 배포·무인 응용
  - 각 단계 학습 곡선·산출물·실무 효과 비교
- **산출**: (개념) 전체 강의 지도 이해

### 모듈 1-2: Claude Desktop의 Chat vs Cowork (20min)

- **목표**: 두 모드 차이와 사용 분기점 체득
- **내용**:
  - Chat: 단일 대화, 컨텍스트 휘발성, 빠른 질의
  - Cowork: Projects 기반 영속 컨텍스트, 공통 자산 첨부, 주간 리포트 같은 반복 작업 적합
  - 토큰 한계 직관 (대용량 raw = 200K 컨텍스트 수십 배 → Cowork·도구 필요성)
- **실습**: "네이버 광고 주간 리포트" Cowork Project 생성 → 공통 자산 첨부(광고주 목록 / 리포트 골든 템플릿 / SOP)
- **산출**: Cowork Project 1개

### 모듈 1-3: Show Me · Skill · MCP · Schedule · Dispatch · Computer Use · Live Artifact (45min)

- **목표**: Claude Desktop 7대 기능 1회 시연 + 실무 매칭

| #   | 기능          | 정의                                 | naver-ads 실무 매칭                     |
| --- | ------------- | ------------------------------------ | --------------------------------------- |
| 1   | Show Me       | 산출물을 시각화해서 보여줌           | 광고주별 클릭·전환 stacked bar chart    |
| 2   | Skill         | 슬래시 명령(/)으로 재사용 워크플로우 | `/weekly-report` 주간 리포트 생성       |
| 3   | MCP           | 외부 도구/API와 표준 프로토콜로 연결 | naver-ads-mcp (도구 6종) — **3회 설치** |
| 4   | Schedule      | 정해진 시간 자동 실행 (cron 유사)    | 매주 월요일 주간 페이로드 자동 수집     |
| 5   | Dispatch      | 외부 트리거(이메일/웹훅)로 실행      | 데이터 수집 완료 시 리포트 자동 생성    |
| 6   | Computer Use  | Claude가 화면 직접 조작              | 광고 관리 콘솔 수동 작업 자동화         |
| 7   | Live Artifact | 실시간 갱신 인터랙티브 산출물        | 임계값 변경 시 대시보드 즉시 반영       |

- **실습**: Show Me 차트 1개 + Schedule 1개 등록 (매주 데이터 조회). _MCP·Skill 실설치는 3회에서 본격(여기선 시연만)_.
- **산출**: Show Me 1건 + Schedule 1개 + 7대 기능 개념 정리

### 모듈 1-4: Claude Extension (Chrome · Word · Excel · PPT) (30min)

- **목표**: 일상 도구에 Claude 직접 삽입
- **내용**:
  - Chrome Extension: 웹페이지 요약 / 번역 / 데이터 추출 → 경쟁 광고·검색결과 조회 (4회 크롤링 토대)
  - Word Extension: SOP·리포트 문서 작성 + AI 교정
  - Excel Extension: 셀 단위 AI 함수(`=CLAUDE(...)`) → 광고 키워드 분류 셀 함수화
  - PPT Extension: 리포트 슬라이드 초안 자동 생성
- **실습**: Chrome Extension 설치 → 검색결과 페이지 자동 요약 1회 + Excel AI 분류 1열 시연
- **산출**: 4개 Extension 설치 + 각 1회 사용 경험

> **시간 합계**: 110min + 버퍼/Q&A 10min = 120min.
> **R 도입 의도**: 1회 Schedule로 "무인 실행"을 약속만 심고, 7회 Remote MCP에서 완성(PC 꺼져도 동작)으로 회수.

---

## 2회차: Claude Code 본격 도입 + Git/GitHub — DRI 중 I (2h)

> DRI: **I 도입**. VS Code + Claude 확장으로 본인이 도구 빌드. Git/GitHub로 버전관리·협업 진입.
> 트리거→결과: **PRD 1장 → ralph 루프 자동 코드 생성·수정 / git push → 변경 자동 추적**
> 후반 연결: git/GitHub 워크플로우 → **5회 Vercel·7회 Railway 자동배포의 토대(재교육 금지)**.

### 모듈 2-1: Claude Code 실행 환경 비교 (10min)

- **목표**: 3개 환경 차이와 권장 환경 결정
- **내용**:
  - Claude Desktop 내부: GUI 통합, 가벼운 코드 실험
  - Terminal: 순수 CLI, 자동화 cron 적합 (무인 배치)
  - VS Code + 확장: IDE 통합, Git/디버거/터미널 한 화면 — **본 강의 주력**
- **결론**: VS Code + Claude 확장 = 실무자 진입 부담 최저 + 풀 IDE.

### 모듈 2-2: 필수 프로그램 설치 (25min)

- **목표**: 개발 환경 0 → 1
- **설치 목록**:
  1. Git — 버전관리
  2. Node.js 20+ — Claude Code CLI 및 naver-ads-mcp 런타임(3회 직결)
  3. VS Code — 메인 IDE
  4. Claude Code CLI — `npm install -g @anthropic-ai/claude-code`
  5. VS Code Claude 확장 — Marketplace 설치
- **실습**: macOS/Windows 분기 설치 → 검증 `claude --version` / `git --version` / `node --version`
- **산출**: 개발 환경 셋업 완료

### 모듈 2-3: Git 개념 + GitHub 사용법 (25min)

- **목표**: 버전관리 + 협업 진입 (5·7회 자동배포 선행)
- **내용**:
  - Git 핵심 5개: `clone / add / commit / push / pull`
  - GitHub Private repo 생성 → VS Code 연결
  - 산출물 commit → 변경 추적 (file diff 시연)
  - `.gitignore` 패턴 (민감 데이터 차단 — 3회 `.env`/`accounts.json` 선행)
- **실습**: GitHub Private repo 1개 생성 → naver-ads-mcp clone → 첫 commit/push → `.gitignore`에 raw 패턴 추가
- **산출**: GitHub repo 1개 + 첫 commit/push

### 모듈 2-4: OMC (Oh My Claude Code) — ralph / ralplan (20min)

- **목표**: Claude Code 워크플로우 가속기 도입
- **내용**:
  - OMC = Claude Code 멀티 에이전트 오케스트레이션 레이어 (1줄 설치)
  - 핵심 스킬 2개: **ralph**(자가 참조 루프 — 목표 달성까지 반복 수정), **ralplan**(합의 기반 계획 게이트 — 모호 요청 자동 게이팅)
- **실습**: OMC 설치(`/oh-my-claudecode:omc-setup`) → `/ralph` 1회 시연(간단 버그 자동 수정 루프)
- **산출**: OMC 설치 + ralph/ralplan 사용 경험

### 모듈 2-5: PRD 개념 + 멀티 모델 리뷰(CCG) (30min)

- **목표**: 좋은 요청서 = 좋은 산출물 + 단일 모델 의존 탈피
- **내용**:
  - PRD 구조: 목적 / 사용자 / 시나리오 / 합격 기준 / 비목표
  - 나쁜 요청("리포트 자동화해줘") vs 좋은 PRD(목표·입력·출력·검증 명시)
  - VS Code에 Codex + Gemini 확장 → ralplan에 3개 모델 합의(Claude+Codex+Gemini = **CCG**)
- **실습**: "주간 페이로드 자동 수집" 작은 PRD 1개 작성 → ralplan 실행 → Codex/Gemini 리뷰 → 의견 불일치 1개 합의
- **산출**: PRD 1개 + VS Code 멀티 모델 환경 + ralplan 1회 실행

### 모듈 2-6: 숙제 안내 (10min)

- **숙제**: 본인 업무에서 자동화 후보 1개 선정 → ralplan으로 계획 → 다음 회차 발표
- **가이드**: 범위 작게(1~2시간 작업 1개) / 입력·출력 명확 / 합격 기준 측정 가능

> **시간 합계**: 120min.
> **재사용**: Git/GitHub clone/pull/push는 본 회 완료 → 5·7회 자동배포에서 **참조만**(재교육 금지).

---

## 3회차: naver-ads-mcp 설치 + 환경변수 — DRI 중 I 응용 (2h)

> DRI: **I 응용**. 로컬 MCP 1개를 내 PC에 설치·연결. **7회 Remote MCP 변환의 출발점(하드 선행조건)**.
> 트리거→결과: **Claude Desktop 명령 → 로컬 MCP 도구 자동 실행 → 광고 데이터 반환**

### 모듈 3-1: MCP 개념 + 본 MCP 구조 (20min)

- **목표**: MCP가 무엇이고 본 서버가 무엇을 하는지 이해
- **내용**:
  - MCP = Claude와 외부 도구/API를 잇는 표준 프로토콜 (1회 7대 기능 중 #3 회수)
  - naver-ads-mcp = 네이버 검색광고 데이터 수집 + helloMAX 리포트 자동 생성 TS 서버
  - 도구 6종 개요: `validate_credentials` / `fetch_raw_data` / `generate_report` / `prepare_weekly_payload` / `finalize_weekly_dashboard` / `prepare_daily_dashboard`
  - 로컬 stdio 방식 = 내 PC ↔ Claude Desktop 직접 통신 (7회 원격 대비)
- **산출**: (개념) MCP·본 서버 역할 이해

### 모듈 3-2: 설치 + 빌드 (25min)

- **목표**: 소스 → 동작하는 로컬 MCP
- **내용**:
  - 2회 GitHub repo clone 재사용 → `npm install`
  - `npm run build` (tsc → dist/) / `npm run typecheck` (0 errors) / `npm test` 통과 확인
  - Claude Desktop 설정 파일에 MCP 서버 등록 (command/args 경로)
- **실습**: clone → install → build → Claude Desktop 등록 → 서버 인식 확인
- **산출**: 로컬 naver-ads-mcp 1개 (Desktop에서 도구 노출)

### 모듈 3-3: 환경변수 — .env / accounts.json (25min)

- **목표**: 자격증명 안전 보관 (전 회차 보안 토대)
- **내용**:
  - `accounts.json` = 자격증명 + client 식별 단일 소스 (account name = client_id)
  - 필드: `accessLicense` / `secretKey` / `customerId` — **절대 commit 금지**
  - `.gitignore`에 `.env`·`accounts.json` 강제 등록 확인
  - `chmod 600` 유지 / 변경 후 MCP 서버 재시작 필수(핫리로드 미지원)
  - 키 노출 시나리오 + 폐기·재발급 절차
- **실습**: `accounts.json` 작성 → `chmod 600` → `git status`로 추적 안 됨 확인 → 서버 재시작
- **산출**: `accounts.json` 셋업 + 자격증명 안전 보관

### 모듈 3-4: 자격증명 검증 + 첫 데이터 수집 (25min)

- **목표**: 설치한 MCP로 실제 호출 완주 (네이버 검색광고 인증 경험 — 6회 OAuth 토대)
- **내용**:
  - `validate_credentials` 호출 → HMAC-SHA256 서명 인증 성공 확인
  - `fetch_raw_data` 호출 → 광고 성과 raw 1건 반환 (1MB 한도 대응: `outputPath`/`summarize`/`limit` 옵션)
  - 자격증명이 로그·에러에 노출 안 됨 확인(`enumerable: false` 패턴)
- **실습**: `validate_credentials` → 성공 → `fetch_raw_data` 1건 → 응답 확인
- **산출**: **로컬 MCP 자격증명 검증 + 데이터 수집 1건 성공**

> **시간 합계**: 95min + 버퍼/Q&A 25min = 120min.
> **하드 선행조건 명시**: 본 회 로컬 MCP 설치 완료가 **7회 Remote MCP 변환의 필수 전제**. 미완료자는 7회 따라오기 사실상 불가.

---

## 4회차: Claude Desktop 로그 디버그 + API + 크롤링 — DRI 중 I 심화 (2h)

> DRI: **I 심화**. "동작하는 것 같다 → 동작한다" 증명. API 직접 호출·크롤링으로 데이터 소스 확장.
> 트리거→결과: **cron/이벤트 → 외부 데이터 자동 수집 / MCP 호출 실패 → 로그로 원인 자동 추적**
> 후반 연결: API 호출·인증 패턴 → **6회 Google Cloud OAuth 인증으로 직결**.

### 모듈 4-1: Claude Desktop 로그 → 디버그 (30min)

- **목표**: MCP 호출 실패를 로그로 추적 (3회 MCP 설치 능력 확장)
- **내용**:
  - Claude Desktop 로그 위치: macOS `~/Library/Logs/Claude/`, Windows `%APPDATA%\Claude\logs\`
  - MCP 호출 실패 패턴: 서명 불일치 / 자격증명 오류 / 경로 오류 / 타임아웃
  - 로그 → 원인 매핑 → 수정 → 재확인 루프
- **실습**: 의도적 에러 주입(잘못된 `accounts.json` 키) → 로그에서 원인 추적 → 수정 → 정상 호출 확인
- **산출**: 로그 분석 + 디버그 1회

### 모듈 4-2: API 개념 + 직접 호출 (30min)

- **목표**: REST API 기본 + 인증 패턴 (MCP가 내부에서 하는 일 이해)
- **내용**:
  - API = 프로그램이 호출하는 함수의 인터넷 버전
  - HTTP 메서드(GET/POST) / JSON 응답 / 인증(API Key, HMAC, OAuth) 개요
  - Rate limit / 에러 코드 / 캐시 전략
  - 네이버 검색광고 API HMAC 서명 구조: `{ts}.{METHOD}.{path-no-query}` (본 MCP `signer.ts`가 하는 일)
- **실습**: Claude Code에 "이 데이터 받아와줘" 자연어 → 인증 포함 호출 코드 자동 생성 → 응답 파싱
- **산출**: API 직접 호출 스크립트 1개

### 모듈 4-3: 크롬 개발자 도구로 크롤링 (30min)

- **목표**: API 없는 사이트도 데이터 추출
- **내용**:
  - 크롬 개발자 도구(F12) → Network 탭: API 호출 가로채기 / 상태코드·payload 분석
  - Elements 탭: 셀렉터 추출
  - Claude Code에 "이 사이트 크롤링" + 셀렉터 → BeautifulSoup/Playwright 코드 생성
  - robots.txt / 약관 준수 안내
- **실습**: 경쟁 광고·검색결과 페이지 1건 크롤링 (Network 탭 API 발견 → 추출)
- **산출**: 크롤링 스크립트 1개

### 모듈 4-4: 테스트로 증명 (15min)

- **목표**: "동작하는 것 같다" → "동작한다" 증명
- **내용**:
  - 본 MCP의 vitest 패턴 (assert / fixture) — TDD: 실패 테스트 → Green → Refactor
  - 새 기능은 실패 테스트 먼저 (`npm test` 359 passing 기준)
- **실습**: 4-2 호출 코드에 테스트 1개 추가 → 실패 → 통과 확인
- **산출**: 테스트 1개

> **시간 합계**: 105min + 버퍼/Q&A 15min = 120min.
> **6회 직결**: 본 회 API 인증(HMAC·OAuth 개요) → 6회 Google Cloud OAuth는 그 실전 확장.

---

## 진행 현황 브리지 (1~4회 → 5~7회)

| 회차 | 완료 주제                                                                            | 후반 회차에서 재사용되는 자산                                     |
| ---- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1회  | Claude Desktop 풀활용 (Chat/Cowork · 7대 기능 · Extension)                           | (D 토대, R 약속 → 7회 회수)                                       |
| 2회  | Git · VS Code + Claude Code 확장 · OMC(ralph/ralplan) · GitHub 기본(clone/pull/push) | **git/GitHub 워크플로우** → 5회 Vercel 자동배포, 7회 Railway 배포 |
| 3회  | 본 MCP(naver-ads-mcp) 설치 · 환경변수(.env / accounts.json)                          | **로컬 MCP 1개** → 7회 Remote MCP 변환의 출발점 (하드 선행조건)   |
| 4회  | Claude Desktop 로그 → 디버그 · API · 크롤링(크롬 Network)                            | **API 호출·인증 패턴** → 6회 개발자센터 API 인증으로 직결         |

후반 3회는 **"코드는 봤다" → "인터넷에 배포된 자동화 자산을 가진다"** 로 넘어가는 구간.
DRI 모델 기준: 5~6회 = **I 풀스택 응용**, 7회 = 1회에 약속한 **R(무인 실행)** 을 Remote MCP로 완성 → DRI 루프 종결.

자동화 자산 기준(v2 동일): ❌ "매번 물어봄" 이 아니라 ✅ **트리거(시간/이벤트/명령) → 결과(파일/DB/URL/알림) 자동 실행**. 매 회차 산출물은 이 기준 충족해야 함.

---

## 5회차: SQL · Supabase · TypeScript/Next.js (로컬) (2h)

> DRI: **I 풀스택**. 로컬 데이터 → 클라우드 DB → 로컬 웹 화면. (배포는 6회 앞부분)
> 트리거→결과: **DB 변경 → 웹 화면 자동 반영**
> 오프닝: 실전 빌드(DB·웹) 전 **하네스 정비**(CLAUDE.md) — 에이전트가 실수 없이 일하는 환경 먼저.

### 모듈 5-0: 하네스 설정 — CLAUDE.md의 역할 (15min)

- **목표**: 후반 실전 빌드 전에 "에이전트가 규칙을 지키며 일하는 환경" 정비. 하네스 = 리포지터리를 **에이전트의 기록 시스템**으로 세팅 (모델을 바꾸지 않고 구조·문서·게이트로 정확도 상승).
- **내용**:
  - **하네스란**: 2회 OMC·3·4회 설치/디버그 경험 위에, 리포지터리 자체를 에이전트가 읽고 따르는 규칙 체계로 만드는 것
  - **CLAUDE.md = Claude Code가 세션 시작 시 자동 로드하는 프로젝트 진입 문서** (에이전트용 메모리/지침). 사람이 매번 설명하지 않아도 됨
  - **map, not handbook**: 진입 문서는 지도 역할 — 개요·규칙 요약만, 상세는 `docs/` 하위로 링크 (본 프로젝트 구조 그대로)
  - **우선순위 계층**: 엔터프라이즈 → 프로젝트(`./CLAUDE.md`) → 유저(`~/.claude/CLAUDE.md`) → 로컬. 하위가 상위를 세부 보강
  - **담을 것**: 프로젝트 개요·Tech Stack·아키텍처 요약·Critical Constraints(예: `.env`/`accounts.json` commit 금지 — 3회 보안 회수)·상태 프로토콜(DONE/BLOCKED…)
  - **AGENTS.md 관계**: 본 프로젝트는 AGENTS.md ↔ CLAUDE.md 동일 진입점(단일 소스, 에이전트 종류 무관)
- **실습**: 본 naver-ads-mcp `CLAUDE.md` 열어 구조 확인 → 내 5회 프로젝트(Next.js/Supabase)에 `/init`로 최소 CLAUDE.md 1개 생성 (개요 + "Supabase 키 commit 금지" 1줄 + 상태 프로토콜)
- **산출**: 내 프로젝트 CLAUDE.md 1개 (에이전트 진입 문서)

### 모듈 5-1: SQL 소개 (20min)

- **목표**: Excel 사고 → DB 사고 전환
- **내용**:
  - SQL = 데이터 질의 표준 언어. 핵심 4개: `SELECT / INSERT / UPDATE / DELETE`
  - `JOIN` 1개 시연 (예: 광고주 마스터 + 일별 성과 raw 결합)
  - Claude Code에 **자연어 → SQL 변환** 요청 패턴
- **실습**: SQLite 로컬 DB에 샘플 성과 데이터 적재 → "광고주별 클릭 합계" SQL 1개 작성
- **산출**: SQL 쿼리 1개 (로컬 실행 확인)

### 모듈 5-2: Supabase DB 연결 (25min)

- **목표**: 클라우드 DB로 다중 사용자 공유
- **내용**:
  - Supabase = PostgreSQL 기반 BaaS (회원가입 1분)
  - 테이블 생성 (광고주 / 일별 성과 / 리포트 결과 3종)
  - API Key 발급 → **`.env` 보관** (3회 환경변수 패턴 재사용, 재교육 X)
  - 클라이언트 라이브러리 INSERT/SELECT
  - 권한 기본 (RLS, Row Level Security) 개념만
- **실습**: Supabase 프로젝트 1개 → 리포트 결과 1건 INSERT → 대시보드에서 조회
- **산출**: Supabase 프로젝트 + 테이블 3개 + 데이터 1건

### 모듈 5-3: TypeScript · Next.js 소개 (30min)

- **목표**: 웹 화면 만들기 진입 (개념 최소, 동작 우선)
- **내용**:
  - TypeScript = JavaScript + 타입 안전성 (본 MCP가 이미 TS — 3회에서 이미 노출됨, 친숙)
  - Next.js = React 기반 풀스택 프레임워크. `npx create-next-app@latest`
  - 페이지 구조(`app/page.tsx`) 기본 + Supabase 데이터 fetch → 표 렌더링
  - Claude Code에 "이 데이터 표로 보여주는 페이지" 자연어 요청
- **실습**: Next.js 프로젝트 생성 → 5-2 Supabase 데이터를 표로 표시하는 페이지 1개
- **산출**: Next.js 페이지 1개 (로컬 실행)

### 모듈 5-4: 로컬 디버깅 + 로그 (20min)

- **목표**: 배포 전 로컬 디버깅 (4회 로그 분석 능력 확장)
- **내용**:
  - 로컬 `npm run dev` 터미널 로그 실시간 확인
  - 크롬 Console: 클라이언트 에러 / 크롬 Network: API 응답·상태코드·payload
- **실습**: 의도적 에러 주입(잘못된 Supabase 키) → Console + 터미널 양쪽 추적 → 수정 → 정상 확인
- **산출**: 로컬 디버깅 1회

> **시간 합계**: 5-0(15)+5-1(20)+5-2(25)+5-3(30)+5-4(20) = 110min + 버퍼/Q&A 10min = 120min. _(하네스 모듈 신설분 확보 위해 5-3 35→30 트림.)_
> **부담 분산**: Vercel 배포는 6회 앞부분으로 이동(로컬 페이지 → 인터넷 URL). 5회는 **하네스 정비 + DB + 로컬 웹 화면**까지 집중.

---

## 6회차: Vercel 웹 배포 + Google Cloud Console 연동 (2h)

> DRI: **I 풀스택 → 응용**. 5회 로컬 웹을 인터넷에 올리고(배포), 그 위에 Google API를 인증 연동.
> 트리거→결과: **git push → Vercel 자동 배포 / 명령 1줄 → 인증된 Google API 호출 → 데이터 자동 반환**
> 설계 의도: 6회 앞부분을 **실배포 실습**으로 채워 "콘솔 클릭쇼" 약점 제거. Google 한 곳만 다뤄 깊이 확보(5회서 넘어온 부담 흡수).

### 모듈 6-1: Vercel 웹 배포 + GitHub 연결 (35min)

- **목표**: 5회 로컬 페이지 → 인터넷 (URL 발급)
- **내용**:
  - Vercel = 호스팅 (무료 시작). GitHub repo 연결 → **push 시 자동 배포** (2회 git 워크플로우 직결)
  - 환경변수 등록 (`.env` 값 → Vercel 대시보드)
  - 도메인 발급 (`xxx.vercel.app`), Preview vs Production 분리
- **실습**: 5회 Next.js 프로젝트 GitHub push → Vercel 연결 → 자동 배포 → 발급 URL에서 데이터 확인
- **산출**: **배포된 웹사이트 URL 1개**

### 모듈 6-2: 배포 후 디버깅 + 재배포 (15min)

- **목표**: 인터넷 환경 디버깅 (5회 로컬 디버깅 확장)
- **내용**: Vercel 대시보드 Logs(서버 로그) + 크롬 Console·Network(클라이언트) 양쪽 추적
- **실습**: 의도적 에러 주입(잘못된 Supabase 키) → Vercel 로그 + Console 추적 → 수정 → push → 자동 재배포 → 정상 확인
- **산출**: 디버깅 1회 + 재배포 1회

### 모듈 6-3: 개발자 플랫폼 멘탈모델 + OAuth (15min)

- **목표**: 콘솔 반복 패턴을 1개 모델로 압축
- **내용**:
  - 공통 흐름: **앱 등록 → Client ID/Secret 발급 → Redirect URI 등록 → 권한(Scope) 동의 → 토큰 → API 호출**
  - OAuth 2.0 개요 (4회 API 인증의 실전판), API Key vs OAuth 차이
  - 발급한 키는 `.env` (3회 패턴), 절대 commit 금지
- **산출**: (개념) 인증 흐름도 1장 이해

### 모듈 6-4: Google Cloud Console — 프로젝트 + 자격증명 (30min)

- **목표**: Google Cloud 프로젝트 셋업 + 키 발급 완주
- **내용**:
  - Cloud Console 프로젝트 생성 → API 라이브러리에서 1개 활성화 (예: Sheets — 재무/리포트 실무 직결)
  - OAuth 동의 화면 구성 + 자격증명(Client ID/Secret 또는 API Key) 발급
  - 할당량(Quota) / 과금 경계 / 결제 계정 주의
- **실습**: 프로젝트 생성 → API 1개 활성화 → 자격증명 발급 → `.env` 보관
- **산출**: Google Cloud 프로젝트 + 자격증명 1개

### 모듈 6-5: Google API 인증 호출 + 키 관리 (25min)

- **목표**: 발급 키로 실제 인증 호출 완주 (클릭쇼 → 실연동)
- **내용**:
  - Claude Code로 "이 Google API 호출해줘" → 인증 코드 자동 생성 → 데이터 1건 반환
  - (선택) 배포된 웹(6-1)에서 Google API 데이터 표시 → 배포+연동 결합
  - 키 폐기·재발급 절차 / Rate limit 대응 / `.gitignore` 확인(2·3회 패턴)
- **실습**: Google API 인증 호출 1건 → 응답 파싱 → `git status`로 키 추적 안 됨 확인
- **산출**: **Google API 인증 호출 1건 성공**

> **시간 합계**: 120min.
> **Kakao/Naver는 자료로 제공** — Google과 동일 패턴(앱 등록→키→호출)이라 자습 가능. Naver Search Ad 인증은 본 MCP(3회)에서 이미 경험.

---

## 7회차: gstack Skill + Railway로 Remote MCP 만들기 (2h) — 캡스톤

> DRI: **R 완성**. 1회에 약속한 "무인 실행"을 Remote MCP로 닫는 캡스톤.
> 트리거→결과: **외부에서 URL로 호출 → 클라우드 MCP가 무인 실행 → 결과 반환**
> **하드 선행조건: 3회 로컬 naver-ads-mcp 설치 완료.** (로컬 → 원격 변환이 본 회차의 축)

### 모듈 7-1: Local MCP vs Remote MCP (20min)

- **목표**: 로컬 stdio MCP와 원격 HTTP MCP 차이 이해
- **내용**:
  - 로컬(3회): 내 PC에서 stdio로 Claude Desktop과 통신 — 내 PC 켜져 있어야 동작
  - 원격: 클라우드에 상주, HTTP/SSE 엔드포인트 → **PC 꺼져도 동작, 팀 공유, 스케줄 무인 실행**
  - 왜 Remote가 DRI의 R인가: 트리거가 시간/이벤트여도 항상 응답
- **산출**: (개념) 로컬→원격 전환 이유·구조 이해

### 모듈 7-2: gstack Skill 활용 (25min)

- **목표**: gstack 스킬로 배포 보일러플레이트 가속
- **내용**:
  - gstack skill = 배포·스캐폴딩 가속기 (2회 OMC 스킬 경험 연장)
  - Remote MCP 서버 골격 생성 / 환경설정 자동화 패턴
  - 본 naver-ads-mcp 구조를 HTTP 서버로 감싸는 변환 가이드
- **실습**: gstack 스킬로 Remote MCP 서버 스캐폴드 1개 생성
- **산출**: 원격용 MCP 서버 골격

### 모듈 7-3: Railway 배포 (35min)

- **목표**: MCP 서버를 Railway에 배포 → 공개 엔드포인트 확보
- **내용**:
  - Railway = 컨테이너 호스팅 (GitHub 연결 → push 자동 배포, 5회 Vercel 경험 연장)
  - 환경변수 등록 (`.env` 값 → Railway 대시보드 — accounts.json/키 안전 주입)
  - 배포 URL 발급 + 헬스체크 / 로그 확인
  - 비용/슬립 정책 주의
- **실습**: 7-2 서버 GitHub push → Railway 연결 → 자동 배포 → 엔드포인트 URL 발급
- **산출**: **배포된 Remote MCP 엔드포인트 URL 1개**

### 모듈 7-4: Remote MCP 연결 + 무인 실행 검증 (25min)

- **목표**: 클라이언트에 원격 MCP 등록 → 무인 동작 확인
- **내용**:
  - Claude Desktop/Code에 Remote MCP URL 등록
  - 도구 호출 1건 → 클라우드 실행 결과 반환 확인
  - Schedule/Dispatch와 연결(1회 R 개념 회수): 시간 트리거 → 원격 MCP 자동 호출
- **실습**: 원격 MCP 도구 1개 호출 → 응답 확인 → (선택) Schedule 1개 연결
- **산출**: 원격 MCP 호출 성공 + 무인 트리거 연결 1개

### 모듈 7-5: 전체 회고 + DRI 루프 종결 (15min)

- **목표**: 7회 전체 자산을 자동화 파이프라인으로 연결
- **내용**: Desktop(1) → IDE 빌드(2~4) → 웹 배포(5) → 플랫폼 연동(6) → Remote 무인 실행(7) 한 장 정리 / 본인 업무 적용 1개 선정
- **산출**: 개인 자동화 로드맵 1장

> **시간 합계**: 120min (회고 포함).

---

## 시간 분배 요약 (전체 7회)

| 회차 | 주제                               | DRI        | 모듈 시간 합 | 헤드라인 산출물                       |
| ---- | ---------------------------------- | ---------- | ------------ | ------------------------------------- |
| 1회  | Claude Desktop 풀활용              | D + R 도입 | 110+10       | Cowork Project + Schedule + Extension |
| 2회  | Claude Code 본격 도입 + Git/GitHub | I 도입     | 120          | VS Code+OMC+CCG 환경 + GitHub repo    |
| 3회  | naver-ads-mcp 설치 + 환경변수      | I 응용     | 95+25        | 로컬 MCP + 자격증명 검증·수집 1건     |
| 4회  | 로그 디버그 · API · 크롤링         | I 심화     | 105+15       | API/크롤링 스크립트 + 로그 디버그 1회 |
| 5회  | SQL · Supabase · Next.js (로컬)    | I 풀스택   | 100+20       | Supabase DB + 로컬 웹 페이지 1개      |
| 6회  | Vercel 배포 · Google Cloud Console | I 응용     | 120          | 배포된 웹 URL + Google API 호출 1건   |
| 7회  | gstack + Railway Remote MCP        | **R 완성** | 120          | 배포된 Remote MCP URL + 무인 트리거   |

## 산출물 (전체 7회 누적)

| #   | 산출물              | 합격 기준                                            |
| --- | ------------------- | ---------------------------------------------------- |
| 1   | Cowork Project      | "주간 리포트" Project + 공통 자산 3종 첨부           |
| 2   | Desktop 기능 활용   | Show Me 1건 + Schedule 1개 + 7대 기능 정리           |
| 3   | Extension 4종       | Chrome / Word / Excel / PPT 각 1회 사용              |
| 4   | VS Code 환경        | Claude 확장 + Codex + Gemini + OMC 설치 완료         |
| 5   | GitHub repo         | Private repo + `.gitignore` + 첫 commit/push         |
| 6   | PRD + ralplan       | 자동화 후보 1개 PRD + ralplan 1회 실행               |
| 7   | 로컬 MCP 설치       | naver-ads-mcp build/test 통과 + Desktop 등록         |
| 8   | 자격증명 + 수집     | `accounts.json` 안전 셋업 + 검증 + 데이터 수집 1건   |
| 9   | API/크롤링 + 테스트 | API 호출 + 크롤링 각 1개 + 테스트 1개 + 로그 디버그  |
| 10  | SQL + Supabase      | 쿼리 1개 + 테이블 3개 + 데이터 1건 INSERT/조회       |
| 11  | Next.js 로컬 페이지 | 페이지 1개 + Supabase fetch 동작 + 로컬 디버깅 1회   |
| 12  | Vercel 배포         | GitHub 연결 + 자동 배포 URL + 디버깅/재배포 1회      |
| 13  | Google 인증 연동    | Cloud 프로젝트 + 자격증명 + API 호출 1건 + 키 `.env` |
| 14  | Remote MCP          | gstack 스캐폴드 + Railway 배포 URL + 원격 호출 성공  |
| 15  | 무인 실행           | Schedule/Dispatch → Remote MCP 자동 호출 연결 1개    |

---

## 교육 내용 적합성 분석 (요청: "시간 분배 및 적합성 고려")

### ✅ 5↔6 부담 분산 (이번 개정 핵심)

- **문제였던 것**: 5회가 SQL+Supabase+TS+Next+Vercel 5개 신규 개념을 2h에 압축 → 과부하. 6회는 Google/Kakao/Naver 콘솔 둘러보기만이면 "클릭쇼"로 자동화 자산 ❌.
- **해결**: Vercel 배포를 5회 → 6회 앞부분으로 이동.
  - **5회**: DB(SQL+Supabase) + 로컬 웹 화면까지. 신규 개념 4개로 축소, 버퍼 20min 확보.
  - **6회**: 앞 35min을 **실배포 실습**(5회 로컬 페이지 → 인터넷 URL)으로 채움 → 클릭쇼 약점 제거. 이어서 Google Cloud Console 한 곳만 깊게.
- **남은 주의(5회)**: TS는 여전히 "동작하는 페이지" 한정으로 이론 최소화 권장 (본 MCP가 TS라 친숙 → 가능).

### 6회차 — Google 단일화로 클릭쇼 해소

- **방어 장치(반영됨)**: 앞부분 실배포 + 뒷부분 **"키 발급 → Google API 호출 1건 성공"** 강제. 둘러보기 아닌 실연동.
- **Google 단일 선택 근거**: 3사를 얕게 훑기보다 1사를 깊게 → 앱등록→OAuth→키→호출 전 과정 완주. Kakao/Naver는 동일 패턴이라 자료 자습 가능.
- **적합성 강점**: Sheets API = 재무/리포트 실무 직결. Naver Search Ad 인증은 본 MCP(3회)에서 이미 경험 → Naver 별도 실습 불필요.
- **주의**: Google Cloud 콘솔 UI 자주 변경 → 강의 직전 스크린샷 갱신. 결제 계정 등록 요구 API 있음 → **무료/결제 불필요 API(Sheets 등)로 실습 한정** 권장.

### 7회차 — 난이도 최고 + 캡스톤

- 가장 어려움(서버·배포·네트워크 동시). **3회 로컬 MCP 미완료자는 7회 따라오기 사실상 불가** → 하드 선행조건으로 명시.
- **적합성 강점**: 1회에 약속한 R(무인 실행)을 여기서 실증 → 강의 서사 완결. 캡스톤으로 최적 배치.
- **주의**: Railway 무료 티어 슬립/비용·콜드스타트 → 강의 중 사전 안내. gstack 스킬 버전 변동 가능 → 직전 점검.

### 회차 간 연속성 점검 (재교육 방지)

- 환경변수(`.env`/accounts.json) = **3회 완료** → 5·6·7회는 **참조만**, 재교육 금지.
- git/GitHub clone/pull/push = **2회 완료** → 5회 Vercel·7회 Railway 자동배포에서 **재사용**, 재교육 금지.
- API 인증·크롬 Network 크롤링 = **4회 완료** → 6회 OAuth는 그 **확장**으로 연결.

### 종합 권고

- **분산 후 난이도 곡선**: 7회(고난도, 캡스톤) > 6회(배포+인증) > 5회(DB+로컬웹). 완만한 상승 곡선 확보.
- 5회 과부하·6회 클릭쇼 두 리스크를 Vercel 이동 한 번으로 동시 해소. 남은 변수는 7회 난이도뿐 → **3회 로컬 MCP 완료**를 7회 전 반드시 점검.
- 콘텐츠 총량은 동일(빠진 것 없음). 단지 Vercel 배포의 위치만 5→6 이동.
