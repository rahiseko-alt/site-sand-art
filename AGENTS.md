# AGENTS.md

## 必須ルール（コード変更の作法）

### やるべき作法
1. **変更前の影響範囲の完全調査**: 触る箇所だけでなく、関連する処理全体（状態変数・計算式・減衰・バネ・閾値・呼び出し元/先・状態遷移）を読み、「どこを変えるとどこまでどう変わるか」を事前にすべて洗い出す。
2. **波及関係の把握**: パラメータや条件を変えたとき、別の計算や挙動（収束・減衰・見た目・操作感）にどう波及するかをコード上で確認してから設計する。
3. **変更後の確認**: 実際の動作（スクリーンショット・数値・挙動）とコードの両方で、意図しない副作用や悪化がないことを確認する。

### 禁止作法
1. **影響範囲を調べずに触ること**: コードの一部だけを見て、全体のつながりや副作用を調べずに場当たり的に数値やロジックを書き換えること。
2. **推測でのパッチ当て**: 根本の仕組み・依存関係を確認しないままパラメータや判定式をいじって上書きすること。
3. **未検証のままの反映**: 影響範囲の把握や動作確認が不十分な状態でコミット・デプロイすること。

## Agent skills

Skills come from [mattpocock/skills](https://github.com/mattpocock/skills), installed into `.claude/skills/` with `npx skills add mattpocock/skills` and pinned in `skills-lock.json`. Do not edit them locally; update with `npx skills update`.

### Issue tracker

Issues and specs live as GitHub issues in this repo, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root, ADRs in `docs/adr/`. Both are created lazily by `domain-modeling`. See `docs/agents/domain.md`.

While working on the template itself (`.template/` exists), the template's own glossary and ADRs live in `.template/CONTEXT.md` and `.template/docs/adr/` instead, so they are not copied into new projects (`.template/` is removed in a copy on its first session). Read and enforce them exactly as you would the root ones.

## Navigation (repo-local)

This repo may be driven by a non-engineer. Never assume the user knows which slash command to run.

- The `next-step` skill (`.claude/skills/next-step/`, repo-local, not from mattpocock/skills) diagnoses where the work currently stands and proposes exactly one command to run next.
- A `SessionStart` hook in `.claude/settings.json` loads `docs/agents/flow-map.md` into context at the start of every session.
- Before writing implementation code for a request that has not been through the flow, run `next-step` first. Skip it only if the user explicitly says to go straight to code.
- Session ceremonies: `s` reports where the last session left off (run it at the top of the first reply of every session, unprompted); `f` drives the repo to a state where the container can be destroyed safely and then declares, with evidence, whether it is safe to close. Both are repo-local skills, triggered by the bare letter or the slash command.
- Never schedule timed check-ins on yourself (`send_later`, `create_trigger`, `/loop`, `ScheduleWakeup` or similar), including the default "safety-net check-in" after opening a PR. Watch PRs only through event delivery (`subscribe_pr_activity`). The only exception is a check-in the user explicitly asks for in the moment.
- `docs/agents/handover.md` carries state across sessions: the container is ephemeral, so anything not written there is lost. Append a new entry at the top when work is shipped or a direction is agreed, run `.claude/hooks/handover-trim.sh`, and commit it immediately. `.claude/hooks/session-start.sh` owns the retention and read-window numbers; don't restate them elsewhere.

## Development flow

### Starting new work, or adding a feature to an existing codebase

`/grill-with-docs` -> `/conduct`

`/conduct` (repo-local, `.claude/skills/conduct/`) runs everything after the first conversation without asking the user anything except at the mid-point check and the final check: spec, design review, tickets, implementation, final review, fixes, and merge on GO. Each stage is handed to an assignee (tool + model) picked by the router (`.claude/router/route.sh`) from the role table (`.claude/router/roles.txt`). Swapping models means editing only that table. When Codex and Gemini are unavailable it continues in solo mode with Claude and records the other vendors' reviews as `deferred-review` issues for later.

The manual path still works: `/grill-with-docs` -> `/to-spec` (when a spec is warranted) -> `/to-tickets` -> `/implement`

`/grill-with-docs` is the single entry point, whether or not code exists yet. It drives both `/grilling` and
`/domain-modeling`, so the vocabulary and the decisions land in `CONTEXT.md` and `docs/adr/` instead of
evaporating with the session. Those files are created lazily, so there is nothing to write and nothing to skip
when a repo is still empty. `/grill-me` is installed but deliberately unused: it runs `/grilling` alone, so it
records nothing.

`/implement` drives `/tdd` at pre-agreed seams: red -> green, one behaviour at a time, tested through the public interface rather than implementation details, one vertical slice per loop. It closes with `/code-review` before committing.

### Before a large feature, when code is hard to test, or when structure has grown complex

`/improve-codebase-architecture` -> pick a candidate -> `/grill-with-docs` or `/codebase-design` -> `/to-spec` -> `/to-tickets` -> `/implement`

`/improve-codebase-architecture` is a survey: it explores the codebase and hands back candidates. It never rewrites code on its own. Only the candidate the user picks goes through the flow above.
