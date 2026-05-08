# Codex Adversarial Review — weekly-report-automation-plan v1.0

검토 범위: 최종 plan, architect/critic 3라운드, 사용자 원본 workflow/docx, AI comment 기획안 v2.0, 샘플 HTML. 전제는 "Claude 패밀리 내부 합의는 blind spot을 남길 수 있다"이다.

## 1. 근본 가정 재검토

plan은 Live Artifact를 사실상 production 검토 UI로 둔다. 그러나 Anthropic 공식 도움말은 artifact를 "대화 우측의 독립 창"과 copy/download, Claude에게 수정 요청하는 흐름까지만 설명한다. artifact에서 로컬 stdio MCP로 직접 콜백하는 공식 브리지는 이번 검토에서 확인되지 않았다. 반면 샘플 HTML은 `sendReport()` 토스트만 띄우는 시연 코드다. 즉 [plan 41행](/Users/edb_development/workspace/ProjectMarketing/naver-ads-mcp/docs/exec-plans/active/weekly-report-automation-plan.md:41)의 발송 UX는 원본 요구가 아니라 프로토타입 가정에 가깝다. 또한 workflow 원문은 데일리 점검이 "최소 30분~최대 2시간"이며 우선순위 판단까지 AE가 직접 한다고 적는다. 이 업무는 단순 preview보다 세션 지속성, 히스토리, 재오픈성이 중요하다. Artifact-only 접근이 진짜 fit인지 아직 미검증이다.

## 2. 숨은 위험

가장 큰 누락은 외부 전송 정당성이다. plan은 Anthropic API 호출을 전제하지만 광고주 KPI, 수신자, 메일 제목, 코멘트가 계약상 제3자 제공 금지인지 묻지 않는다. 이는 법률보다 먼저 계약/NDA 문제다. 한국 개인정보보호법과 개인정보위의 2025 생성형 AI 안내서 관점에서도, 광고주 담당자 이름·이메일이 payload나 prompt에 들어가면 처리 근거와 최소수집 설계가 필요하다. 표시광고법상 "AI 사용 사실 고지 의무"를 본 검토에서 명시 조문으로 확인하진 못했지만, 허위·과장 리스크는 남는다. 지금 plan의 0 hallucination 담론은 품질 문제로만 쓰였고, 법적/계약적 책임 구조로 확장되지 않았다. 여기에 AE 노트북 한 대가 Naver 키, Anthropic 키, 발송 이력, 광고주 데이터를 모두 쥐는 구조라 분실·RAT·퇴사 시 손해 경계가 과도하게 집중된다.

## 3. 플랜이 미처 못 본 것

원본 v2.0은 3단계 파싱의 2단계를 "AE 수동 매핑 저장 UI", 5단계를 DB 저장, 6단계를 TipTap 검토 UI로 상정했다. 그런데 LOCKED plan은 같은 난도를 MCP 내부 서비스와 로컬 JSONL로 압축했다. 이 축소가 불가능하다고 단정할 수는 없지만, 난도 재평가가 없다. 특히 택스아이는 SA+브랜드검색+파워컨텐츠 복합인데 plan은 택스아이를 artifact 렌더 acceptance에 넣으면서도 브랜드검색/파워컨텐츠 누락 고지를 별도 설계하지 않았다. 사용자 원본 업무 문서가 요구한 것은 "광고주별 톤·강조점 차이"를 반영한 보고다. 그런데 plan의 95% 숫자 매칭 게이트는 문장 정확성, 비교표현, 톤 적합성, omission을 충분히 잡지 못한다.

## 4. 8.5주 일정 현실성 의심

8.5주는 Claude review 라운드 안에서는 정합적으로 보이지만, 사람 수가 사라져 있다. 1인 개발 기준이면 parser 1.5주, AI+artifact 2.5주, 이메일 1주, 데일리 0.5주 병렬은 낙관적이다. workflow 원문상 주간 리포트 작성만 계정당 1~2시간, 인사이트 30분~1시간, 메일 10~20분이다. 이 정도 업무를 줄이는 자동화라면 AE 피드백 루프가 빡빡해야 하는데 파일럿 표본은 n=2 이상뿐이다. 만족도 4/5와 0 hallucination 인스턴스 0건을 acceptance로 두는 순간, 통계보다 "사고가 아직 안 난 것"을 성공으로 오인할 위험이 크다.

## 5. 놓친 대안

plan은 A/B/C만 비교했지만 더 작은 옵션을 충분히 밀어보지 않았다. 예를 들어 1차 ship을 "기존 엑셀 + MCP가 markdown/HTML 코멘트와 EML 초안만 생성 + AE가 메일 클라이언트에서 검토 발송"으로 두면 계약·보안·UX 리스크를 크게 줄일 수 있다. 샘플 HTML 자체도 인라인 편집과 발송 버튼을 보여주지만 실제로는 시연이다. 그렇다면 artifact는 preview에만 쓰고, 운영 산출물은 markdown/EML로 제한하는 편이 더 정직하다. same-family critic 4라운드는 기존 방향을 정교화하는 데는 성공했지만, "artifact를 꼭 production 중심에 둬야 하는가"라는 질문은 끝까지 뒤집지 못했다.

## Verdict

**CONDITIONAL**

현재 v1.0은 "구현 가능한 설계"라기보다 "한 방향으로 매우 잘 다듬어진 가설"에 가깝다. Phase 1 착수 전 최소 조건은 세 가지다: 광고주 데이터의 Anthropic 전송에 대한 계약/법무 확인, 실제 Claude Desktop seat/usage 운영 가정 확정, 택스아이 등 복합 매체의 누락 고지 정책 확정.

## 가장 큰 단일 Risk

광고주 KPI·수신자 정보·리포트 문안을 외부 LLM으로 보내는 행위에 대한 계약상/법적 승인 부재. 이 한 항목이 해결되지 않으면 artifact UX나 일정 추정이 맞아도 운영 개시는 방어되지 않는다.

## ralplan이 놓친 핵심 질문

1. 광고주별 계약서/NDA에 AI 분석·외부 API 전송 허용 조항이 있는가, 없으면 어떤 비식별화 수준에서만 허용되는가?
2. 실제 운영 seat는 Claude Pro/Max/Team 중 무엇이며, 월 156회+재호출+첨부파일+artifact 사용이 월요일 피크에 버티는가?
3. 택스아이의 브랜드검색·파워컨텐츠처럼 현재 데이터가 비완전한 광고주는 고객-facing 문서에 어떤 누락 고지와 수동 보완 절차를 넣을 것인가?

## 외부 확인 메모

- Anthropic artifact/help: https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them
- Claude usage limits: https://support.claude.com/en/articles/8324991-about-claude-s-pro-plan-usage , https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work
- Anthropic MCP connector limitation: https://platform.claude.com/docs/en/agents-and-tools/mcp-connector
- 개인정보보호위원회 생성형 AI 안내서 공지: https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030000&nttId=11439
- 개인정보 보호법: https://law.go.kr/LSW/lsInfoP.do?lsId=011357
- 표시ㆍ광고의 공정화에 관한 법률: https://www.law.go.kr/lsInfoP.do?ancYnChk=0&lsId=002011
