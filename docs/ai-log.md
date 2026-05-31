# AI Usage Log

A running record of Claude-assisted changes to this repository. Each entry is a
dated heading followed by five Korean sentences, appended on every Claude-assisted
commit. See [`CLAUDE.md`](../CLAUDE.md) → "Skill: ai-usage-log".

## 2026-05-31 — AI 사용 로그 및 환각 검증 프로토콜 문서화

1. `CLAUDE.md`, `docs/ai-protocol.md`, `docs/ai-log.md`를 추가하여 Claude-assisted 변경의 기록 방식과 환각 검증 절차를 문서화했다.
2. 환각 검증 프로토콜은 `src/types.ts`의 `Entry` 형태 확인, `scripts/test-adapter.mjs`로 설치/URL resolvability 확인, 그리고 HTTPS 소스 강제를 핵심 관문으로 삼는다.
3. `.github/workflows/ai-log-check.yml`은 PR에서 `docs/ai-log.md` 변경이 없을 때 실패 대신 `::warning::`으로 표시하도록 구성했다.
4. `.gitignore`의 `docs/*` 예외 목록에 AI 문서를 추가하여 저장소에서 추적되도록 했다.
5. 위 변경을 같은 커밋에 함께 포함하고, 이 항목을 ai-usage-log 규칙에 따라 한국어 5문장으로 기록했다.
