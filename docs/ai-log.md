# AI 사용 로그 — 2026-05-26 (Gyuchan An)
- 무엇을: PRD 초안 작성 후 GitHub Issue #1로 발행
- 요청: /to-prd 슬래시 커맨드로 현재 대화 context 기반 PRD 재작성 요청
- AI 제안: deep/shallow 모듈 구분 + 24개 user story + module별 test scope + install safety invariants를 PRD 템플릿에 맞춰 작성하고 gh CLI로 issue 생성 제안
- 사람 검증: 사용자가 module 구분과 test 대상 (catalog/search, installer/code-skills, adapters/anthropic-skills-repo)을 AskUserQuestion으로 확인 완료. PRD 본문 내용은 사용자가 Issue #1에서 직접 검토 필요. ready-for-agent label은 PAT 권한 부족으로 미적용 — 사용자가 수동 적용 필요
- 반영: Issue #1 발행 완료. /tmp/prd-body.md에 로컬 사본 보관. label은 수동 처리 대기

# AI 사용 로그 — 2026-05-27 (Changwook Lee)
- AI 도구: Claude Code
- 무엇을: Seeded verified handpicked OpenAI skill entries and wrote detailed PR/issue notes.
- 관련 작업: PR #34, Issue #28
- 사람 검증: Ran checks and reviewed audit metadata.

# AI 사용 로그 — 2026-05-27 (Changwook Lee)
- AI 도구: Github Copilot / Copilot SWE Agent
- 무엇을: Addressed review feedback on your handpicked entries by pinning mutable raw URLs to commit-specific URLs.
- 관련 작업: PR #35-#38 related to PR #34
- 사람 검증: Reviewed/accepted fixes before merge.

# AI 사용 로그 — 2026-05-27 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Added research-backed evidence to role profile JSON files.
- 관련 작업: PR #39, Issue #29
- 사람 검증: Validated JSON, recommendation IDs, evidence links, CI.

# AI 사용 로그 — 2026-05-27 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Drafted contributor quickstart and opened upstream listing PR.
- 관련 작업: PR #40, Issue #31, TensorBlock PR #602
- 사람 검증: Checked upstream contribution fit and local tests.

# AI 사용 로그 — 2026-05-27 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Fixed catalog/install edge cases that blocked your docs/contributor work.
- 관련 작업: PR #41, Issue #25
- 사람 검증: Added tests for empty catalog, malformed JSON, network fallback, install collision.

# AI 사용 로그 — 2026-05-27 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Polished CONTRIBUTING and quickstart based on timing-run lessons.
- 관련 작업: PR #42, Issue #32
- 사람 검증: Ran local checks and documented warnings/diff hygiene.

# AI 사용 로그 — 2026-05-27 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Added adapter smoke-test reporting.
- 관련 작업: PR #43, Issue #20
- 사람 검증: Ran adapter smoke tests and CI.

# AI 사용 로그 — 2026-05-27 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Made catalog refresh output more stable.
- 관련 작업: PR #44, Issue #13
- 사람 검증: Checked CI/catalog-refresh behavior.

# AI 사용 로그 — 2026-05-27 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Built adapter scaffolding command for contributor DX.
- 관련 작업: PR #45, Issue #26
- 사람 검증: Ran lint, typecheck, build, tests, adapter smoke report.

# AI 사용 로그 — 2026-05-27 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Published adapter timing/distribution writeup.
- 관련 작업: PR #46, Issue #33
- 사람 검증: Reviewed final docs and CI.

# AI 사용 로그 — 2026-05-27 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Refreshed README catalog status.
- 관련 작업: PR #50, Issue #49
- 사람 검증: Checked README against shipped catalog/adapter flow.

# AI 사용 로그 — 2026-05-27 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Restored ESLint v9 lint command.
- 관련 작업: PR #51, Issue #47
- 사람 검증: Confirmed npm run lint worked.

