# Pre-Implementation Checklist

## 구조/공통화

- [ ] TDD: 실패하는 테스트 먼저 작성
- [ ] 함수 50줄 이하, 매개변수 4개 이하, 중첩 3단계 이내
- [ ] try-catch에서 에러 삼키지 않기
- [ ] import 방향 준수 (L1 ← L2 ← L3 ← L4 ← L5)
- [ ] 매직 넘버는 const로 추출
- [ ] Search Before Building: 기존 모듈 재사용 가능한가?

## 데이터/성능

- [ ] 루프 내 await 직렬 → Promise.all 병렬화 검토
- [ ] N+1 호출 없는가?
- [ ] 캐시 가능 데이터에 TTL/무효화 명시

## 보안

- [ ] 자격증명을 로그/에러 메시지에 노출하지 않는가?
- [ ] 새 secret은 enumerable=false 패턴 사용?
- [ ] HMAC 서명: SECRET_KEY 헤더 비전송 유지?

## 테스트

- [ ] 새 기능마다 단위 테스트
- [ ] 외부 API는 mock으로 격리 (live 호출 금지)
- [ ] credentials-required 테스트는 marker로 분리

## 문서

- [ ] AGENTS.md / ARCHITECTURE.md 업데이트 필요?
- [ ] tech-debt-tracker.md에 새 부채 추가?
- [ ] README의 MCP tool 목록 동기화?
