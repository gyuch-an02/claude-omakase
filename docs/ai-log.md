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

## 2026-05-31 — propose_new_skill 샘플링 안전장치 강화

1. `propose_new_skill`이 MCP 호스트의 `sampling/createMessage` 지원 여부를 먼저 감지하고, 지원되지 않을 때 명확한 오류를 반환하도록 수정했다.
2. 샘플링 또는 `draft_body`로 받은 `SKILL.md` 초안을 디스크에 쓰기 전에 YAML frontmatter, 필수 섹션, 트리거, 카탈로그 Entry 형태로 검증하도록 했다.
3. 초안에 npm, npx, pip, pipx, uvx 설치 명령이 포함된 경우 공개 레지스트리에서 패키지 resolvability를 확인한 뒤에만 쓰기를 허용하도록 했다.
4. 잘못된 초안이나 해석할 수 없는 설치 명령은 `~/.claude/skills/` 아래에 `SKILL.md`를 남기지 않도록 쓰기 순서를 검증 이후로 옮겼다.
5. 정상 샘플링, 샘플링 미지원, 잘못된 초안, 해석되지 않는 설치 명령을 각각 확인하는 테스트를 추가했다.
