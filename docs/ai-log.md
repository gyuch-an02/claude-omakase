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

## 2026-06-01 — 능동적 온보딩: tool 응답 next_step 힌트 + SKILL.md 트리거 튜닝

1. `src/tools/find-skill.ts`, `src/tools/recommend.ts`, `src/tools/install-skill.ts`의 반환 객체에 `next_step` 필드를 추가하여 Claude가 검색·추천·설치 직후 무엇을 해야 하는지(단일 추천 제시, 승인 대기, 설치 후 트리거 문구 안내)를 응답 content로 직접 전달하도록 했다.
2. MCP Prompts·resources·mcpContextUris·spontaneous sampling은 Claude Code CLI에서 세션 시작 시 자동 트리거되지 않음을 claude-code-guide로 검증했고, 검증된 메커니즘인 tool content 힌트와 SKILL.md 자동 로드만 사용했다.
3. `omakase-chef/SKILL.md`의 `description`을 세션·프로젝트 시작, "뭘 설치/사용할까" 질문, 미설치 상태, 3회 반복 신호에 더 잘 매칭되도록 확장하여 능동 트리거 범위를 넓혔다.
4. 같은 SKILL.md 첫 세션 절차에 설치 후 같은 세션에서 `~/.claude/skills/<id>/SKILL.md`를 직접 읽어 즉시 사용하는 경로를 명시하여, 다음 세션까지 기다리지 않아도 가치를 얻도록 했다.
5. `next_step` 힌트는 `_meta`가 아닌 응답 content에 넣어 모델이 실제로 읽도록 했고, build·typecheck·lint(src 0건)·43개 테스트 통과를 확인한 뒤 이 로그 항목과 동일 커밋에 포함한다.

## 2026-06-01 — starter-pack-gap 모드: 미설치 스타터 스킬 자동 추천

1. `src/tools/recommend.ts`에 `starter-pack-gap` 모드를 추가하여, 일부 스킬이 설치된 사용자라도 starter-pack 태그 스킬 중 미설치 항목이 있으면 그중 가장 적합한 하나를 추천하도록 했다.
2. 설치 식별은 Omakase 영수증 id와 `~/.claude/skills/` 디렉터리명을 합집합한 `installedIdSet` 헬퍼로 계산하고, 모든 추천 경로(verified-defaults·profile-search 포함)에서 이미 설치된 스킬을 제외하도록 수정했다.
3. `omakase-chef/SKILL.md`에 "incomplete starter pack" 트리거를 추가하여 Claude가 세션 시작 시 조용히 `recommend_skills`를 호출하고 `starter-pack-gap` 응답이면 빠진 스킬 하나만 제안하도록 안내했다.
4. `src/tools/recommend.test.ts`에 미설치 스타터 스킬 추천과 완비 시 verified-defaults로 폴백하는 두 테스트를 추가했고, 격리 하네스가 설치된 스킬 디렉터리를 시뮬레이션하도록 확장했다.
5. build·typecheck·lint(src 0건)·45개 테스트 통과를 확인했고 이 로그 항목과 동일 커밋에 포함한다.

## 2026-06-01 — starter-pack-gap 버그 수정 + 세션 시작 자율 온보딩 강화

1. `src/tools/recommend.ts`에서 `starter-pack-gap` 모드를 `query.length === 0` 대신 명시적 요청 부재(`!ask`)로 게이트하도록 고쳐, 프로필을 저장한 사용자가 프로필 토큰 때문에 갭 추천을 영구히 건너뛰던 버그를 제거하고 프로필은 미설치 스타터 순위 결정에만 쓰도록 했다.
2. Codex(gpt-5.5)와 read-only 리뷰로 의논하여 공백만 있는 `context("   ")`가 갭을 잘못 억제하는 엣지를 확인하고 trim 후 빈 값을 `undefined`로 정규화했으며, `src/tools/find-skill.ts`의 "항상 목록을 보여주라"는 메뉴형 설명을 단일 추천 오마카세 방식으로 교체했다.
3. `omakase-chef/SKILL.md`에 "세션 시작(모든 상태)" 결정적 루틴을 추가하고 `src/tools/list-installed.ts` 응답에 `installed_count`와 `next_step` 라우팅을 넣어, 빈 세션이면 첫 세션 흐름·기존 사용자면 무맥락 `recommend_skills` 호출로 갭을 1회만 제안하도록 자율 동작을 결정화했다.
4. `src/e2e/flow.test.ts`를 신규 작성하여 MCP 추가→스캔→갭→설치→완비→find_skill→propose_new_skill 전체 흐름을 격리 파일시스템·로컬 카탈로그·무네트워크(빈 `skill_files`, `draft_body`)로 재현 가능하게 검증하고, `recommend.test.ts`에 공백 context·명시 요청의 갭 억제·프로필 순위 3개 엣지 테스트를 추가했다.
5. typecheck·build·lint(src 0건)·테스트 49개 전부 통과를 확인했고 catalog.json은 변경하지 않았으며 이 로그 항목과 동일 커밋에 포함한다.

