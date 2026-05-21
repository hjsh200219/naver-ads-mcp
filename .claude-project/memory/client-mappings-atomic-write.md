---
name: client-mappings-atomic-write
description: client-mappings.json atomic write 패턴 (temp + rename + advisory lock)
type: project
created: 2026-05-21
---

`src/runtime/client-mappings-writer.ts` (commit 42bce5b)는 multi-process 안전한 registry 갱신 패턴 구현. 동시 register_client 호출이 서로 덮어쓰지 않도록 직렬화.

**구현 요소**:

- `proper-lockfile` advisory lock — sentinel 파일(`<target>.lock`)에 lock. retries 20, stale 10s
- temp 파일 (`<target>.<pid>.<ts>.tmp`) write → `fs.rename` (atomic, partial-write 방지)
- 쓰기 전 `ClientMappingsFileSchema.parse` (zod) — schema invalid 시 throw, 파일 원본 유지
- `ClientMappingsWriteError` — 중복 + `overwrite:false`일 때 throw
- mode `0o600` (PII 보호)

**테스트 커버리지** (tests/client-mappings-writer.test.ts, 9 cases):

- 단건/2건 추가
- 중복 거부 (`overwrite=false` → throw)
- overwrite=true (replace + 필드 갱신)
- schema rejection (non-kebab, missing recipients)
- 기존 entries 보존
- trailing newline (POSIX)
- concurrent serialize: `Promise.all`로 4건 동시 upsert → 모두 보존

**Why:** lock 없으면 race condition (lost write). non-atomic write는 partial-state 노출.

**How to apply:** 다른 mutable registry(예: config 파일) 도구 추가 시 동일 패턴 재사용. `upsertClientMapping`을 generic으로 일반화 가능.

관련: [[register-client-tool-pattern]], [[v1.6-lock-semantics-serialize-only]].
