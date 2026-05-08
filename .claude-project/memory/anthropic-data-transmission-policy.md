---
name: anthropic-data-transmission-policy
description: 광고주 KPI/수신자/메일 본문을 Anthropic API로 전송하는 행위에 대한 계약·법적 정책 (NDA 허용 확인됨, PII 최소화·점검 게이트 의무)
type: project
created: 2026-05-08
---

helloMAX 자동화 플랜에서 광고주 KPI·수신자·메일 본문을 Anthropic API로 전송하는 것에 대한 정책. Codex adversarial 리뷰의 최대 단일 risk 항목이었고, 사용자가 답변으로 해소했으나 운영 가드는 유지.

**확인된 사실**:

- 광고주 NDA에 AI 분석 + 외부 API 전송 허용 조항 존재 (사용자 2026-05-08 확인)
- 운영 Claude seat: Max plan

**의무 가드** (plan §Risk + Phase 0 PoC에 박힘):

1. **PII 최소화 prompt 설계** — 수신자 이메일은 SHA256 hash로 변환 후 prompt 전달. 광고주명은 client_id 마스킹 옵션(톤 유지 위해 회사명 필요할 수 있어 trade-off는 Phase 0에서 결정)
2. **개인정보위 2025 생성형 AI 안내서 점검 1회** (Phase 0 산출물)
3. **2026 광고주 계약 갱신 시 AI 사용 조항 명시 권장** (Follow-up)
4. **history JSONL의 recipient·subject는 SHA256 해시로만 저장** (PII 영속 0)

**금지**:

- 광고주 자격증명(`accessLicense`, `secretKey`)은 절대 prompt에 포함 금지 (이건 자동화 시스템 내부값이지 분석 대상 아님)
- Anthropic 키(`sk-ant-`) 자체가 prompt나 history JSONL에 노출되는 일 없도록 `enumerable:false` 패턴 유지

**Why:** Codex adversarial 리뷰에서 "광고주 데이터의 외부 LLM 전송에 대한 계약/법적 승인 부재"가 v1.0 plan의 단일 최대 risk였음. NDA 허용으로 1차 차단은 풀렸으나 한국 개인정보보호법·개인정보위 안내서·2026 광고주 계약 갱신 등 부수 이슈가 남아 명시 가드로 박아둠. 이 메모가 없으면 다음 세션에서 PII 최소화·점검 게이트가 의무 사항이 아닌 권장으로 약화될 가능성.

**How to apply:** Phase 0 PoC 진입 시 PII 최소화 prompt 설계 항목을 반드시 Phase 0 산출물에 포함. Phase 4 runbook에서 history JSONL 백업 정책과 함께 전송 데이터 형식의 PII 회귀 검증 추가. 광고주별 `client-mappings.json`에 NDA 동의 일자·동의 범위 메타 필드 추가 검토.