## 2026-06-01 — 검색 품질·설치 카운트 버그 수정 (0.2.2)

1. `src/tools/list-installed.ts`에서 `installed_count`를 `receipts.length + skills.length`로 더해 영수증과 디렉터리를 중복 집계하던 버그를 id 합집합 Set 크기로 고쳐 `recommend_skills`와 동일하게 distinct 개수를 보고하도록 했다.
2. `src/catalog/sanitize.ts`를 신규 작성하고 `src/catalog/cache.ts` 로드 경로에 연결하여, 스크레이핑으로 태그에 섞인 HTML 조각(`<a`, `name="developer` 등)을 런타임에서 제거해 이미 배포된 catalog.json도 재빌드 없이 정제되도록 했다.
3. `src/adapters/awesome-mcp.ts`의 태그 생성에서 카테고리·이름의 HTML을 먼저 제거하고 `sanitizeTags`로 정규화하여 오염의 근본 원인을 차단했으며, 미사용이 된 `dedupe` 헬퍼를 제거했다.
4. `src/tools/recommend.ts`의 profile-search 랭킹을 프로필+컨텍스트 결합 질의 대신 명시적 요청(`ask`)이 있으면 그것으로만 정렬하도록 바꿔 프로필(frontend)이 실제 요청(code review)을 이기던 문제를 해결했고, `src/server.ts`의 하드코딩된 `serverInfo.version("0.1.0")`을 package.json에서 읽도록 고치며 import 시 부팅을 막는 엔트리포인트 가드를 추가했다.
5. sanitize·list-installed·recommend·awesome-mcp·server 테스트 9건을 추가해 typecheck·build·lint(src 0건)·테스트 58개 전부 통과를 확인했고 catalog.json은 변경하지 않았으며 이 로그 항목과 동일 커밋에 포함한다.

## 2026-06-01 — 스타터팩 체크리스트 온보딩 + 결정적 반복 감지 훅 (0.2.3)

1. `src/tools/recommend.ts`의 `starter-pack`(미설치)과 `starter-pack-gap`(일부 설치) 두 모드를, 단일 추천 대신 관련도순으로 정렬한 전체/누락 스타터 스킬을 모두 반환하고 `present_as: "checklist"` 플래그를 다는 방식으로 바꿔 사용자가 한 번에 여러 개를 골라 설치할 수 있게 했다.
2. 이 동작은 오마카세의 "한 번에 하나만 제안한다" 원칙의 유일한 예외이므로 `omakase-chef/SKILL.md`의 첫 세션·세션 시작·incomplete starter pack·hard rule 네 곳과 `recommend.ts` 도구 설명에 "온보딩 예외=체크리스트" 규칙을 명시해 다른 모드는 여전히 단일 추천을 유지하도록 했다.
3. 모델의 주관적 판단에만 의존하던 "3회 반복" 트리거를 데모에서 확실히 동작시키기 위해 `hooks/omakase-repetition.mjs`(PostToolUse(Bash) 훅)를 새로 작성했고, 명령 시그니처를 세어 단일 명령과 체인·분리 호출 멀티스텝 워크플로(n-gram 연속 반복 감지)를 모두 잡아 3회째에 `find_skill` 호출을 결정적으로 주입하도록 했다.
4. `src/tools/recommend.test.ts`와 `src/e2e/flow.test.ts`의 기존 "정확히 하나" 단언을 체크리스트 동작(전체/누락 전부 반환, `present_as` 확인, 다중 누락)으로 갱신하고 신규 테스트를 추가했으며, 훅은 `files` 필드에 없어 npm에 게시되지 않고 `install.sh`에도 미연결인 레포 자산임을 유지했다.
5. typecheck·build·lint(src 0건)·테스트 58개 전부 통과를 확인했고 `package.json` 버전을 0.2.3으로 올렸으며 catalog.json은 변경하지 않았고 이 로그 항목과 동일 커밋에 포함한다.

## 2026-06-01 — 라이프사이클 도구 살리기 (#67 재베이스, 0.2.4)