# AI 사용 로그 — 2026-05-29 (Gyuchan An)
- 무엇을: propose-new-skill.ts에 타입별 템플릿 로딩 로직 구현 및 templates/ 파일 placeholder 형식으로 재작성
- 요청: templates/를 propose_new_skill이 실제로 읽어서 task 타입에 따라 적용하도록 구현 요청. silent fallback 금지 조건 포함
- AI 제안: detectType()으로 python-cli/node-script/shell-automation 감지, packageTemplatesDir()을 paths.ts에 추가, renderTemplate()으로 {{slug}} 등 placeholder 치환, 템플릿 없으면 Error throw. PR #54 생성 및 머지
- 사람 검증: typecheck 통과 확인, PR #54 머지 승인. 실제 propose_new_skill 호출 동작 테스트는 미확인
- 반영: main 브랜치에 반영됨 (PR #54)

# AI 사용 로그 — 2026-05-29 (Gyuchan An)
- 무엇을: 누락된 dist/cli/install.js 해결을 위해 src/cli/install.ts 작성, npm Trusted Publishing용 .github/workflows/publish.yml 생성
- 요청: package.json bin에 선언된 claude-omakase-install 파일 생성 및 npm publish 자동화 요청
- AI 제안: install.sh와 동일한 동작을 하는 Node.js CLI(omakase-chef SKILL.md 설치 + MCP 등록 스니펫 출력) 작성. publish.yml은 v* 태그 push 시 OIDC 기반 npm Trusted Publishing으로 자동 게시
- 사람 검증: build 성공 확인. npm Trusted Publishing 설정 및 실제 publish 동작은 미확인 (패키지 미게시 상태)
- 반영: main 브랜치에 커밋됨. npm Trusted Publisher 등록 후 v0.1.0 태그 push 시 게시 예정

# AI 사용 로그 — 2026-05-29 (Gyuchan An)
- 무엇을: mcp-servers-repo, awesome-mcp 두 catalog adapter 구현 및 테스트 작성
- 요청: catalog entry 3개 → 100개 이상으로 늘리기 위해 누락된 adapter 구현 요청
- AI 제안: mcp-servers-repo.ts (modelcontextprotocol/servers README 파싱, verified=true), awesome-mcp.ts (punkpeye/awesome-mcp-servers README 파싱, verified=false) 구현. 각 normalizeMatch/normalizeHit 함수 export하여 단위 테스트 16개 작성. adapters/index.ts에 trust 순서에 맞게 등록
- 사람 검증: typecheck 통과, 테스트 16/16 pass 확인. 실제 network fetch(build-catalog 실행) 및 entry 수 증가 여부는 미확인
- 반영: feat/mcp-adapters 브랜치, PR #55

# AI 사용 로그 — 2026-05-29 (Gyuchan An)
  - 무엇을: templates/ 세 파일에 {{placeholder}} 형식 적용 및 catalog.json 재빌드
  - 요청: propose_new_skill 실제 동작 테스트 후 template substitution 안 되는 버그 발견 → 수정 요청
  - AI 제안: shell-automation/python-cli/node-script SKILL.md 세 파일 모두 {{slug}}, {{task_description}}, {{triggers}}, {{triggers_bullets}}, {{generated_at}}
  placeholder로 교체. catalog.json도 npm run build:catalog로 재빌드 (3→115 entries)
  - 사람 검증: propose_new_skill 직접 호출로 치환 결과 확인 (name/triggers/description 정상 출력). typecheck·build 통과 확인
  - 반영: fix/template-placeholders 브랜치, PR #57

# AI 사용 로그 — 2026-05-30 (Gyuchan An)
- 무엇을: propose_new_skill에 MCP sampling 연동 — Claude가 SKILL.md를 직접 생성하도록 구현
- 요청: server.createMessage() 기반 sampling 구현, server 주입 방식 선택
- AI 제안: handle(args, server) 시그니처로 변경, generateWithSampling()이 slug+triggers 포함 structured prompt 구성 후 server.createMessage() 호출. sampling 실패 시 throw(actionable 메시지). server.ts에서 tools[] main() 안으로 이동하여 server 인스턴스 주입. draft_body 경로는 sampling 우회 유지
- 사람 검증: typecheck 통과, 기존 테스트 36/36 pass. 실제 MCP 세션에서 sampling 동작 미확인
- 반영: feat/sampling-propose-new-skill 브랜치, PR #58

# AI 사용 로그 — 2026-05-31 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Added AI usage log and hallucination protocol docs.
- 관련 작업: PR #59, Issue #12
- 사람 검증: Verified AI log check behavior.

# AI 사용 로그 — 2026-05-31 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Fixed CODEOWNERS routing to real collaborators.
- 관련 작업: PR #60
- 사람 검증: Checked governance routing.

# AI 사용 로그 — 2026-05-31 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Hardened propose_new_skill safety checks.
- 관련 작업: PR #61, Issue #14
- 사람 검증: Added tests and ran lint/typecheck/build/test/CI.

# AI 사용 로그 — 2026-05-31 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Added adapter auto-merge workflow and catalog rollback verifier.
- 관련 작업: PR #62, Issue #15 partial
- 사람 검증: Created adapter label, added verifier, ran CI.

# AI 사용 로그 — 2026-05-31 (Changwook Lee)
- AI 도구: Codex
- 무엇을: Reviewed another PR, requested changes, fixed the branch, added tests, approved and merged after CI.
- 관련 작업: PR #68 review/fix
- 사람 검증: Used AI for code review and validation, but this was not originally your authored PR.

# AI 사용 로그 — 2026-05-31 (Gyuchan An)
- 무엇을: starter-pack 온보딩 기능 구현 — 신규 사용자에게 domain-무관 범용 스킬 자동 제안
- 요청: ai-usage-log 제외하고 누구나 설치 가능한 스킬로 starter-pack 구성, 첫 세션에 suggest하는 기능 구현
- AI 제안: skills/ 디렉토리에 grill-me/understand-anything/write-a-skill/quick-review SKILL.md 작성 후 raw GitHub URL로 handpicked/ JSON 생성. recommend.ts에 list_installed_skills 결과가 0이면 starter-pack mode로 분기. omakase-chef SKILL.md에 첫 세션 감지 trigger 추가
- 사람 검증: typecheck 통과, 41 테스트 pass, zero-skills env에서 starter-pack mode + 4개 항목 반환 확인. GitHub raw URL로 실제 install 동작은 미확인
- 반영: feat/starter-pack 브랜치, PR #63

# AI 사용 로그 — 2026-05-31 (Gyuchan An)
- 무엇을: README.md 전면 재작성 (영어, 최신 상태 반영)
- 요청: 구체적이고 친절한 영어 README 작성
- AI 제안: issue #48 미해결 언급 및 npm link fallback 제거, 0.2.0 npm 라이브 반영. starter-pack 섹션 추가(4개 스킬 표), catalog adapter 표 업데이트(mcp-servers-repo/awesome-mcp 추가), claude mcp add 원라이너 설치 방법 추가. 전체 영어로 통일
- 사람 검증: 파일 내용 및 PR #64 diff 확인 필요. typecheck/test 미실행 (문서 변경만)
- 반영: docs/readme-polish 브랜치, PR #64

# AI 사용 로그 — 2026-05-31 (Gyuchan An)
- 무엇을: OSS 성숙도 개선 — 커뮤니티 헬스 파일, branch protection, topics 설정
- 요청: 외부 기여가 들어올 수 있도록 repo 개선 요청
- AI 제안: CODE_OF_CONDUCT.md(Contributor Covenant 2.1) 작성, dependabot.yml(weekly npm+Actions) 추가, gh API로 main branch protection 설정(CI 필수, review 1개, force push 불가), GitHub topics 6개 설정, README Contributing 섹션에 good-first-issue 링크 및 CoC 참조 추가
- 사람 검증: branch protection API 응답 확인. dependabot 실제 동작 및 PR 생성은 미확인
- 반영: docs/community-health 브랜치, PR #66

# AI 사용 로그 — 2026-05-31 (Gyuchan An)
- 무엇을: omakase-chef SKILL.md 전면 재작성 + recommend default limit 3→1 (진짜 omakase UX 구현)
- 요청: 옵션 나열이 아닌 predefined workflow로 사용자가 자연스럽게 스킬을 추천/설치/사용하게 개선 요청
- AI 제안: SKILL.md를 "옵션 리스트 → 셰프가 하나 서빙" 철학으로 전면 재작성. 첫 세션: 질문 1개→스킬 1개→설치→trigger phrase. 진행 중: 조용히 관찰→자연스러운 쉬는 타이밍에 한번만 탭. 설치 후 항상 trigger phrase 고지. Hard rules 추가(메뉴 금지, 거절한 스킬 재추천 금지, 흐름 중단 금지). recommend.ts limit default 3→1
- 사람 검증: typecheck 통과, 테스트 pass. SKILL.md 동작은 Claude 세션에서 실제 테스트 미확인
- 반영: feat/omakase-ux 브랜치, PR #68
# AI 사용 로그 — 2026-05-31 (Gyuchan An)
- 무엇을: propose_new_skill 샘플링 안전장치 강화
- 요청: sampling 미지원 시 명확 오류, 디스크 쓰기 전 초안 검증
- AI 제안: 호스트 sampling 지원 감지 후 미지원 시 오류 반환. SKILL.md 초안(frontmatter·필수 섹션·트리거·Entry 형태) 검증, 설치 명령(npm/npx/pip/pipx/uvx) 레지스트리 resolvability 확인 후에만 쓰기. 검증 실패 시 파일 미생성
- 사람 검증: 정상 sampling·미지원·잘못된 초안·미해석 설치명령 4종 테스트 통과
- 반영: main

# AI 사용 로그 — 2026-05-31 (Gyuchan An)
- 무엇을: 어댑터 자동 병합 워크플로 + 카탈로그 롤백 검증 (#15)
- 요청: adapter 라벨 PR 자동 병합 + 잘못된 catalog.json 롤백 안전장치
- AI 제안: adapter-auto-merge.yml(비초안 adapter PR auto-merge), docs/automation.md(전제·검증·롤백 절차), scripts/verify-catalog-rollback.mjs(임시 worktree서 나쁜 카탈로그→기준 복구 확인), CONTRIBUTING 안내 추가
- 사람 검증: CI·자동화 문서·롤백 명령 묶음으로 재현 가능 확인
- 반영: main

# AI 사용 로그 — 2026-05-31 (Gyuchan An)
- 무엇을: omakase 추천 UX 리뷰 반영 (첫 세션 starter-pack도 단일 추천)
- 요청: SKILL.md의 "메뉴 없는 omakase"와 도구 반환값 일치
- AI 제안: recommend.ts 첫 세션 starter-pack 경로도 context·limit 적용해 하나만 반환. recommend.test.ts로 playwright 단일 선택·limit 준수 검증(격리 환경)
- 사람 검증: 테스트 통과
- 반영: main

# AI 사용 로그 — 2026-05-31 (Gyuchan An)
- 무엇을: 데모 준비 + README 정확도 개선
- 요청: 데모 스크립트 + README 수치 정정
- AI 제안: README 아키텍처 "~115"→"400+", set_profile 도구 추가. demo-script.md(5–7분 Act1–4), distribution/hn-post·discord-post 초안. .gitignore에 demo-script 추적 예외
- 사람 검증: 문서 변경(테스트 미실행)
- 반영: main

# AI 사용 로그 — 2026-06-01 (Gyuchan An)
- 무엇을: 능동 온보딩 — tool 응답 next_step 힌트 + SKILL.md 트리거 튜닝
- 요청: 세션 시작 시 Claude가 알아서 추천하도록(검증된 메커니즘만)
- AI 제안: find-skill·recommend·install-skill 반환에 next_step 필드(다음 행동 지시)를 content로 전달. MCP Prompts/resources/sampling이 CLI서 세션시작 자동트리거 안 됨을 확인 후 tool content + SKILL.md 자동로드만 사용. SKILL.md description 확장
- 사람 검증: build·typecheck·lint(0)·43 테스트 통과
- 반영: main

# AI 사용 로그 — 2026-06-01 (Gyuchan An)
- 무엇을: starter-pack-gap 모드 — 미설치 스타터 스킬 자동 추천
- 요청: 일부 설치 사용자에게 빠진 스타터 스킬 제안
- AI 제안: recommend.ts에 starter-pack-gap 모드, installedIdSet(영수증+디렉터리 합집합)로 설치분 제외. SKILL.md "incomplete starter pack" 트리거. recommend.test.ts 2종 추가
- 사람 검증: build·typecheck·lint(0)·45 테스트 통과
- 반영: main

# AI 사용 로그 — 2026-06-01 (Gyuchan An)
- 무엇을: starter-pack-gap 버그 수정 + 세션 시작 자율 온보딩 결정화 (#80)
- 요청: 프로필 저장 사용자가 갭 추천 영구 스킵되던 버그 수정
- AI 제안: 갭 게이트를 query 길이 대신 명시적 요청 부재(!ask)로 변경, 공백 context 정규화, find-skill 메뉴형 설명을 단일 추천으로 교체. SKILL.md "세션 시작" 결정적 루틴 + list-installed에 installed_count/next_step 라우팅. e2e/flow.test.ts 신설
- 사람 검증: Codex 리뷰 협의, typecheck·build·lint(0)·49 테스트 통과
- 반영: PR #80

# AI 사용 로그 — 2026-06-01 (Gyuchan An)
- 무엇을: 검색 품질·설치 카운트 버그 수정 (0.2.2)
- 요청: installed_count 중복 집계 + 태그 HTML 오염 + 프로필이 명시 요청 이기는 문제
- AI 제안: installed_count를 id 합집합 Set 크기로. sanitize.ts로 태그 HTML 런타임 제거. awesome-mcp 태그 정규화. profile-search 랭킹을 명시 요청(ask) 우선. serverInfo.version을 package.json서 읽고 엔트리포인트 가드 추가
- 사람 검증: 테스트 9건 추가, typecheck·build·lint(0)·58 테스트 통과
- 반영: main (v0.2.2)

# AI 사용 로그 — 2026-06-01 (Gyuchan An)
- 무엇을: 스타터팩 체크리스트 온보딩 + 결정적 반복 감지 훅 (0.2.3, #83)
- 요청: 온보딩 시 스타터팩 전부를 체크리스트로 다중 선택/설치 + 3회 반복 감지를 데모서 확실히
- AI 제안: starter-pack/starter-pack-gap 모드를 전체/누락 전부 반환 + present_as:checklist. SKILL.md 4곳에 "온보딩 예외=체크리스트" 명시(다른 모드는 단일 유지). hooks/omakase-repetition.mjs(PostToolUse) 신설 — 단일·멀티스텝(n-gram) 3회째 find_skill 주입
- 사람 검증: typecheck·build·lint(0)·58 테스트 통과
- 반영: PR #83 (v0.2.3)

# AI 사용 로그 — 2026-06-01 (Gyuchan An)
- 무엇을: 라이프사이클 도구 (#67 재베이스, 0.2.4, #84)
- 요청: #67의 lifecycle 도구를 회귀 없이 현재 main에 통합
- AI 제안: #67이 stale 베이스라 그대로 머지 시 server.ts·recommend.ts 회귀 확인 → 신규 도구 3개(uninstall/update/doctor)만 가져오고 등록만 추가, profile-search에 match_score/match_reasons 살림. lifecycle.test.ts 신설, #67 닫고 #84로 대체
- 사람 검증: typecheck·build·lint(0)·61 테스트 통과
- 반영: PR #84 (v0.2.4)

# AI 사용 로그 — 2026-06-01 (Gyuchan An)
- 무엇을: 반복 감지 훅 셸 키워드 오탐 수정 (#85)
- 요청: for/done·EOF 히어독 키워드가 반복으로 오탐되는 문제
- AI 제안: SKIP에 제어 키워드(do/done/then/fi/for…)·히어독 구분자(EOF/EOL/END)·추가 빌트인 보강
- 사람 검증: for/done·EOF 3회 침묵, pytest 3회 정상 발동 확인
- 반영: PR #85

# AI 사용 로그 — 2026-06-01 (Gyuchan An)
- 무엇을: 관리 TUI·제안 렌더링·선제 제안 훅·OSS 템플릿 (0.3.0, #86)
- 요청: ①설치 스킬 list/health/update/remove TUI ②제안 예쁜 테이블 렌더 ③명시 요청 없이 제안하는 훅 ④README 용례 ⑤OSS 기여 용이성
- AI 제안: src/cli/tui.ts(@clack/prompts 0.7.0, server.ts tui 서브커맨드 분기, non-TTY 가드). render.ts로 recommend/find_skill에 rendered(마크다운 테이블/체크리스트). hooks/omakase-suggest.mjs(UserPromptSubmit, 프롬프트↔카탈로그 매칭, 세션당 1회). README 용례 5종+TUI+훅 섹션. "스킬 제안" 이슈 템플릿+config.yml
- 사람 검증: Node 18·20 렌더 확인, typecheck·build·lint(0)·66 테스트 통과
- 반영: PR #86 (v0.3.0)

# AI 사용 로그 — 2026-06-02 (Gyuchan An)
- 무엇을: 반복 감지 훅 재작성 — 세션 누적·임계 2·노이즈 정제 (#87)
- 요청: 매 명령마다 파일 하나로 추적해 2회 이상 반복 시 추천 + 오탐 제거
- AI 제안: 세션별→세션 가로지르는 타임스탬프 누적(기본 14일 윈도우), 임계 3→2, 히어독 본문(<< 이후) 통째 제거 + 첫 토큰 명령어 형태 검증으로 5./##/)"/$NODE 프래그먼트 제거
- 사람 검증: 히어독·for/done 침묵, 같은 명령 2회·크로스세션·멀티스텝 발동, 프래그먼트 거부 확인
- 반영: PR #87

# AI 사용 로그 — 2026-06-02 (Gyuchan An)
- 무엇을: README 설치 명령 수정 + 로컬 데모 스크립트 무시
- 요청: 잘못된 설치 명령 정정 (404 실패)
- AI 제안: `npx claude-omakase-install` → `npx -y -p claude-omakase claude-omakase-install` (install은 독립 패키지 아니라 claude-omakase 패키지 내 bin). 로컬 demo.sh는 .gitignore에 추가
- 사람 검증: package.json bin 정의 일치·0.3.0 게시 패키지서 동작 확인
- 반영: main (PR — README install fix)

# AI 사용 로그 — 2026-06-02 (Gyuchan An)
- 무엇을: onboard_starter_pack 도구를 recommend_skills로 통합 (11→10 도구) + MCP 연결 오류 수정
- 요청: empty/partial 구분 없이 starter-pack 갭을 picker로 설치하게 onboard_ 삭제하고 하나로 통합. silent fallback 금지
- AI 제안: 두 도구가 entry point(빈 설치 vs 일부 설치)만 다르고 동일하게 missing 계산함을 확인 → onboard.ts·테스트 삭제, elicitation picker 로직을 recommend.ts의 serveStarterPack()로 흡수(no-context면 전체팩/누락팩 picker 구동·선택분 직접 설치). 비-picker 경로를 loud화: picker 에러/timeout은 mode "picker-error", elicit 미지원은 picker "unsupported" — 둘 다 rendered 체크리스트 + "왜 picker 없는지 먼저 말하라" next_step. server.ts 등록 제거, e2e 핸드셰이크 기대 도구 갱신, SKILL.md·README·CHANGELOG 반영. (별건: ~/.claude.json의 omakase MCP가 `claude-omakase.` 오타+npx cold-start로 연결 실패 → 절대 node+global server.js 경로로 3개 scope 통일)
- 사람 검증: typecheck·build 통과, 80 테스트 통과(main 기준; picker 5종 신규: accept/gap/declined/error/unsupported). 실제 picker UI 동작은 세션 재시작 후 확인 필요
- 반영: refactor/merge-onboard 브랜치 커밋 fc1baa1 (main 위 단독 커밋)

# AI 사용 로그 — 2026-06-03 (Gyuchan An)
- 무엇을: MCP 도구 표면 엣지케이스 버그 4종 발견·수정 (PR #101)
- 요청: MCP/스킬 관련 버그를 찾는 워크플로 만들어 엣지케이스 테스트하고 버그 찾아 고쳐달라
- AI 제안: 멀티에이전트 버그헌트 워크플로(서브시스템별 finder→adversarial 검증)가 StructuredOutput 미호출로 실패 → 직접 감사로 전환. 확정 버그 4개 수정: ①catalog entry.id path traversal(install/update는 가드 없고 uninstall만 있던 비대칭 → code-skills에 assertSafeId 단일 choke point) ②구조 깨진 catalog(entries 비배열)이 sanitizeCatalog.map 크래시 → isCatalogShape 검증+폴스루, sanitize 방어 ③task_description에 ASCII 영숫자 없으면 slug="" → skills 루트에 SKILL.md 쓰던 것 → kebab 검증 ④렌더러 name 미이스케이프(개행/`|`)로 마크다운 깨짐 → clip+cell. 각 버그당 회귀 테스트 1개
- 사람 검증: typecheck·lint·build 통과, 85 테스트 통과(신규 4), PR #101 CI green
- 반영: hunt/mcp-bugfixes 브랜치 커밋 8e6e302 → PR #101

# AI 사용 로그 — 2026-06-03 (Gyuchan An)
- 무엇을: PR #102(Jiwon TUI + MCP 버그픽스 통합)에 TUI 테스트 추가 + 통합 버그 수정
- 요청: PR #102에 버그fix랑 TUI 테스트까지 다 반영됐는지 확인
- AI 제안: #102 검증 결과 버그픽스 4종은 반영됐으나 TUI 테스트 전무 확인. tui.ts가 import 시 main() 자동실행(clack)이라 테스트 불가 + 순수 헬퍼 미export + server.ts가 runTui 대신 import 부작용 의존하는 상태였음 → 헬퍼(statusIcon/catalogCell/renderTable) export, main→runTui() export+자동실행 제거, server.ts를 m.runTui() 호출로 교정. tui.test.ts 12케이스(healthy/missing/update/incomplete 상태→글리프·셀 매핑 + renderTable 레이아웃) 작성
- 사람 검증: typecheck·build 통과, 97 테스트 통과(import hang 없음 확인), #102 CI green
- 반영: integrate/jiwon-tui-pr 브랜치 커밋 4ca58c9 → PR #102
