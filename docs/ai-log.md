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

## 2026-05-31 — 어댑터 자동 병합 및 카탈로그 롤백 검증

1. `.github/workflows/adapter-auto-merge.yml`을 추가하여 `adapter` 라벨이 붙은 비초안 PR에 GitHub auto-merge를 설정하도록 했다.
2. `docs/automation.md`에는 자동 병합의 전제 조건, 검증 절차, 잘못된 `catalog.json` 갱신을 되돌리는 절차를 문서화했고 `.gitignore`에는 이 문서를 추적하도록 예외를 추가했다.
3. `scripts/verify-catalog-rollback.mjs`와 `npm run verify:catalog-rollback`은 임시 worktree에서 고의로 나쁜 카탈로그를 만든 뒤 기준 브랜치의 카탈로그로 복구되는지 확인한다.
4. `CONTRIBUTING.md`에는 작은 어댑터 PR이 `adapter` 라벨로 자동 병합 경로를 사용할 수 있다는 안내를 추가했다.
5. 이 변경은 PR에서 실행되는 CI, 자동화 문서, 롤백 검증 명령을 함께 묶어 #15의 자동화 요구사항을 재현 가능한 형태로 남긴다.

## 2026-05-31 — omakase 추천 UX 리뷰 반영

1. `src/tools/recommend.ts`에서 첫 세션 starter-pack 경로도 사용자의 context와 `limit`을 적용해 한 번에 하나의 추천만 반환하도록 수정했다.
2. `src/tools/recommend.test.ts`를 추가하여 첫 세션 추천이 브라우저 테스트 context에서 `playwright` 하나만 고르고, 명시적 `limit`도 지키는지 검증했다.
3. 이 변경은 `omakase-chef/SKILL.md`가 요구하는 메뉴 없는 omakase UX와 실제 도구 반환값이 어긋나지 않도록 맞춘 것이다.
4. 테스트는 임시 캐시, 설정, 데이터, 스킬 디렉터리를 사용해 사용자의 실제 로컬 상태를 건드리지 않도록 구성했다.
5. Claude-assisted 리뷰 수정 사항과 이 AI 사용 로그 항목은 같은 커밋에 포함된다.

## 2026-05-31 — 데모 준비 및 README 정확도 개선

1. `README.md`의 아키텍처 다이어그램에서 오래된 카탈로그 항목 수 "~115 entries"를 실제 수치인 "400+ skills"로 수정하고, MCP 도구 표에서 누락된 `set_profile` 항목을 추가했다.
2. `docs/demo-script.md`를 신규 작성하여 Day 7 라이브 데모의 setup 절차, Act 1–4 진행 흐름, Q&A 준비 내용을 포함한 5–7분 분량의 데모 스크립트를 정리했다.
3. `docs/distribution/hn-post.md`와 `docs/distribution/discord-post.md`를 작성하여 Show HN, Anthropic Discord, Twitter/X 스레드용 배포 초안을 준비했다.
4. `.gitignore`에 `!docs/demo-script.md` 예외 규칙을 추가하여 `docs/*` 일괄 무시 패턴에서 데모 스크립트가 추적되도록 수정했다.
5. 변경된 파일은 `.gitignore`, `README.md`, `docs/ai-log.md`, `docs/demo-script.md`, `docs/distribution/hn-post.md`, `docs/distribution/discord-post.md`이며 이 항목과 함께 동일 커밋에 포함된다.
