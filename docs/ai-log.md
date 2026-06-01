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

## 2026-06-01 — CI 트리거 확인, adapter 자동 머지, 카탈로그 롤백 문서화

1. `.github/workflows/ci.yml`이 이미 `pull_request:` 트리거를 포함하고 있어, 모든 PR에서 CI가 도는 것을 확인했고 별도 변경은 필요하지 않았다.
2. `.github/workflows/auto-merge-adapter.yml`을 추가하여 `adapter` 레이블이 붙은 PR에 대해 `gh pr merge --auto --squash`로 GitHub 자동 머지를 활성화하도록 구성했다.
3. 자동 머지는 저장소 설정의 "Allow auto-merge"와 `main` 브랜치 보호 규칙의 CI 상태 체크 필수화가 켜져 있어야 동작하므로, 워크플로 헤더에 필요한 설정을 명시했다.
4. `docs/catalog-rollback.md`를 작성하여 카탈로그 리프레시 PR이 실패한 경우의 복구 절차(PR 닫기, 머지 커밋 revert, 특정 커밋에서 catalog.json 복원)를 문서화했다.
5. `git show origin/main:catalog.json | head`로 main에서 이전 catalog.json(12,144줄)을 실제로 복구할 수 있음을 확인하고, 변경 사항은 `.gitignore` 화이트리스트와 함께 한 커밋으로 묶었다.
