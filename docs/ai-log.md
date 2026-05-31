# AI Usage Log

A running record of Claude-assisted changes to this repository. Each entry is a
dated heading followed by five Korean sentences, appended on every Claude-assisted
commit. See [`CLAUDE.md`](../CLAUDE.md) → "Skill: ai-usage-log".

## 2026-05-28 — AI 사용 로그 도입 및 환각 검증 프로토콜 추가

1. LLM이 생성한 카탈로그 항목을 검증하기 위한 환각 검증 프로토콜을 `docs/ai-protocol.md`에 문서화했다.
2. 이 프로토콜은 스키마 검증, 설치 가능성(HTTP 200) 확인, HTTPS 소스 강제라는 세 가지 관문으로 구성된다.
3. 루트에 `CLAUDE.md`를 추가하여 ai-usage-log 스킬을 채택하고, Claude가 도운 모든 커밋마다 이 파일에 한국어 5문장 로그를 남기도록 규정했다.
4. `.github/workflows/ai-log-check.yml` 워크플로를 추가하여 `docs/ai-log.md` 항목이 없는 PR을 자동으로 표시(체크 실패)하도록 했다.
5. 모든 변경은 기존 저장소 규칙(`handpicked/README.md` 감사 체크리스트와 `scripts/test-adapter.mjs` 검증 로직)을 따르며, 한 커밋으로 함께 기록했다.

## 2026-05-31 — AI 로그 확인 워크플로 완화

1. `.github/workflows/ai-log-check.yml`의 누락 로그 감지를 실패가 아니라 경고로 바꾸어 일반 PR을 불필요하게 막지 않도록 조정했다.
2. 이번 변경은 `CLAUDE.md`가 요구하는 ai-usage-log 규칙을 유지하면서도 자동화가 모든 PR을 강제로 차단하지 않게 만든다.
3. `docs/ai-log.md`에는 이 조정 내용을 같은 커밋에 기록하여 실제 사용 예시를 하나 더 남겼다.
4. 경고 메시지는 여전히 한국어 5문장 로그를 요구하므로 리뷰어가 Claude-assisted 변경 여부를 확인할 수 있다.
5. 이 변경은 #12의 best-effort PR 체크 목적과 기존 오픈소스 기여 흐름을 함께 만족하도록 커밋된다.