1. PR #67(`feat/lifecycle-tools`)이 오래된 베이스 위에 있어 그대로 머지하면 `server.ts`의 `packageVersion()`·테스트용 부팅 가드와 `recommend.ts`의 starter-pack-gap·프로필·체크리스트 작업을 조용히 되돌리는 회귀가 발생함을 trial 머지로 확인했다.
2. 그래서 현재 `main` 기준 새 브랜치에 #67의 신규 도구 3개(`src/tools/uninstall-skill.ts`·`update-skill.ts`·`doctor.ts`)만 그대로 가져오고, 이들이 현재 `paths`·`installer/code-skills`·`types` API와 호환됨을 검증했다.
3. `src/server.ts`에는 회귀를 빼고 세 도구의 import와 등록만 추가했으며, `src/tools/recommend.ts`의 profile-search 분기를 early-return으로 재구성해 #67의 가치 있는 부분인 `match_score`·`match_reasons`를 살리되 다른 모드의 단일 추천·체크리스트 동작은 그대로 유지했다.
4. 순수 파일시스템 동작인 `uninstall_skill`(멱등 삭제)과 `doctor_skills`(정상/손상 분류), 그리고 zod 스키마의 경로 탈출 id 거부를 검증하는 `src/tools/lifecycle.test.ts`를 신설했다.
5. typecheck·build·lint(src 0건)·테스트 61개 전부 통과를 확인하고 `package.json`을 0.2.4로 올렸으며 catalog.json은 변경하지 않았고 이 로그 항목과 동일 커밋에 포함한다.

## 2026-06-01 — 반복 감지 훅 셸 키워드 오탐 수정

1. `hooks/omakase-repetition.mjs`가 명령을 `;`·`&&`·줄바꿈으로 쪼개 첫 토큰을 시그니처로 셀 때, `for … done` 루프의 `done`이나 `cat <<'EOF' … EOF` 히어독의 `EOF` 같은 셸 키워드가 반복 작업으로 오탐되던 문제를 확인했다.
2. 원인은 SKIP 집합이 사소한 명령만 담고 제어 흐름 키워드와 히어독 구분자를 포함하지 않았던 것이다.
3. SKIP에 `do`·`done`·`then`·`else`·`fi`·`for`·`while`·`if`·`function` 등 제어 키워드와 `EOF`·`EOL`·`END` 히어독 구분자, 그리고 `read`·`test`·`eval` 등 추가 셸 빌트인을 넣었다.
4. 격리 검증으로 `for/done` 루프와 `EOF` 히어독을 3회 반복해도 침묵하고, 실제 반복 명령(`pytest` 3회)은 여전히 감지·주입함을 확인했다.
5. 훅은 npm `files`에 없어 패키지 버전과 무관하므로 버전은 올리지 않았고 catalog.json도 변경하지 않았으며 이 로그 항목과 동일 커밋에 포함한다.

## 2026-06-01 — 관리 TUI·제안 렌더링·선제 제안 훅·OSS 템플릿 (0.3.0)

1. 설치된 스킬을 나열·헬스체크·업데이트·삭제하는 대화형 TUI(`src/cli/tui.ts`)를 `@clack/prompts`로 추가하고, `src/server.ts`가 `tui`/`manage` 서브커맨드면 TUI를, 인자 없으면 기존 stdio MCP 서버를 띄우도록 분기시켰으며 `package.json`에 `omakase` bin과 의존성을 더했다.
2. `@clack/prompts`는 최신 1.x가 Node `styleText`(≥20.12)를 요구해 구버전에서 깨지므로 picocolors 기반 0.7.0으로 핀했고, non-TTY 환경에서는 안내 후 종료하는 가드를 넣었으며 Node 18·20에서 렌더링을 확인했다.
3. 제안을 채팅에서 예쁘게 보여주기 위해 `src/catalog/render.ts`(마크다운 테이블·체크리스트)를 신설해 `recommend_skills`·`find_skill` 응답에 `rendered` 필드를 추가하고, `omakase-chef/SKILL.md`가 그 필드를 그대로 출력하도록 안내했다.
4. 명시적 요청 없이도 프롬프트를 카탈로그와 매칭해 미설치 스킬을 세션당 1회(쿨다운) 제안하는 `hooks/omakase-suggest.mjs`(UserPromptSubmit)를 반복감지 훅·`propose_new_skill`과 별개로 추가했고, README에 용례 5종·TUI·훅 섹션과 OSS 기여용 "스킬 제안" 이슈 템플릿·`config.yml`을 마련했다.
5. typecheck·build·lint(src 0건)·테스트 66개(렌더·라이프사이클 포함) 전부 통과를 확인하고 `package.json`을 0.3.0으로 올렸으며 catalog.json은 변경하지 않았고 이 로그 항목과 동일 커밋에 포함한다.
