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
