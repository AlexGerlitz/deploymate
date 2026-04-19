# DeployMate Handoff

Updated: 2026-04-18

## Web Terminal Pointer

- Sidecar operator workspace name: `Web Terminal`
- Local/server reference doc: [WEB-TERMINAL.md](/Users/alexgerlitz/deploymate/WEB-TERMINAL.md)
- Live host today: `https://lab.deploymatecloud.ru`
- Source project today: [products/codex-mobile-terminal](/Users/alexgerlitz/deploymate/products/codex-mobile-terminal)

## Current Product Goal

- Главная цель сейчас: не просто наращивать deploy/control функции, а превратить DeployMate в рыночно правдоподобный self-hosted runtime layer для ongoing-support команд на инфраструктуре клиента или своей инфраструктуре.
- Beginner clarity остаётся обязательной, но теперь это только первый слой более узкого product wedge, а не весь стратегический трек.
- Первый коммерческий wedge теперь зафиксирован узко:
  - агентства
  - интеграторы
  - outsourced teams с ongoing support на client-owned/self-owned infra
- Россия теперь первый packaging wedge:
  - русскоязычный public funnel
  - local provider presets
  - Russian-language operator materials
- Долгоживущий стратегический source of truth теперь отдельно зафиксирован в [PRODUCT-STRATEGY.md](/Users/alexgerlitz/deploymate/PRODUCT-STRATEGY.md).
- Для быстрой ресинхронизации Codex теперь использовать короткие команды из [CODEX-PROTOCOL.md](CODEX-PROTOCOL.md).

## Current Main Track

- Порядок на ближайшие 12 недель теперь фиксированный:
  1. packaging and message-market fit
  2. production baseline
  3. stack ceiling removal
  4. deployment passport
  5. agency fit and packaging
- Текущий active stop point now:
  - `Phase 4: Team and Agency Fit` now has an honest closure point: ownership boundary, workspace/client separation, reusable handoff assets, central `Deployment passport`, and clearer activity trail all survive outside the author's head and outside the live runtime page
  - `Phase 5: Commercial Packaging` now has an honest closure point: the buyer path already shows a clear self-hosted commercial offer, explicit agency/multi-client packaging, Russian-language install/operator materials, and a concrete pilot onboarding/support motion instead of leaving that commercial story inside author narration
  - `deployment passport` now has an honest closure point: steady-state review, fresh-rollout verification, single-runtime incident framing, single-runtime recovery choice, stable stack recovery posture, and stack-specific incident framing all live inside one operator artifact instead of being split across lower cards
  - the first proactive ownership slice is now closed inside template review without widening into server sharing: admins can still review every handoff asset, but foreign-owned baselines are now duplicate-first for direct deploy and mutation
  - latest dense-night-shift rerun on `2026-04-19 20:03 +07` closed `server review storage-pressure step-strip truthfulness v0` on the current dirty tree:
    - `Server Review` no longer keeps the Step 1 strip stuck on generic `Run one check` wording after storage pressure is already known: that current step now reads as clearing the blocker and rerunning readiness, which matches the rest of the page instead of contradicting it
    - beginner smoke now checks the storage-pressure strip copy directly, so the saved-server blocker path keeps one truthful current job across the hero, queue card, and progress strip
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: Step 1 storage-pressure state now reads consistently from headline to strip to task cards, so the next bounded gap should be a broader cross-screen hesitation review rather than more local step-strip polish
  - latest dense-night-shift rerun on `2026-04-19 19:58 +07` closed `deployment workflow guardrail live-lane truthfulness v0` on the current dirty tree:
    - Step 2 no longer opens on the create lane when host disk pressure already blocks another rollout and live deployments exist: the guardrail path now lands directly on the live-review tab, matching the hero’s `Review live apps instead` instruction instead of asking the operator to mentally override the screen
    - beginner smoke now checks that host-disk guardrail mode activates the live tab and leaves the create tab inactive, so the blocked rollout path points at runtime review on first render instead of hiding it behind a manual tab switch
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: Step 2 guardrail mode now points to the same visible lane, hero action, and panel copy, so the next bounded gap should be a broader cross-screen hesitation review rather than more local tab/CTA cleanup
  - latest dense-night-shift rerun on `2026-04-19 19:52 +07` closed `server review queue-action truthfulness v0` on the current dirty tree:
    - `Server Review` hero no longer pretends that an in-page scroll/focus action is the real Step 1 primary: when the current job is “open this server check” or “open cleanup path,” the hero button now stays secondary and the selected server card keeps the actual primary check/cleanup action
    - beginner smoke now covers both pending-check and storage-pressure Step 1 states, so queue-navigation hero actions stay visibly different from the real selected-card action that changes server readiness
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the remaining obvious false-primary pattern on `Server Review` is gone, so the next bounded gap should be a true cross-screen hesitation pass rather than more local hero/button truthfulness cleanup
  - latest dense-night-shift rerun on `2026-04-19 19:43 +07` closed `overview live-review low-disk blocked-state truthfulness v0` on the current dirty tree:
    - `/app` no longer calls Step 2 merely `Locked` when live deployments exist but host disk pressure blocks the next rollout: that card now stays explicitly `Blocked`, matching its cleanup-first copy and destination instead of reading like a generic permission gate
    - beginner smoke now checks the steady-state low-disk overview path for that explicit blocked state, so the live-review workspace tells the operator that rollout is paused by cleanup, not by some vague unavailable step
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the low-disk overview path now reads truthfully in both first-deploy and steady-state modes, so the next bounded gap should be a real cross-screen hesitation pass rather than more local blocker-state wording
  - latest dense-night-shift rerun on `2026-04-19 19:40 +07` closed `deployment workflow guardrail panel duplicate CTA cleanup v0` on the current dirty tree:
    - Step 2 no longer shows two competing primary CTA layers during host-disk guardrail mode: the hero keeps the single primary `Review live apps instead` action, while the guardrail panel follow-up buttons now stay secondary beneath it
    - beginner smoke now covers the dedicated `disk-pressure-blocked` workflow path, so host cleanup mode keeps one top-level action instead of splitting the operator between hero and panel primaries
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the loudest duplicate CTA on Step 2 guardrail mode is gone, so the next bounded gap should be a true cross-screen beginner hesitation pass rather than more local guardrail button cleanup
  - latest dense-night-shift rerun on `2026-04-19 19:34 +07` closed `overview live-review wording alignment v0` on the current dirty tree:
    - `/app` no longer mixes `Review live apps` and `Review health` for the same steady-state Step 3 path: once live deployments exist, the primary overview card title now uses the same live-review wording as the hero and the action labels
    - beginner smoke now checks both steady-state and low-disk live-review overview scenarios for that aligned Step 3 title, so the main review path reads like one job instead of three slightly different labels
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the main Step 3 wording on overview now lines up with the live-review action, so the next bounded gap should be a true end-to-end beginner hesitation pass rather than more local `/app` naming cleanup
  - latest dense-night-shift rerun on `2026-04-19 19:27 +07` closed `overview live-review low-disk duplicate CTA cleanup v0` on the current dirty tree:
    - `/app` no longer repeats the same live-review primary action inside the low-disk cleanup runbook when live deployments already exist: the hero keeps the only primary `Review live apps` CTA, while the runbook follow-up link now stays secondary inside the cleanup panel
    - beginner smoke now covers the steady-state low-disk overview path directly, so the page keeps one top-level live-review action even when Step 2 is blocked and the runbook stays visible under it
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the loudest remaining duplicate CTA on overview low-disk states is gone, so the next bounded gap should be a true end-to-end beginner hesitation pass rather than more local `/app` CTA cleanup
  - latest dense-night-shift rerun on `2026-04-18 23:16 +07` closed `server review empty-state dual-primary cleanup v0` on the current dirty tree:
    - empty `Server Review` no longer shows two competing primary actions on the same Step 1 screen: the hero button now acts as a secondary guide into the add-server form, while the actual form submit remains the only primary save action
    - beginner smoke now checks that split directly, so Step 1 starts with one clear submit action instead of a hero button that visually competes with it
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the biggest surviving empty-state CTA conflict on `Server Review` is gone, so the next bounded gap should be a true end-to-end hesitation pass rather than more local Step 1 CTA cleanup
  - latest dense-night-shift rerun on `2026-04-18 23:09 +07` closed `server review empty-state hero CTA truthfulness v0` on the current dirty tree:
    - empty `Server Review` no longer labels the hero button as if it already saves a server: the hero now truthfully says it opens the add-server form, while the form submit keeps the actual `Save first server` action label
    - beginner smoke now checks that split explicitly, so Step 1 starts with one guidance CTA and one real submit action instead of two different buttons claiming to do the same save
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the empty-state Step 1 hero no longer fakes the save action, so the next bounded gap should be a true end-to-end hesitation pass rather than more local label cleanup
  - latest dense-night-shift rerun on `2026-04-18 23:01 +07` closed `server review ready-state banner cleanup v0` on the current dirty tree:
    - `Server Review` ready-state no longer repeats a green `Step 1 is complete` banner inside the selected server card when the hero already owns that same conclusion and next-step handoff
    - beginner smoke now checks the ready handoff path for absence of that duplicate banner, so the selected ready server card stays focused on optional recheck vs next-step detail instead of echoing the hero
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the loudest remaining ready-state repetition on `Server Review` is gone, so the next bounded gap should be a true cross-screen hesitation review rather than more local duplicate-callout cleanup
  - latest dense-night-shift rerun on `2026-04-18 22:55 +07` closed `deployment workflow panel duplicate CTA cleanup v0` on the current dirty tree:
    - Step 2 blocked/support panels no longer re-promote the same action that the hero already owns: prerequisite `Open server review`, member-live `Review live apps instead`, and member-waiting `Back to overview` now stay as secondary follow-up buttons inside their panels instead of competing primary CTAs
    - beginner smoke now checks those three panel actions directly, including a dedicated admin prerequisite scenario, so blocked/live-review Step 2 states keep one truthful primary action at the top of the screen
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the remaining obvious duplicate CTA layer on Step 2 blocked states is gone, so the next bounded gap should be a true full-path beginner hesitation pass rather than another local button-demotion sweep
  - latest dense-night-shift rerun on `2026-04-18 22:46 +07` closed `server review ready-state duplicate CTA cleanup v0` on the current dirty tree:
    - `Server Review` no longer shouts the same Step 2 action twice when one server is already ready: the hero keeps the primary handoff into rollout setup, while the selected ready card now keeps that same path as a secondary follow-up instead of competing for the same click
    - beginner smoke now checks the ready server card for a demoted Step 2 action, so Step 1 keeps one clear primary next step when readiness is already known
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the biggest surviving duplicate CTA on `Server Review` is gone, so the next bounded gap should be a real full-path hesitation pass or one remaining cross-screen action conflict, not more local CTA demotion on this screen
  - latest dense-night-shift rerun on `2026-04-18 22:39 +07` closed `deployment workflow duplicate primary CTA cleanup v0` on the current dirty tree:
    - `Deployment Workflow` no longer renders the same primary action twice on review-first and blocked states: when the hero already owns the truthful next click, the lower `Do this now` card now keeps explanation and copy tools only instead of repeating the same button again
    - beginner smoke now checks the default review-first workflow and the member waiting workflow for absence of that lower duplicate CTA, so Step 2 keeps one clear primary action instead of competing hero and mid-page buttons
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the biggest surviving duplicate CTA on Step 2 is gone, so the next bounded gap should be a real full-path hesitation review or one remaining Step 1/Step 2 action conflict, not another generic copy pass
  - latest dense-night-shift rerun on `2026-04-18 22:28 +07` closed `server review hero state copy simplification v0` on the current dirty tree:
    - `Server Review` no longer opens empty, ready, and storage-pressure states with one generic Step 1 headline: the left hero now says whether the real job is saving the first target, moving on because one server is already ready, clearing low disk on the saved server, or finishing one readiness check
    - beginner smoke now pins the default empty-state title plus the ready-server and storage-pressure Step 1 titles, so the first screen in the path keeps describing the actual state instead of making the user infer it from the right-side spotlight only
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the three beginner top-level screens now all open with state-driven framing, so the next bounded gap should be a cross-screen live-user hesitation check or one concrete CTA conflict that still survives in the flow
  - latest dense-night-shift rerun on `2026-04-18 22:18 +07` closed `deployment workflow hero state copy simplification v0` on the current dirty tree:
    - `/app/deployment-workflow` no longer opens blocked, review-first, and ready-for-first-deploy states with one generic `Step 2` headline: the hero title now says the real situation first, whether that means finishing Step 1, waiting for an admin-managed target, clearing host disk pressure, reviewing live apps, or choosing what to run on the already-selected server
    - beginner smoke now pins those hero titles on the default prerequisite path, the ready-server handoff path, and the member waiting path, so Step 2 keeps reading like one truthful next-step screen instead of a generic shell over several different states
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the top of the beginner path now reads more truthfully on both overview and deployment workflow, so the next bounded gap should be Step 1 drift on `Server Review` or a real live-user hesitation capture, not another generic headline cleanup
  - latest dense-night-shift rerun on `2026-04-18 22:07 +07` closed `overview non-blocking banner demotion v0` on the current dirty tree:
    - `/app` no longer stacks degraded-mode and auto-refresh notes as a second wall of subtle banners under the hero: those passive signals now live in one compact status line inside the main workspace block, while real blockers and action feedback still stay visible below
    - beginner smoke now pins the runtime status note above the step grid, so the overview keeps the product story and the next click ahead of passive system noise
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: `/app` now has a cleaner main block, so the next bounded gap should be a cross-screen beginner drift check or a real live-user hesitation, not more local banner churn on this page
  - latest dense-night-shift rerun on `2026-04-18 21:50 +07` closed `overview hero state copy simplification v0` on the current dirty tree:
    - `/app` hero no longer opens with scaffold language like `Choose the next step` and `Step 1, Step 2, Step 3`: the top block now speaks in state-driven plain language about the real situation on this workspace, whether that is first server setup, first deploy, live review, admin wait-state, or cleanup-before-rollout
    - beginner smoke now checks the default admin overview against the simpler first-step wording, so the screen keeps explaining the product and the current next click instead of reading like a generic shell over the real workflow
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/project_automation_smoke_checks.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the main hero on `/app` now reads more like a real product surface, so the next bounded gap should be compressing or demoting non-blocking banner noise under that hero rather than more hero wording churn
  - latest dense-night-shift rerun on `2026-04-18 21:46 +07` closed `overview blocked-step primary marker cleanup v0` on the current dirty tree:
    - `/app` no longer marks blocked `Step 2` as the current step during the ready-server + low-disk first-deploy state: the top CTA still points into the cleanup runbook, but the step grid now stops pretending that the disabled rollout card is the active next click
    - beginner smoke now asserts that the low-disk first-deploy overview keeps `Step 2` in an explicit blocked state without the `Current step` marker, so the screen no longer sends two competing “main action” signals at once
    - `bash -n scripts/frontend_beginner_smoke.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: the largest CTA conflict on `/app` is gone, so the next bounded gap should be simplifying the hero/state copy on that page rather than more blocker-state polish
  - latest dense-night-shift rerun on `2026-04-18 21:31 +07` closed `live release validation for Step 1 storage-pressure slice v0` on the current dirty tree:
    - the overview and `Server Review` storage-pressure recovery path is now released on the live frontend host at commit `65f19eb`, after a frontend-only preflight, commit/push on `deploymate/release-preserve-local-overrides`, and a frontend-only remote release to `https://deploymatecloud.ru`
    - release secret contract, smoke credential precheck, remote frontend rebuild, post-release disk guard, and local post-deploy smoke all passed; the deployed frontend container restarted cleanly on the live host and reported the expected deployed sha `65f19eb0652c77c3d8067405565906551e56fb23`
    - `bash scripts/preflight.sh --surface frontend`
    - `git push origin HEAD`
    - `bash scripts/remote_release.sh --host deploymate --surface frontend --branch deploymate/release-preserve-local-overrides --base-url https://deploymatecloud.ru ...`
    - the stop point changes here: the Step 1 storage-pressure slice is now honest end-to-end on prod too, so the next bounded gap should be a real operator incident capture when server or host disk pressure returns, not another local recovery-path pass
  - latest dense-night-shift rerun on `2026-04-18 21:23 +07` closed `server review storage pressure recovery path v0` on the current dirty tree:
    - Step 1 no longer leaves root-disk pressure on a saved server as a warning-only state: `Server Review` now turns that diagnostics cue into one explicit cleanup-first recovery path with safe starter commands, a copy action, a warning that the commands belong on the saved server target rather than the DeployMate host, and a follow-up readiness recheck before Step 2 can open again
    - the page-level spotlight now stays truthful too: when the selected saved server is blocked on storage pressure and there is no ready target yet, the hero switches from generic “check this server” language into an explicit cleanup-first blocker so the main Step 1 CTA no longer fights the real issue
    - `bash -n scripts/frontend_servers_smoke.sh`
    - `npm --prefix frontend run smoke:servers`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: storage pressure now has an explicit recovery path on `/app`, `Server Review`, and `Deployment Workflow`, so the next bounded gap should be a deliberate live release/validation of the Step 1 storage-pressure slice or a real operator incident capture, not another local storage-copy pass
  - latest dense-night-shift rerun on `2026-04-18 21:16 +07` closed `overview first-deploy low-disk blocker checkpoint v0` on the current dirty tree:
    - `/app` no longer points a ready-server, zero-deployment admin straight into `Step 2` when the DeployMate host is already low on free space: the top CTA now moves into the cleanup runbook, the Step 2 card stays explicitly blocked with cleanup-first wording, and the workspace board marks host cleanup as the current blocker instead of silently falling back to Step 1 review
    - steady-state overview keeps live review as the primary action while another rollout stays blocked, so the already-shipped low-disk runbook and rollout guardrail now line up with the main workspace CTA instead of splitting the operator story across summary and workflow screens
    - `bash -n scripts/frontend_beginner_smoke.sh`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: host disk pressure is now honest on the main overview CTA too, so the next bounded gap should be `server review storage pressure recovery path v0` or a real live incident capture, not another overview CTA tweak
  - latest dense-night-shift rerun on `2026-04-18 21:05 +07` closed `live release validation for low-disk path v0` on the current dirty tree:
    - the low-disk overview/runbook path is now released on the live frontend host at commit `3abc9ee`, after a frontend-only preflight and frontend-only remote release from `deploymate/release-preserve-local-overrides`
    - the release flow exposed one tooling regression instead of a runtime regression: `post_deploy_smoke.sh` used a non-portable `IGNORECASE` header parse and falsely claimed `/app` had no `Location` header even though prod returned the expected `307 Location: /login`
    - `post_deploy_smoke.sh` now uses a portable `tolower($1) == "location:"` redirect check, backend regression coverage now includes a real local smoke server for the standard `Location:` casing path, and the fixed smoke now passes against `https://deploymatecloud.ru`
    - `bash scripts/preflight.sh --surface frontend`
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_production_env_audit`
    - `DEPLOYMATE_BASE_URL=https://deploymatecloud.ru ... bash scripts/post_deploy_smoke.sh`
    - the stop point changes here: the release path for this low-disk slice is now honest end-to-end, so the next bounded gap should be a real operator incident capture when host disk pressure returns or another production-facing slice, not more release-tooling repair on this path
  - latest dense-night-shift rerun on `2026-04-18 20:53 +07` closed `ops overview disk recovery runbook v0` on the current dirty tree:
    - low disk on the DeployMate host no longer leaves the operator with only an alert and a blocked workflow: overview now renders one first-class cleanup runbook with ordered recovery steps, a safe starter command set, a warning against broader blind cleanup, and a copy action for the runbook itself
    - this keeps the recovery path inside `/app` where the signal first appears, while Step 2 still remains blocked for new rollouts; admins can review live apps or copy the cleanup path from the same workspace instead of jumping straight into SSH archaeology
    - `bash -n scripts/frontend_ops_smoke.sh scripts/frontend_beginner_smoke.sh`
    - `npm --prefix frontend run smoke:ops`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: low disk now has both an explicit guardrail and an explicit cleanup runbook, so the next bounded gap should be external validation on the live host or a deliberate release of this path, not another round of local warning copy
  - latest dense-night-shift rerun on `2026-04-18 20:45 +07` closed `deployment workflow host disk guardrail v0` on the current dirty tree:
    - disk pressure is no longer just a warning on `/app` and Step 1 review: ops overview now exports one structured `host_runtime` root-disk summary, and Step 2 uses that explicit signal instead of parsing raw attention-item copy
    - `Deployment Workflow` now turns low space on the DeployMate host into a real rollout guardrail: the main next-step card switches to cleanup-first guidance, the page shows a dedicated disk-pressure guardrail card, and create, stack deploy, and direct template deploy all stay blocked until the host has headroom again while review/edit/template-save paths remain available
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_ops_api_flow`
    - `npm --prefix frontend run smoke:ops`
    - `npm --prefix frontend run smoke:runtime`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: low disk now has one explicit action path across overview, server review, and deploy decision, so the next bounded gap should be either a direct cleanup action/runbook surface or external validation on the live host, not more passive warning copy
  - latest dense-night-shift rerun on `2026-04-18 20:18 +07` closed `ops overview local disk pressure alert v0` on the current dirty tree:
    - `/app` no longer hides low space on the DeployMate host behind SSH-only investigation: ops overview now adds one explicit attention item when the local root filesystem crosses the same warning/error thresholds used by server diagnostics
    - the overview path stays cheap because it reads only the current host disk state, not remote server diagnostics, so admins see the same disk-pressure story on the main workspace page without turning overview refresh into another SSH sweep
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_ops_api_flow`
    - `npm --prefix frontend run smoke:ops`
    - the stop point changes here: disk pressure is now visible both on `/app` and inside Step 1 review, so the next bounded gap should be either an action-oriented follow-up from the alert or external validation, not another blind ops cleanup pass
  - latest dense-night-shift rerun on `2026-04-18 20:12 +07` closed `server review storage pressure cue v0` on the current dirty tree:
    - server diagnostics no longer leave root-disk pressure buried inside raw `df -h` output: the root filesystem line is now parsed into an explicit disk-usage diagnostic item with `ok` / `warn` / `error` status and plain-language cleanup guidance for rollout safety
    - server review cards now surface that storage-pressure cue directly and keep Step 2 blocked when the server is reachable but root disk pressure is too high, so a “ready” result no longer hides the exact low-space risk that should be fixed first
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_server_api_flow backend.tests.test_server_diagnostics`
    - `npm --prefix frontend run smoke:servers`
    - the stop point changes here: root-disk pressure now shows up on the main Step 1 operator surface, so the next bounded gap should be either a lightweight overview-level disk alert or external validation, not another SSH-only cleanup loop
  - latest dense-night-shift rerun on `2026-04-18 18:32 +07` closed `agency fit activity trail checkpoint v0` on the current dirty tree:
    - handoff and export surfaces now keep one explicit `Activity trail` cue beside `Recent activity`, so the next operator can see the short event history, not only the single latest event, before opening the full timeline
    - runtime detail quick reference and the activity card now summarize the current trail directly, while incident snapshot JSON, handoff markdown, and filtered activity CSV now carry structured activity-trail summary fields instead of leaving that story implicit in the raw event list
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: phase 4 is now honestly closed, so the next bounded gap moves into commercial packaging, starting with Russian-language operator materials
  - latest dense-night-shift rerun on `2026-04-18 18:38 +07` closed `commercial packaging Russian operator materials checkpoint v0` on the current dirty tree:
    - buyer-facing commercial surfaces now point to two real Russian-language proof docs instead of leaving the Russian/self-hosted wedge implicit: one quickstart for self-hosted install and one quickstart for the first operator deploy + handoff path
    - `/upgrade` and `/commercial-license` now show those materials as part of the buyer path itself, so the commercial conversation is anchored to concrete install/operator evidence rather than only package wording
    - `npm --prefix frontend run build`
    - the stop point changes here: Russian operator/install proof is now visible on the buyer path, so the next bounded commercial gap moves to a pilot onboarding checklist instead of more generic package copy
  - latest dense-night-shift rerun on `2026-04-18 18:47 +07` closed `commercial packaging pilot onboarding checklist v0` on the current dirty tree:
    - the repo now has one explicit Russian-language pilot onboarding checklist that turns the first commercial week into a concrete path: scope review, self-hosted install, first deploy, passport-based handoff, and week-one support rhythm
    - `/upgrade` and `/commercial-license` now surface that pilot/support proof beside the earlier Russian install/operator materials, so the buyer can see how onboarding actually works instead of being asked to trust vague support language
    - `npm --prefix frontend run build`
    - the stop point changes here: the fixed five-phase track is now honestly closed, so the next bounded gap moves beyond phase closure into design-partner demo proof rather than more packaging copy
  - latest dense-night-shift rerun on `2026-04-18 18:59 +07` closed `design partner demo packet v0` on the current dirty tree:
    - the repo now has one explicit Russian-language design-partner demo packet that turns the first serious buyer call into a concrete path: public story, live product entry, server-review and deploy flow, deployment passport proof, and the next pilot step
    - landing, `/upgrade`, and `/commercial-license` now point to that packet beside the earlier install/operator/pilot materials, so buyer-facing demo proof no longer depends on README-only notes or live narration
    - `npm --prefix frontend run build`
    - the stop point changes here: the remaining work is now outside the repo-local build track and sits in external validation, not in another missing product/package slice
  - latest dense-night-shift rerun on `2026-04-18 18:12 +07` closed `deployment passport stack incident cue v0` on the current dirty tree:
    - stack incident detail now keeps stack-specific passport incident framing instead of generic single-runtime copy: degraded stack review calls out stack health failure, saved-health-target-first checks, review-first safe action, guarded whole-stack escalation, and `Diagnose, then replace stack` recovery posture inside the same passport block
    - runtime smoke now requires healthy stack detail to stay out of incident mode and requires the dedicated stack-incident path to carry those stack-specific incident and recovery cues, so the last obvious passport gap no longer depends on visual review
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: `deployment passport` is now honestly closed, so the next bounded gap moves into `agency fit` activity-trail quality instead of more passport copy work
  - latest dense-night-shift rerun on `2026-04-18 17:59 +07` closed `deployment passport stack recovery cue v0` on the current dirty tree:
    - stack runtime `Deployment passport` now keeps a stack-specific `Recovery path` cue instead of the generic single-runtime wording: stable stack detail explicitly points to the saved health target and recent activity first, then to guarded whole-stack replacement, while reminding that guided redeploy and rollback stay paused for stack v0
    - runtime smoke now requires that stack-specific passport recovery wording on the stack detail path, so the operator cannot fall back to single-container recovery language on a compose-backed runtime
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: passport now covers stable stack recovery posture too, so the next bounded gap moves to stack-specific incident framing instead of more steady-state stack summary work
  - latest dense-night-shift rerun on `2026-04-18 17:53 +07` closed `deployment passport recovery path cue v0` on the current dirty tree:
    - `Deployment passport` now carries one explicit `Recovery path` cue beside safe change path, so the operator can see from the passport itself whether the right recovery posture is `Review rollback`, `Diagnose, then review redeploy`, `No recovery decision yet`, `Guarded stack replacement`, or admin-managed recovery
    - healthy, fresh-rollout, and failed runtime detail now keep that recovery cue in copied passport text and on-screen passport state, so the passport now answers not only what to review now but also how recovery would happen safely from the current state
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: passport now covers steady-state, incident framing, and single-runtime recovery choice strongly enough that the next bounded gap moves to stack-specific passport recovery language instead of more single-runtime summary work
  - latest dense-night-shift rerun on `2026-04-18 17:38 +07` closed `deployment passport incident mode cue v0` on the current dirty tree:
    - `Deployment passport` now switches into explicit incident mode for failed or degraded runtimes, keeping likely cause, first checks, safe action now, and escalation path inside the same passport block instead of forcing the operator to reconstruct the incident from lower cards
    - healthy passport state now stays out of incident mode, while failed runtime detail keeps the incident brief cues on-screen and in copied passport text, so the passport now works as both steady-state operator artifact and first incident brief
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: passport now covers both steady-state and incident framing, so the next bounded gap moves to making recovery paths inside the passport more explicit rather than adding more summary cues
  - latest dense-night-shift rerun on `2026-04-18 17:32 +07` closed `deployment passport phase-boundary checkpoint` on the current dirty tree:
    - the on-screen `Deployment passport` now carries review target, release trace, current risk, and safe change path beside runtime identity, ownership, health proof, recent activity, and the next safe action, so the passport itself now reads like the central operator block instead of a partial summary next to richer side surfaces
    - fresh-rollout passport state now keeps an explicit `Verify before change` path, while healthy steady-state passport keeps a visible rollback-ready path, so the operator can answer both current review and safe change posture from the same card
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: passport is now strong enough to count as the central steady-state operator artifact, so the next bounded gap moves to degraded runtime incident mode rather than more healthy-path summary work
  - latest dense-night-shift rerun on `2026-04-18 17:23 +07` closed `runtime export next-step cue v0` on the current dirty tree:
    - runtime handoff now keeps one explicit `Next safe action` line beside the plain-language summary, attention, recent activity, runtime identity, ownership boundary, review target, health proof, and release trace, so exported handoff no longer makes a teammate infer the recommended action from live-only copy
    - incident snapshot JSON, incident markdown, filtered activity CSV, and copied passport summary now carry explicit next-step value/detail instead of leaving that cue only inside on-page decision text
    - runtime detail keeps the legacy `runtime-detail-next-step` smoke hook as a compatibility alias while the handoff card uses the newer next-step cue id, so runtime smoke stays honest after the rename
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: the current runtime export cue set is now explicit enough that remaining work belongs to `deployment passport`, not to reopening phase 3 stack-ceiling work
  - latest dense-night-shift rerun on `2026-04-18 17:14 +07` closed `runtime export attention cue v0` on the current dirty tree:
    - runtime handoff now keeps one explicit `Attention` line beside the plain-language summary, next step, runtime identity, recent activity, ownership boundary, review target, health proof, and release trace, so exported handoff no longer makes a teammate infer the current risk from the raw attention list
    - incident snapshot JSON, incident markdown, filtered activity CSV, and copied passport summary now carry explicit attention value/detail plus total/error/warn counts and primary attention label/message instead of leaving that context only inside the exported attention array
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: exported runtime handoff now states current risk explicitly beside the other passport cues, so the next bounded export gap moves to making the next safe action equally structured across export artifacts
  - latest dense-night-shift rerun on `2026-04-18 17:09 +07` closed `runtime export recent activity cue v0` on the current dirty tree:
    - runtime handoff now keeps one explicit `Recent activity` line beside the plain-language summary, next step, runtime identity, ownership boundary, review target, health proof, and release trace, so exported handoff no longer makes a teammate infer the latest operator-visible event from the raw activity list
    - incident snapshot JSON, incident markdown, filtered activity CSV, and copied passport summary now carry explicit recent-activity value/detail plus logged-at/level/category/title/message metadata instead of leaving that context only inside the exported activity rows
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: exported runtime handoff now states recent activity explicitly beside the other passport cues, so the next bounded export gap moves to making current risk equally explicit outside the live runtime page
  - latest dense-night-shift rerun on `2026-04-18 17:03 +07` closed `runtime export identity cue v0` on the current dirty tree:
    - runtime handoff now keeps one explicit `Runtime identity` line beside the plain-language summary, next step, ownership boundary, review target, health proof, and release trace, so exported handoff no longer makes a teammate infer what is actually running from lower runtime facts
    - incident snapshot JSON, incident markdown, filtered activity CSV, and copied passport summary now carry explicit runtime-identity value/detail plus shape/image/container/stack/service/location metadata instead of leaving that context scattered across nested deployment fields
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: exported runtime handoff now states identity, ownership, review target, health proof, and release trace explicitly, so the next bounded export gap moves to making recent activity equally explicit outside the live runtime page
  - latest dense-night-shift rerun on `2026-04-18 16:56 +07` closed `runtime export health proof cue v0` on the current dirty tree:
    - runtime handoff now keeps one explicit `Health proof` line beside the plain-language summary, next step, ownership boundary, review target, and release trace, so exported handoff no longer makes a teammate infer whether the runtime is healthy from raw health payloads
    - incident snapshot JSON, incident markdown, filtered activity CSV, and copied passport summary now carry explicit health-proof status/detail plus checked-at/status-code/response-time/error metadata instead of leaving that evidence buried in the nested health object
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: exported runtime handoff now states ownership, review target, release trace, and health proof explicitly, so the next bounded export gap moves to making runtime identity equally explicit outside the live runtime page
  - latest dense-night-shift rerun on `2026-04-18 16:49 +07` closed `runtime export release trace cue v0` on the current dirty tree:
    - runtime handoff now keeps one explicit `Release trace` line beside the plain-language summary, next step, ownership boundary, and review target, so exported handoff no longer drops which release actually produced the live runtime
    - incident snapshot JSON, incident markdown, filtered activity CSV, and copied passport summary now carry explicit release-trace summary/detail plus source/ref/commit/tag/trigger metadata instead of leaving that context buried in lower runtime fields
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: exported runtime handoff now states ownership, review target, and release trace explicitly, so the next bounded export gap moves to keeping health proof equally explicit outside the live runtime page
  - latest dense-night-shift rerun on `2026-04-18 16:09 +07` closed `runtime export review target cue v0` on the current dirty tree:
    - runtime handoff now keeps one explicit `Review target` line beside the plain-language summary, next step, and ownership boundary, so exported handoff work no longer depends on inferring the right URL or page from lower runtime facts
    - incident snapshot JSON, incident markdown, filtered activity CSV, and copied passport summary now carry explicit review-target status/href/detail instead of leaving that cue implicit inside health or URL fields
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `node --input-type=module` runtime export handoff helper check passed
    - `NEXT_PUBLIC_SMOKE_TEST_MODE=1 NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/Users/alexgerlitz/deploymate/scripts/font_google_mock_responses.cjs npm --prefix frontend run build`
    - `npm --prefix frontend run smoke:runtime` failed again immediately at the shared loopback bind preflight with `PermissionError: [Errno 1] Operation not permitted`
    - the stop point changes here: exported runtime handoff now states both ownership and review target explicitly, so the next bounded export gap moves to making release trace equally explicit in exported runtime context
  - latest dense-night-shift rerun on `2026-04-18 15:39 +07` closed `runtime export ownership cue v0` on the current dirty tree:
    - runtime handoff now keeps one explicit `Ownership boundary` line beside the plain-language summary and next step, so copy/download actions no longer make the operator infer who can actually act
    - incident snapshot JSON, incident markdown, and filtered activity CSV now carry explicit ownership status/detail instead of keeping that cue only inside the live runtime page
    - `bash -n scripts/frontend_runtime_smoke.sh`
    - `NEXT_PUBLIC_SMOKE_TEST_MODE=1 NEXT_PUBLIC_SMOKE_USER_ROLE=member NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/Users/alexgerlitz/deploymate/scripts/font_google_mock_responses.cjs npm --prefix frontend run build`
    - `NEXT_PUBLIC_SMOKE_TEST_MODE=1 NEXT_PUBLIC_SMOKE_USER_ROLE=member node --input-type=module` runtime export ownership helper check passed
    - `npm --prefix frontend run smoke:runtime` failed again immediately at the shared loopback bind preflight with `PermissionError: [Errno 1] Operation not permitted`
    - the stop point changes here: ownership is now explicit both on-screen and inside exported handoff artifacts, so the next bounded export gap moves to keeping the review target equally explicit in exported runtime context
  - latest dense-night-shift rerun on `2026-04-18 15:17 +07` fully closed `runtime detail ownership cue v0` on this host:
    - deployment detail now surfaces one explicit ownership summary inside `Deployment passport`, the plain-language handoff block, and copied passport text, so runtime review answers who can act before logs, delete, or template tools compete for attention
    - runtime smoke fixtures now carry deployment `owner_user_id`, so member/admin-managed review states verify real ownership copy instead of collapsing into legacy runtime language
    - `scripts/frontend_runtime_smoke.sh` now covers a member `admin-managed-runtime` scenario, and `scripts/frontend_smoke_shared.sh` now normalizes numeric port PIDs so macOS `fuser` usage output cannot wedge smoke cleanup/start loops
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
    - the stop point changes here: template ownership plus runtime detail ownership are now both explicit locally, so the next bounded ownership gap moves into runtime export/handoff surfaces instead of staying in detail review
  - latest dense-night-shift rerun on `2026-04-18 14:49 +07` closed that first proactive ownership boundary on the current dirty tree:
    - template API now exposes `owner_user_id`, so the workflow can distinguish `Your asset` from `Another operator's asset`
    - direct deploy from a foreign-owned template now returns `400`, while update/delete return `403`, so another operator's baseline stays review-first and duplicate-first
    - focused template review and the compact queue now show owner state explicitly and disable foreign edit/delete controls instead of pretending every baseline is equally mutable
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/frontend_templates_smoke.sh scripts/frontend_smoke_shared.sh scripts/lib/frontend_smoke_checks.sh scripts/project_automation_smoke_checks.sh`
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow backend.tests.test_member_ownership_isolation`
    - `npm --prefix frontend run smoke:templates`
    - `npm --prefix frontend run smoke:beginner`
    - the stop point changes here: proactive ownership work no longer waits on an external signal inside templates, but broader runtime/server sharing still stays deferred
  - latest dense-night-shift rerun on `2026-04-18 15:10 +07` moved the next runtime checkpoint forward without widening scope:
    - deployment detail now computes one explicit ownership summary and surfaces it inside `Deployment passport`, the plain-language handoff block, and the copied passport text instead of leaving ownership cues buried in lower admin-managed banners
    - smoke-mode runtime fixtures now carry deployment `owner_user_id`, so member/admin-managed runtime review can distinguish direct ownership from legacy records during frontend verification
    - `scripts/frontend_runtime_smoke.sh` now includes a dedicated member `admin-managed-runtime` scenario that requires the passport ownership cue and keeps the change tab hidden
    - `bash -n scripts/frontend_runtime_smoke.sh`
    - `NEXT_PUBLIC_SMOKE_TEST_MODE=1 NEXT_PUBLIC_SMOKE_USER_ROLE=member NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/Users/alexgerlitz/deploymate/scripts/font_google_mock_responses.cjs npm --prefix frontend run build`
    - `npm --prefix frontend run smoke:runtime` failed again immediately at the shared loopback bind preflight with `PermissionError: [Errno 1] Operation not permitted`
    - the runtime/detail ownership package is implemented, but honest closure still waits on one loopback-capable rerun of `smoke:runtime` on this host or another socket-capable machine
  - latest dense-night-shift rerun on `2026-04-18 13:35 +07` reconfirmed the same stop point from the current dirty tree:
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow`
    - `npm --prefix frontend run build`
    - `npm --prefix frontend run smoke:templates`
    - no broader ownership-model package was started because the narrower template/context boundary still holds locally
  - latest dense-night-shift rerun on `2026-04-18 13:49 +07` strengthened the same stop point with the fuller frontend fast path on this host:
    - `make frontend` passed end-to-end, including `smoke:auth`, `smoke:ops`, and `smoke:runtime`
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow` passed again
    - the earlier local bind blocker turned out to be restricted-sandbox history plus stale local port contention, not the current product code
    - no broader ownership-model package was started because the narrower template/context boundary still holds locally
  - latest dense-night-shift rerun on `2026-04-18 13:52 +07` closed the full local checkpoint verification for the same dirty tree:
    - `npm --prefix frontend run build`
    - `npm --prefix frontend run smoke:templates`
    - the same stop point remains unchanged: deeper ownership work still stays deferred until a real workflow-level gap survives the narrower template/context boundary
  - latest dense-night-shift rerun on `2026-04-18 13:57 +07` closed one more narrow trust gap inside the same template/context boundary:
    - duplicating a template now clears the inherited `context_label`, so a new handoff asset cannot silently keep the previous client or environment label
    - the workflow copy now tells the operator to duplicate and relabel before reusing an outside-context asset
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow`
    - `npm --prefix frontend run smoke:templates`
    - the same stop point still remains unchanged: deeper ownership work stays deferred until a real workflow-level gap survives the narrower template/context boundary
  - latest dense-night-shift rerun on `2026-04-18 14:11 +07` closed another direct-reuse gap inside the same template/context boundary:
    - direct template deploy now requires a `context_label`, so unlabeled duplicates cannot bypass the duplicate-and-relabel step through the deploy endpoint
    - secondary template queue cards no longer expose one-click deploy; the operator must review/focus first, or duplicate and relabel when the asset sits outside the current context
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow`
    - `npm --prefix frontend run smoke:templates`
    - `npm --prefix frontend run smoke:beginner` still stops at the shared loopback bind preflight with `PermissionError: [Errno 1] Operation not permitted`, so the first-pass browser smoke remains host-blocked rather than code-blocked here
    - the same stop point still remains unchanged: deeper ownership work stays deferred until a real workflow-level gap survives the narrower template/context boundary
  - latest dense-night-shift rerun on `2026-04-18 14:25 +07` closed the remaining local beginner-smoke blocker without widening the product package:
    - `smoke:beginner` now verifies `/app`, `/app/server-review`, and `/app/deployment-workflow` through smoke-mode static build artifacts, so the first-pass verification no longer depends on a loopback-bound dev server in this sandbox
    - deployment workflow smoke now bootstraps the handoff query from `NEXT_PUBLIC_SMOKE_WORKFLOW_QUERY`, so the server-review/overview first-deploy bridge still proves the selected-target copy and image-focus marker in static HTML
    - `npm --prefix frontend run smoke:beginner`
    - `npm --prefix frontend run smoke:templates`
    - the same stop point still remains unchanged: deeper ownership work stays deferred until a real workflow-level gap survives the narrower template/context boundary
  - latest dense-night-shift rerun on `2026-04-18 14:34 +07` reconfirmed the same narrow boundary on the current dirty tree:
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/frontend_templates_smoke.sh scripts/frontend_smoke_shared.sh scripts/lib/frontend_smoke_checks.sh`
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow`
    - `npm --prefix frontend run smoke:templates`
    - `npm --prefix frontend run smoke:beginner`
    - the same stop point still remains unchanged: deeper ownership work stays deferred until a real workflow-level gap survives the narrower template/context boundary
  - `Agency fit v1` теперь закрыт:
    - deployment workflow templates now read as reusable handoff assets instead of a generic personal preset lane
    - the focused template review now shows reuse state, created/last-used context, and a deliberate review/deploy/edit/duplicate/delete order for the next operator
    - deployment detail template save now frames the saved setup as a reusable workflow asset and bridges directly back into focused template review
    - beginner + runtime smoke now hold that agency-fit handoff contract explicitly
    - latest rerun on `2026-04-18 09:17 +07` passed the changed-scope verification:
      - `npm --prefix frontend run smoke:beginner`
      - `npm --prefix frontend run smoke:runtime`
      - `npm --prefix frontend run build`
  - `Passport v1` теперь закрыт:
    - deployment detail overview now starts with one explicit `Deployment passport` block for both single runtimes and stacks
    - that passport keeps runtime identity, health proof, recent activity, and the next safe action in one handoff summary instead of scattering them across cards
    - deployment workflow success states now point straight to the passport anchor, so a fresh rollout lands on the exact handoff block instead of a generic detail page start
    - runtime smoke now explicitly holds the workflow-to-passport bridge and the fresh-rollout passport card
    - latest rerun on `2026-04-18 08:49 +07` passed the changed-scope verification:
      - `npm --prefix frontend run build`
      - `npm --prefix frontend run smoke:runtime`
  - `Stack deploy v0` теперь закрыт:
    - code path now exists across frontend + backend:
    - `POST /deployments/stack` now creates one compose-backed runtime with one primary service and one saved health target
    - backend now persists stack deploy metadata needed for compose up/down and primary-service runtime review
    - deployment workflow stack lane now deploys the compose subset instead of stopping at intake-only copy
    - runtime detail now identifies stack shape directly and hides false single-container change/template CTAs for stack runtimes
    - verification reality on this machine:
    - `npm --prefix frontend run build` passed again on `2026-04-18`
    - `python3 -m py_compile backend/app/... backend/tests/test_deployment_api_flow.py` had already passed in the previous stack pass
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_deployment_api_flow backend.tests.test_deployment_routes` passed again on `2026-04-18`
    - backend route tests were updated to match the current redeploy preflight + previous-release-snapshot callback flow, so local changed-scope verification no longer depends on a missing DB stub
    - backend API coverage now also locks the current stack safety boundary explicitly:
      - `redeploy`, `release-webhook`, and `rollback` each return the intended `400` for stack runtimes instead of falling through to single-container mutation paths
      - the same repo-local unittest command above passed again after adding those stack guardrail checks on `2026-04-18`
    - latest dense-night-shift rerun on `2026-04-18 03:04 +07` reconfirmed the same stop point with a tighter verification path:
      - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh` passed after adding a loopback bind preflight to the shared smoke launcher
      - `npm --prefix frontend run smoke:runtime` now fails immediately with an explicit `PermissionError: [Errno 1] Operation not permitted` bind preflight instead of waiting for `next dev` to die later
      - honest stack closure still needs a socket-capable machine because the runtime smoke assertions themselves still cannot start in this sandbox
    - latest dense-night-shift rerun on `2026-04-18 04:05 +07` kept the same honest stop point:
      - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_deployment_api_flow backend.tests.test_deployment_routes` passed after adding stack guardrail tests for blocked `redeploy`, `release-webhook`, and `rollback`
      - `npm --prefix frontend run smoke:runtime` failed again immediately at the shared loopback bind preflight with `PermissionError: [Errno 1] Operation not permitted`
      - `Stack deploy v0` still needs one socket-capable machine for the final runtime smoke before `Passport v1` can become the active package
    - latest dense-night-shift rerun on `2026-04-18 05:05 +07` closed one more false-action gap inside stack runtime detail:
      - `npm --prefix frontend run build` passed after replacing the stack runtime release-webhook controls with an explicit unsupported note
      - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh` passed after adding runtime smoke coverage for the hidden stack webhook path
      - `npm --prefix frontend run smoke:runtime` still failed immediately at the shared loopback bind preflight with `PermissionError: [Errno 1] Operation not permitted`
      - honest closure is unchanged: `Stack deploy v0` still needs one socket-capable machine before `Passport v1` can become the active package
    - latest dense-night-shift rerun on `2026-04-18 06:03 +07` reconfirmed the same stop point after the full changed-scope verification pass:
      - `npm --prefix frontend run build` passed again with the current stack workflow + runtime detail surfaces
      - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_deployment_api_flow backend.tests.test_deployment_routes` passed again
      - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh scripts/frontend_beginner_smoke.sh` passed
      - `npm --prefix frontend run smoke:runtime` failed again immediately at the shared loopback bind preflight with `PermissionError: [Errno 1] Operation not permitted`
      - honest closure is still unchanged: `Stack deploy v0` cannot be marked done here until one socket-capable machine runs the frontend runtime smoke
    - latest dense-night-shift rerun on `2026-04-18 07:14 +07` closed another false-next-action gap for stack runtimes:
      - deployment workflow live cards and deployment detail now treat the saved stack `health_target` as the review endpoint when no public URL exists, so stack runtime review no longer falls back to a false `private` story
      - stable stack runtime detail now leads with `Open health target` / runtime overview instead of suggesting the disabled single-app `Prepare rollout change` path
      - future runtime smoke coverage now also asserts that stack runtime detail keeps the health-target CTA and does not reintroduce the false stack redeploy CTA
      - `npm --prefix frontend run build` passed again
      - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_deployment_api_flow backend.tests.test_deployment_routes` passed again
      - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh scripts/frontend_beginner_smoke.sh` passed again
      - `npm --prefix frontend run smoke:runtime` still failed immediately at the shared loopback bind preflight with `PermissionError: [Errno 1] Operation not permitted`
      - honest closure is still unchanged: `Stack deploy v0` still needs one socket-capable machine before `Passport v1` can become the active package
    - latest dense-night-shift rerun on `2026-04-18 08:08 +07` closed one more stack handoff mismatch inside runtime detail:
      - deployment detail facts now expose the same saved stack review endpoint link that the overview cards and primary CTA already use, so stack operators no longer see `Open health target` above and `URL -` below for the same runtime
      - runtime smoke coverage now also asserts that the stack runtime facts section keeps that review-target link visible
      - `npm --prefix frontend run build` passed again
      - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_deployment_api_flow backend.tests.test_deployment_routes` remained green from the same dirty tree earlier in this pass
      - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh` passed again
      - `npm --prefix frontend run smoke:runtime` still failed immediately at the shared loopback bind preflight with `PermissionError: [Errno 1] Operation not permitted`
      - honest closure is still unchanged: `Stack deploy v0` still needs one socket-capable machine before `Passport v1` can become the active package
    - latest dense-night-shift rerun on `2026-04-18 08:18 +07` closed one more verification-path blocker around smoke-mode builds:
      - smoke launcher scripts now inject a repo-local `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` file, so smoke/dev startup no longer depends on live access to `fonts.googleapis.com`
      - `bash -n scripts/frontend_smoke_shared.sh` passed
      - `NEXT_PUBLIC_SMOKE_TEST_MODE=1 NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/Users/alexgerlitz/deploymate/scripts/font_google_mock_responses.cjs npm --prefix frontend run build` passed, so the smoke-mode frontend build is now honest even in this offline sandbox
      - the final socketless runtime-smoke experiment is still not closed here: probing the compiled Next app-page handler for `/deployments/[deploymentId]` now gets past fonts and manifest loading, but still dies inside Next runtime internals with `TypeError: Cannot read properties of undefined (reading 'startsWith')`
      - honest closure is still unchanged: `Stack deploy v0` still needs either one socket-capable machine for the existing runtime smoke or a deeper Next-specific static render harness before `Passport v1` can become the active package
    - latest rerun on `2026-04-18 08:31 +07` finally closed the package on this machine:
      - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh scripts/frontend_beginner_smoke.sh` passed
      - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_deployment_api_flow backend.tests.test_deployment_routes` passed again
      - `npm --prefix frontend run build` passed again
      - `npm --prefix frontend run smoke:runtime` passed end-to-end, including the stack runtime detail, internal-only review path, template success path, and create success path
      - honest closure changed here: `Stack deploy v0` is now verified locally and `Passport v1` becomes the active package
    - local system `python3` still lacks project deps, but repo-local `backend/venv` is enough for the backend changed-scope suite
  - `Public packaging v2` теперь закрыт:
    - landing now explicitly sells the real `Deployment passport`, reusable handoff assets, and the buyer-facing business path instead of generic deploy/handoff language
    - `/upgrade` now ties package cards and request copy to runtime handoff needs, reusable assets, and the already-live product proof
    - `/commercial-license` now explains the same runtime passport + reusable asset proof before the business conversation starts
    - latest rerun on `2026-04-18 09:51 +07` passed the honest changed-scope verification:
      - `npm --prefix frontend run build`
    - latest stronger rerun on `2026-04-18 13:49 +07` also passed:
      - `make frontend`
    - latest rerun on `2026-04-18 13:52 +07` also passed:
      - `npm --prefix frontend run build`
  - `Client-labeled handoff assets v0` теперь закрыт:
    - deployment templates now carry one explicit `context_label` across save, update, duplicate, list, and focused review so the next operator can see which client or operating context the asset belongs to
    - template review/list surfaces now show that context directly and mark unlabeled assets as needing context instead of silently looking globally reusable
    - latest rerun on `2026-04-18 10:39 +07` passed the honest changed-scope verification available in this sandbox:
      - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow`
      - `npm --prefix frontend run build`
    - latest stronger rerun on `2026-04-18 13:49 +07` also passed:
      - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow`
      - `make frontend`
  - `narrower workspace/client separation` теперь закрыт:
    - focused template review now states the current client/operating context boundary explicitly and splits the secondary queue into `same context` vs `outside this context`
    - template workflow save/review surfaces and smoke expectations now keep the context field plus reusable-handoff-asset copy aligned instead of drifting between UI and verification
    - latest rerun on `2026-04-18 11:38 +07` passed the honest changed-scope verification available in this sandbox:
      - `npm --prefix frontend run build`
      - `bash -n scripts/frontend_templates_smoke.sh scripts/frontend_smoke_shared.sh scripts/project_automation_smoke_checks.sh`
    - latest rerun on `2026-04-18 12:37 +07` closed the local verification blocker on this machine:
      - `bash -n scripts/frontend_templates_smoke.sh scripts/frontend_smoke_shared.sh scripts/project_automation_smoke_checks.sh` passed again
      - `npm --prefix frontend run smoke:templates` passed end-to-end via smoke-mode static build against `frontend/.next-smoke-templates/server/app/app/deployment-workflow.html`
      - deployment workflow no longer needs `useSearchParams` at prerender time, so the template smoke can verify the real focused-preview/context-boundary markup without a loopback-bound dev server
    - latest rerun on `2026-04-18 13:52 +07` passed again:
      - `npm --prefix frontend run smoke:templates`
    - latest rerun on `2026-04-18 14:11 +07` closed the remaining direct template-reuse shortcut inside the same boundary:
      - unlabeled templates now fail direct deploy until the operator adds a context label explicitly
      - secondary queue cards now require review/focus before reuse, so outside-context assets cannot skip straight to deploy
      - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow`
      - `npm --prefix frontend run smoke:templates`
      - `npm --prefix frontend run smoke:beginner` still fails on this host at the shared loopback bind preflight with `PermissionError: [Errno 1] Operation not permitted`
    - latest rerun on `2026-04-18 14:25 +07` closed the host-local beginner verification blocker:
      - `smoke:beginner` now stays aligned to the real beginner surfaces (`/app`, `/app/server-review`, `/app/deployment-workflow`) and renders them through static build artifacts instead of a loopback-bound dev server
      - the first-deploy handoff branch now stays verifiable in static HTML via `NEXT_PUBLIC_SMOKE_WORKFLOW_QUERY`, so the overview/server-review selected-target bridge still holds locally
      - `npm --prefix frontend run smoke:beginner`
      - `npm --prefix frontend run smoke:templates`
  - `Release review + rollback v1` is now closed:
    - deployment detail has a rollback review surface wired to the rollback endpoint
    - `npm --prefix frontend run smoke:runtime` passed
    - targeted backend rollback route test passed in an isolated venv
  - `Stack/Compose intake v0` is now closed:
    - deployment workflow now has a dedicated compose stack intake lane for the v0 subset
    - beginner overview/workflow gating mismatches were corrected while closing the same slice
    - `npm --prefix frontend run smoke:beginner` passed
- Ближайшие пакеты тоже зафиксированы:
  1. commercial packaging Russian operator materials checkpoint v0
- `README.md` и broad repo-root packaging пока deliberately deferred до реального public funnel rewrite, чтобы не создавать doc/product drift.

## Autonomous Night Loop

- Ночная работа теперь должна идти не как один изолированный проход, а как последовательный loop по текущему main track.
- На этом хосте прежний lease blocker больше не подтверждается:
  - probe on `2026-04-18 14:49 +07` successfully created and removed `/Users/alexgerlitz/.codex/automation-leases/deploymate.lock`
  - old `Operation not permitted` notes now belong to the earlier restricted sandbox, not to the current host state
- Базовое правило:
  - если текущий пакет уже завершён и проверен, не ждать нового сообщения, а брать следующий пакет по фиксированному порядку
- Порядок автономного продолжения сейчас такой:
  1. commercial packaging Russian operator materials checkpoint v0
- Для каждого ночного прохода expected loop один и тот же:
  - reread `HANDOFF.md`
  - взять один bounded package
  - сделать минимальный coherent diff
  - прогнать узкую meaningful verification
  - обновить `HANDOFF.md`
  - если нет risk/blocker, сразу перейти к следующему bounded package
- Останавливаться нужно только если:
  - нужен рискованный продуктовый выбор
  - не хватает внешнего доступа / credentials / runtime
  - verification ломается так, что безопасно продолжать уже нельзя

## Current Security Boundary

- Новый жёсткий проектный принцип: runtime-данные не могут быть "по умолчанию общими" просто потому, что пользователь уже вошёл в систему.
- Базовая безопасная модель на текущем этапе:
  - `admin` видит весь продуктовый runtime и admin depth
  - `member` видит только свои deployments/templates/activity/notifications
  - remote server inventory и remote server execution остаются `admin-only`, пока у проекта нет явной sharing/ownership модели для серверов
- Дополнительные жёсткие guardrails теперь тоже часть текущей boundary:
  - auth throttling должен жить в shared state, а не в памяти одного процесса
  - bootstrap `admin/admin` не допускается без явного local-only override
  - SSH host trust по умолчанию должен быть strict/pinned, а не `accept-new`
- Production/release boundary теперь тоже зафиксирована как часть security contract:
  - `DEPLOYMATE_ADMIN_PASSWORD` должен быть реальным секретом
  - `DEPLOYMATE_AUTH_RATE_LIMIT_BACKEND` должен быть shared, а не `memory`
  - `DEPLOYMATE_SSH_HOST_KEY_CHECKING=yes` и `DEPLOYMATE_SSH_KNOWN_HOSTS_FILE` обязательны для remote runtime
  - post-deploy smoke должен проверять реальный runtime path, а не только `/api/health`
- Любой новый runtime surface дальше нужно оценивать не только по clarity, но и по ownership boundary: кто именно может это видеть, экспортировать и менять.

## Current Build Reality

- `/app` сейчас работает как обзорный входной экран.
- `/app/server-review` сейчас главный экран для подключения и review серверов.
- `/app/deployment-workflow` сейчас главный runtime/deploy workspace.
- `deployment detail` стал более decision-first, чем раньше.
- public funnel now speaks more directly to the first wedge:
  - landing now centers client-owned/self-owned infrastructure, no-Kubernetes framing, and handoff value
  - landing now also names the real `Deployment passport`, reusable handoff assets, and the explicit buyer path as proof points
  - `/upgrade` now frames buyer paths as `Internal Team`, `Agency / Multi-client`, and `Custom / Redistribution`, with runtime handoff needs included in the business request
  - `/commercial-license` now reads as a buyer-facing business path instead of a purely legal review wall and points to the same product proof
- minimal funnel telemetry schema now exists in frontend:
  - `landing_cta`
  - `register_started`
  - `register_completed`
  - `server_created`
  - `server_verified`
  - `deployment_created`
  - `healthy_reached`
  - `deployment_detail_opened`
- current instrumentation is intentionally narrow:
  - landing CTAs now emit structured funnel events
  - deeper runtime funnel events still remain for future slices
- deployment runtime now also carries a first release trace:
  - `release_source`
  - `runtime_shape`
  - ref/commit/image metadata
  - triggered-at and triggered-by context
  - generic token-based webhook entry for controlled deploys
- deployment runtime now also carries a first custom-domain contract:
  - `custom_domain`
  - `tls_enabled`
  - health and primary URL now follow the configured domain when it exists
  - workflow/detail now treat domain + TLS as a first-class readiness review instead of a side note
- config vars and secrets are now separate runtime concepts:
  - secrets are masked in UI and exports
  - redeploy keeps existing secrets unless a new value is supplied
  - template and ops surfaces now preserve redaction instead of treating secrets as plain env
- runtime today всё ещё фактически `single-container-first`.
- Это теперь считать не допустимой долгоживущей моделью, а ceiling risk между production baseline и agency fit.
- Stack/Compose layer для проекта теперь не optional polish, а следующий логичный потолок спроса.
- Когда stack-support придёт, он должен прийти как одна coherent runtime unit:
  - stack release identity
  - primary service
  - health target
  - rollback unit
- То есть stack нельзя моделировать как loose set of unrelated single-container deployments.
- Week 1 now has a clearer first-pass story across the four main surfaces:
  - `/app` chooses the obvious next path instead of surfacing too many competing actions
  - `/app/server-review` now reads as `save -> verify -> deploy`
  - `/app/deployment-workflow` now behaves like one active lane at a time: live, create, or templates
  - `deployment detail` now answers state, risk, and next action more directly
- продукт стал заметно понятнее с первого прохода, но живой walkthrough на проде показал более глубокую проблему:
  новичок всё ещё не понимает, что делает продукт и какой у него первый шаг
- Одновременно infra/release слой теперь тоже сильно жёстче:
  - production env audit и contract gate уже часть нормального release path
  - post-deploy smoke теперь умеет явный host resolve
  - если локальный runner не видит staging по DNS/TLS, smoke можно и нужно запускать прямо на deploy host через SSH
- Week 2 beginner story теперь уже началась в реальном UI:
  - `/app` объясняет three-step path и даёт plain-language meaning для `server`, `what to run`, и `healthy`
  - `/app` теперь начинается как простой product-entry экран: large product statement, one next action, short signal strip, then the three-step path
  - `/app/server-review` теперь жёстко framed как один job: save one server target, run one check, then leave for Step 2
  - `/app/deployment-workflow` теперь явно framed как Step 2 with one-lane-at-a-time guidance instead of operator-first scanning
- Task-first framing уже усилился ещё на один шаг:
  - `/app` now shows one explicit `Do this now` task card before the rest of the three-step map
  - opening a saved server now shows `what to do with this server` before edit/delete surfaces
  - server edit/delete are now secondary details instead of competing with the main path
  - login can now hide demo access by default unless a dedicated demo user is explicitly configured
  - member blocked flow in `/app/deployment-workflow` is being simplified so it stops showing dead create/template surfaces before admin Step 1 is done
  - after a live walkthrough, overview primary CTA was corrected so `member` users waiting on admin Step 1 no longer see a false `start deployment` main action

## Current Release Reality

- 2026-04-10 живой staging walkthrough завершён end-to-end успешно на хосте `deploymate`.
- Проверенный release path теперь реально включает:
  - remote audits
  - compose rebuild
  - login/auth smoke
  - backup bundle + restore dry-run
  - runtime smoke deploy with health/diagnostics/logs/activity/delete
- В процессе walkthrough были пойманы и закрыты три настоящих release-path дефекта:
  - локальный smoke runner зависел от внешнего DNS/TLS
  - `post_deploy_smoke.sh` не умел `curl --resolve`
  - в `post_deploy_smoke.sh` отсутствовал `json_query()` helper
- Важный operational вывод: release path нельзя считать здоровым, пока он не прогнан на реальном staging host, даже если локальные тесты зелёные.

## Next Recommended Packages

- Уже зафиксировано на текущей ветке:
  - strategy + 12-week execution order checkpoint
  - `Public funnel / ICP packaging v1`
  - `Webhook/release source v0`
  - `Secrets v1`
  - `Domains/SSL v1`
  - `Release review + rollback v1`
  - `Stack/Compose intake v0`
  - `Passport v1`
  - `Agency fit v1`
- `Stack deploy v0` теперь считать закрытым:
  - the supported compose/stack subset is now verified locally as one runtime unit with one compose file, one primary service, one health target, and one stack delete unit
  - latest rerun on `2026-04-18 08:31 +07` passed the full changed-scope package verification:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh scripts/frontend_beginner_smoke.sh`
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_deployment_api_flow backend.tests.test_deployment_routes`
    - `npm --prefix frontend run build`
    - `npm --prefix frontend run smoke:runtime`
- `Passport v1` теперь считать закрытым:
  - deployment detail now exposes one `Deployment passport` handoff block for both single runtimes and stacks
  - deployment workflow success paths now open that passport directly with the fresh-rollout context preserved in the URL
  - latest rerun on `2026-04-18 08:49 +07` passed the changed-scope package verification:
    - `npm --prefix frontend run build`
    - `npm --prefix frontend run smoke:runtime`
- `Agency fit v1` теперь считать закрытым:
  - deployment workflow templates now behave like reusable handoff assets with explicit reuse state, recency, and safe review order
  - deployment detail now saves and bridges templates as reusable workflow assets for the next operator instead of a generic preset
  - latest rerun on `2026-04-18 09:17 +07` passed the changed-scope package verification:
    - `npm --prefix frontend run smoke:beginner`
    - `npm --prefix frontend run smoke:runtime`
    - `npm --prefix frontend run build`
- `Public packaging v2` теперь считать закрытым:
  - landing, `/upgrade`, and `/commercial-license` now point directly to the real `Deployment passport`, reusable handoff assets, and business-path proof instead of generic public copy
  - latest rerun on `2026-04-18 09:51 +07` passed the changed-scope package verification:
    - `npm --prefix frontend run build`
  - latest stronger rerun on `2026-04-18 13:49 +07` also passed:
    - `make frontend`
  - latest rerun on `2026-04-18 13:52 +07` also passed:
    - `npm --prefix frontend run build`
- `Client-labeled handoff assets v0` теперь считать закрытым:
  - deployment templates now persist one explicit client/operator context label through the template API and workflow review surface
  - focused template review and the compact queue now show that context directly and call out unlabeled assets before they are treated as trusted handoff baselines
  - latest rerun on `2026-04-18 10:39 +07` passed the changed-scope package verification available in this sandbox:
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow`
    - `npm --prefix frontend run build`
  - latest stronger rerun on `2026-04-18 13:49 +07` also passed:
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow`
    - `make frontend`
- `narrower workspace/client separation` теперь считать закрытым:
  - focused template review now spells out the active client/operating context boundary and keeps non-matching assets in a separate queue below
  - template smoke expectations now match the current handoff-asset wording and context field instead of still asserting the old preset copy
  - latest rerun on `2026-04-18 11:38 +07` passed the changed-scope package verification available in this sandbox:
    - `npm --prefix frontend run build`
    - `bash -n scripts/frontend_templates_smoke.sh scripts/frontend_smoke_shared.sh scripts/project_automation_smoke_checks.sh`
  - latest rerun on `2026-04-18 12:37 +07` closed the local smoke rerun:
    - `npm --prefix frontend run smoke:templates` now passes via smoke-mode static build after prerendering `/app/deployment-workflow` with the real focused template/context-boundary markup
  - latest rerun on `2026-04-18 13:52 +07` also passed:
    - `npm --prefix frontend run smoke:templates`
- `Template duplicate relabel guard v0` теперь считать закрытым:
  - duplicating a handoff asset now drops the inherited `context_label`, so the duplicate starts in a safe `Needs context label` state instead of silently pretending it still belongs to the previous client or environment
  - outside-context template guidance now explicitly tells the operator to duplicate and relabel before reuse
  - latest rerun on `2026-04-18 13:57 +07` passed the changed-scope package verification:
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow`
    - `npm --prefix frontend run smoke:templates`
- `Template direct deploy guard v0` теперь считать закрытым:
  - direct template deploy now requires a `context_label`, so unlabeled duplicates cannot bypass the duplicate-and-relabel boundary through the deploy endpoint
  - secondary template queue cards no longer expose one-click deploy; the operator must review/focus first or duplicate and relabel for the current handoff
  - local `smoke:beginner` now verifies the real `/app -> /app/server-review -> /app/deployment-workflow` handoff path through static build artifacts, so this boundary closes honestly on this host without a loopback-bound dev server
  - latest rerun on `2026-04-18 14:34 +07` passed the changed-scope package verification:
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/frontend_templates_smoke.sh scripts/frontend_smoke_shared.sh scripts/lib/frontend_smoke_checks.sh`
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow`
    - `npm --prefix frontend run smoke:templates`
    - `npm --prefix frontend run smoke:beginner`
- `Template operator ownership boundary v0` теперь считать закрытым:
  - template API now exposes `owner_user_id`, so the workflow review surface can tell whether the focused baseline is yours, foreign-owned, or legacy
  - foreign-owned templates now stay review-first: direct deploy is blocked, update/delete are blocked, and the operator must duplicate into their own handoff before mutation
  - focused review and the compact queue now show owner state explicitly and disable foreign edit/delete controls instead of implying every baseline is equally mutable
  - latest rerun on `2026-04-18 14:49 +07` passed the changed-scope package verification:
    - `bash -n scripts/frontend_beginner_smoke.sh scripts/frontend_templates_smoke.sh scripts/frontend_smoke_shared.sh scripts/lib/frontend_smoke_checks.sh scripts/project_automation_smoke_checks.sh`
    - `PYTHONPATH=backend ./backend/venv/bin/python -m unittest backend.tests.test_template_api_flow backend.tests.test_member_ownership_isolation`
    - `npm --prefix frontend run smoke:templates`
    - `npm --prefix frontend run smoke:beginner`
- `runtime detail ownership cue v0` теперь считать закрытым:
  - deployment detail now answers runtime ownership directly inside `Deployment passport`, plain-language handoff, and copied passport text instead of hiding that boundary in lower admin-managed banners
  - member/admin-managed runtime detail now has a dedicated runtime smoke scenario that requires the ownership cue and keeps change controls hidden
  - the shared frontend smoke helper now normalizes numeric port PIDs, so macOS `fuser` usage output no longer wedges runtime smoke cleanup/start between scenario ports
  - latest rerun on `2026-04-18 15:17 +07` passed the changed-scope package verification:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `runtime export ownership cue v0` теперь считать закрытым:
  - handoff tools now show one explicit `Ownership boundary` line with copy support next to the plain-language summary and next step instead of leaving ownership implicit once the operator starts exporting runtime context
  - incident snapshot JSON, incident handoff markdown, and filtered activity CSV now keep ownership status/detail as first-class export fields, so handoff artifacts survive outside the live runtime page
  - latest rerun on `2026-04-18 15:39 +07` passed the changed-scope package verification available in this sandbox:
    - `bash -n scripts/frontend_runtime_smoke.sh`
    - `NEXT_PUBLIC_SMOKE_TEST_MODE=1 NEXT_PUBLIC_SMOKE_USER_ROLE=member NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/Users/alexgerlitz/deploymate/scripts/font_google_mock_responses.cjs npm --prefix frontend run build`
    - `NEXT_PUBLIC_SMOKE_TEST_MODE=1 NEXT_PUBLIC_SMOKE_USER_ROLE=member node --input-type=module` runtime export ownership helper check passed
    - `npm --prefix frontend run smoke:runtime` is currently sandbox-blocked at the shared loopback bind preflight with `PermissionError: [Errno 1] Operation not permitted`, so this export slice closed here through build + pure-helper coverage instead of a socket-bound browser pass
- `runtime export release trace cue v0` теперь считать закрытым:
  - handoff tools now show one explicit `Release trace` line with copy support next to ownership and review target, so a teammate can see which release produced the live runtime before opening lower runtime facts
  - incident snapshot JSON, incident handoff markdown, filtered activity CSV, and copied passport text now keep release-trace summary/detail plus source/ref/commit/tag/trigger metadata as first-class export fields
  - latest rerun on `2026-04-18 16:49 +07` passed the changed-scope package verification on this host:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `runtime export health proof cue v0` теперь считать закрытым:
  - handoff tools now show one explicit `Health proof` line with copy support next to ownership, review target, and release trace, so a teammate can see whether the runtime is healthy before opening lower health payloads or diagnostics
  - incident snapshot JSON, incident handoff markdown, filtered activity CSV, and copied passport text now keep health-proof status/detail plus checked-at/status-code/response-time/error metadata as first-class export fields
  - latest rerun on `2026-04-18 16:56 +07` passed the changed-scope package verification on this host:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `runtime export identity cue v0` теперь считать закрытым:
  - handoff tools now show one explicit `Runtime identity` line with copy support next to ownership, review target, health proof, and release trace, so a teammate can see what is actually running before opening lower runtime facts
  - incident snapshot JSON, incident handoff markdown, filtered activity CSV, and copied passport text now keep runtime-identity value/detail plus shape/image/container/stack/service/location metadata as first-class export fields
  - latest rerun on `2026-04-18 17:03 +07` passed the changed-scope package verification on this host:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `runtime export recent activity cue v0` теперь считать закрытым:
  - handoff tools now show one explicit `Recent activity` line with copy support next to runtime identity, ownership, review target, health proof, and release trace, so a teammate can see the latest recorded event before opening the full activity feed
  - incident snapshot JSON, incident handoff markdown, filtered activity CSV, and copied passport text now keep recent-activity value/detail plus logged-at/level/category/title/message metadata as first-class export fields
  - latest rerun on `2026-04-18 17:09 +07` passed the changed-scope package verification on this host:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `runtime export attention cue v0` теперь считать закрытым:
  - handoff tools now show one explicit `Attention` line with copy support next to runtime identity, recent activity, ownership, review target, health proof, and release trace, so a teammate can see the current risk before opening the full attention list
  - incident snapshot JSON, incident handoff markdown, filtered activity CSV, and copied passport text now keep attention value/detail plus total/error/warn counts and primary attention label/message as first-class export fields
  - latest rerun on `2026-04-18 17:14 +07` passed the changed-scope package verification on this host:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `runtime export next-step cue v0` теперь считать закрытым:
  - handoff tools now show one explicit `Next safe action` line with copy support next to attention, recent activity, runtime identity, ownership, review target, health proof, and release trace, so a teammate can see the recommended move before reopening the full runtime page
  - incident snapshot JSON, incident handoff markdown, filtered activity CSV, and copied passport text now keep next-step value/detail as first-class export fields instead of leaving that cue only inside live runtime copy
  - runtime detail keeps the legacy `runtime-detail-next-step` smoke hook as a compatibility alias while the handoff card uses the newer next-step cue id, so the current runtime smoke contract stays valid
  - latest rerun on `2026-04-18 17:23 +07` passed the changed-scope package verification on this host:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `deployment passport phase-boundary checkpoint` теперь считать закрытым:
  - the on-screen `Deployment passport` now keeps review target, release trace, current risk, and safe change path together with runtime identity, ownership, health proof, recent activity, and the next safe action, so the passport itself now carries the full steady-state operator story
  - healthy runtime detail now exposes a visible rollback-ready path inside the passport, while fresh-rollout detail keeps a visible verify-before-change path there, so the card answers safe change posture instead of forcing the operator into lower tabs first
  - latest rerun on `2026-04-18 17:32 +07` passed the changed-scope package verification on this host:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `deployment passport incident mode cue v0` теперь считать закрытым:
  - `Deployment passport` now switches into explicit incident mode for failed or degraded runtimes, keeping likely cause, first checks, safe action now, and escalation path inside the passport itself instead of making the operator reconstruct the incident from lower review cards
  - copied passport text now carries the same incident brief when the runtime is degraded, while healthy passport state stays out of incident mode
  - latest rerun on `2026-04-18 17:38 +07` passed the changed-scope package verification on this host:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `deployment passport recovery path cue v0` теперь считать закрытым:
  - `Deployment passport` now carries one explicit `Recovery path` cue beside the safe-change cue, so the card itself answers whether the safe recovery posture is rollback review, redeploy review after diagnosis, no recovery decision yet, guarded stack replacement, or admin-managed recovery
  - copied passport text now keeps that same recovery path across healthy, fresh-rollout, and failed runtime states instead of leaving recovery only in lower rollback/redeploy cards
  - latest rerun on `2026-04-18 17:53 +07` passed the changed-scope package verification on this host:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `deployment passport stack recovery cue v0` теперь считать закрытым:
  - stack runtime `Deployment passport` now uses stack-specific recovery wording instead of generic single-runtime language, so the card itself tells the operator to review the saved health target and recent activity first, then treat recovery as guarded whole-stack replacement
  - runtime smoke now requires that stack-specific recovery wording on the stack detail path, so stack passport copy cannot quietly drift back toward single-container rollback/redeploy language
  - latest rerun on `2026-04-18 17:59 +07` passed the changed-scope package verification on this host:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `deployment passport stack incident cue v0` теперь считать закрытым:
  - stack incident detail now uses stack-specific passport incident wording instead of the generic single-runtime brief, so the operator sees stack health failure, saved-health-target-first checks, review-first safe action, guarded whole-stack escalation, and `Diagnose, then replace stack` directly inside the passport
  - runtime smoke now requires healthy stack detail to stay out of incident mode and requires the dedicated stack-incident path to carry those stack-specific incident and recovery cues, so the last obvious passport gap is now held as real behavior
  - latest rerun on `2026-04-18 18:12 +07` passed the changed-scope package verification on this host:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `agency fit activity trail checkpoint v0` теперь считать закрытым:
  - handoff and export surfaces now keep one explicit `Activity trail` cue beside `Recent activity`, so the next operator can see the short event history instead of reconstructing it from the raw timeline
  - runtime detail quick reference and the activity card now summarize the current trail directly, while incident snapshot JSON, handoff markdown, and filtered activity CSV now carry structured activity-trail summary fields for handoff outside the live runtime page
  - latest rerun on `2026-04-18 18:32 +07` passed the changed-scope package verification on this host:
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- `commercial packaging Russian operator materials checkpoint v0` теперь считать закрытым:
  - the repo now has two real Russian-language materials for the first commercial wedge: one self-hosted install quickstart and one operator quickstart for first deploy plus handoff
  - `/upgrade` and `/commercial-license` now surface those materials directly as buyer proof, so the public business path no longer asks a Russian/self-hosted buyer to infer whether install and operator guidance actually exists
  - latest rerun on `2026-04-18 18:38 +07` passed the changed-scope package verification on this host:
    - `npm --prefix frontend run build`
- `commercial packaging pilot onboarding checklist v0` теперь считать закрытым:
  - the repo now has one explicit Russian-language pilot onboarding checklist for the first commercial week: scope review, install, first deploy, handoff check, and minimal support rhythm
  - `/upgrade` and `/commercial-license` now surface that checklist together with the earlier Russian install/operator materials, so onboarding and support motion are visible on the buyer path instead of living only in private explanation
  - latest rerun on `2026-04-18 18:47 +07` passed the changed-scope package verification on this host:
    - `npm --prefix frontend run build`
- `design partner demo packet v0` теперь считать закрытым:
  - the repo now has one explicit Russian-language demo packet for the first serious buyer/design-partner call: public story, live product, deployment passport proof, handoff fit, and the next pilot step
  - landing, `/upgrade`, and `/commercial-license` now surface that packet directly, so buyer-facing demo proof no longer lives only in private walkthrough notes
  - latest rerun on `2026-04-18 18:59 +07` passed the changed-scope package verification on this host:
    - `npm --prefix frontend run build`
- Текущий незавершённый checkpoint:
  - `Stack deploy v0`, `deployment passport`, `Phase 4: Team and Agency Fit`, and `Phase 5: Commercial Packaging` are now honestly closed on the current runtime/workflow/buyer surfaces
  - the next unresolved gap now sits outside repo-local build work: first live-host demo recording, first real design-partner conversation, and first external validation loop for the same Russian/self-hosted wedge
  - latest rerun on `2026-04-18 18:59 +07` moved that checkpoint forward on the current dirty tree:
    - the buyer path now carries Russian install proof, Russian operator proof, a Russian pilot onboarding/support checklist, and a Russian design-partner demo packet directly on landing, `/upgrade`, and `/commercial-license`
    - `npm --prefix frontend run build`
  - latest rerun on `2026-04-18 13:35 +07` kept that checkpoint unchanged after the current dirty tree passed the same backend + frontend verification path again
  - latest rerun on `2026-04-18 13:49 +07` kept that checkpoint unchanged after the same dirty tree passed `make frontend` plus the template API unittest
  - latest rerun on `2026-04-18 13:52 +07` kept that checkpoint unchanged after the same dirty tree passed `npm --prefix frontend run build` plus `npm --prefix frontend run smoke:templates`
  - latest rerun on `2026-04-18 13:57 +07` kept that checkpoint unchanged after closing the duplicate-relabel guard inside the same template/context workflow
  - latest rerun on `2026-04-18 14:34 +07` kept that checkpoint unchanged after closing the direct-deploy guard and rerunning the backend + frontend smoke path on the same dirty tree
  - latest rerun on `2026-04-18 14:49 +07` moved that checkpoint forward after closing the first proactive template ownership slice and reconfirming the backend + frontend smoke path
  - latest rerun on `2026-04-18 15:17 +07` closed `runtime detail ownership cue v0` after fixing the frontend smoke lifecycle blocker on this host:
    - the runtime passport now answers who controls the runtime before logs/templates/delete tools compete for attention
    - plain-language summary plus copied passport text now carry the same ownership boundary, so handoff/export copy no longer drops who can actually perform live runtime actions
    - `scripts/frontend_runtime_smoke.sh` now has a member `admin-managed-runtime` guardrail for the ownership cue and hidden change tab
    - `scripts/frontend_smoke_shared.sh` now ignores non-numeric `fuser` output, so scenario cleanup no longer stalls on macOS while moving between runtime smoke ports
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
  - latest rerun on `2026-04-18 15:39 +07` closed `runtime export ownership cue v0` on the current dirty tree:
    - handoff copy/download surfaces now keep an explicit `Ownership boundary` line and structured ownership status/detail instead of dropping that cue once context leaves the page
    - filtered activity export now repeats ownership status/detail on every row, so CSV handoff still answers who controls the runtime without reopening deployment detail
    - `bash -n scripts/frontend_runtime_smoke.sh`
    - `NEXT_PUBLIC_SMOKE_TEST_MODE=1 NEXT_PUBLIC_SMOKE_USER_ROLE=member NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/Users/alexgerlitz/deploymate/scripts/font_google_mock_responses.cjs npm --prefix frontend run build`
    - `NEXT_PUBLIC_SMOKE_TEST_MODE=1 NEXT_PUBLIC_SMOKE_USER_ROLE=member node --input-type=module` runtime export ownership helper check passed
    - `npm --prefix frontend run smoke:runtime` failed again immediately at the shared loopback bind preflight with `PermissionError: [Errno 1] Operation not permitted`
  - latest rerun on `2026-04-18 16:49 +07` closed `runtime export release trace cue v0` on the current dirty tree:
    - handoff copy/download surfaces now keep an explicit `Release trace` line and structured release metadata instead of leaving the live rollout provenance inside lower runtime facts
    - runtime export smoke now requires the new release-trace cue in both the handoff card and the JSON/markdown/CSV helper path, so exported context keeps source/ref/commit/tag/trigger details without reopening deployment detail
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
  - latest rerun on `2026-04-18 16:56 +07` closed `runtime export health proof cue v0` on the current dirty tree:
    - handoff copy/download surfaces now keep an explicit `Health proof` line and structured health metadata instead of leaving runtime evidence inside the nested health payload
    - runtime export smoke now requires the new health-proof cue in both the handoff card and the JSON/markdown/CSV helper path, so exported context keeps checked-at/status-code/response-time evidence without reopening deployment detail
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
  - latest rerun on `2026-04-18 17:03 +07` closed `runtime export identity cue v0` on the current dirty tree:
    - handoff copy/download surfaces now keep an explicit `Runtime identity` line and structured identity metadata instead of leaving what-is-running context scattered across lower deployment fields
    - runtime export smoke now requires the new identity cue in both the handoff card and the JSON/markdown/CSV helper path, so exported context keeps shape/image/container/location details without reopening deployment detail
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
  - latest rerun on `2026-04-18 17:09 +07` closed `runtime export recent activity cue v0` on the current dirty tree:
    - handoff copy/download surfaces now keep an explicit `Recent activity` line and structured recent-event metadata instead of leaving that cue only inside the full activity list
    - runtime export smoke now requires the new recent-activity cue in both the handoff card and the JSON/markdown/CSV helper path, so exported context keeps logged-at/level/category/title/message details without reopening deployment detail
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
  - latest rerun on `2026-04-18 17:14 +07` closed `runtime export attention cue v0` on the current dirty tree:
    - handoff copy/download surfaces now keep an explicit `Attention` line and structured attention metadata instead of leaving current risk only inside the raw attention list
    - runtime export smoke now requires the new attention cue in both the handoff card and the JSON/markdown/CSV helper path, so exported context keeps count/severity/primary-message details without reopening deployment detail
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
  - latest rerun on `2026-04-18 17:23 +07` closed `runtime export next-step cue v0` on the current dirty tree:
    - handoff copy/download surfaces now keep an explicit `Next safe action` line and structured next-step value/detail instead of leaving the recommended action only inside live runtime copy
    - runtime export smoke now requires the new next-step cue in both the handoff card and the JSON/markdown/CSV helper path, and the detail page keeps the legacy `runtime-detail-next-step` hook so the existing runtime smoke contract stays valid
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
  - latest rerun on `2026-04-18 17:32 +07` closed `deployment passport phase-boundary checkpoint` on the current dirty tree:
    - the on-screen passport now carries review target, release trace, current risk, and safe change path together with the earlier runtime cues, so the steady-state operator story lives in one card instead of being split between passport, handoff, and lower action surfaces
    - runtime smoke now requires those extra passport cues plus the fresh-rollout `Verify before change` path, so the checkpoint stays honest instead of depending on visual inspection
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
  - latest rerun on `2026-04-18 17:38 +07` closed `deployment passport incident mode cue v0` on the current dirty tree:
    - failed or degraded runtime detail now turns the passport into an incident brief with likely cause, first checks, safe action now, and escalation path instead of leaving that framing scattered across lower cards
    - runtime smoke now requires incident mode on failed runtime detail and requires it to stay absent on the healthy passport path, so the switch is held as real behavior rather than copy drift
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
  - latest rerun on `2026-04-18 17:53 +07` closed `deployment passport recovery path cue v0` on the current dirty tree:
    - healthy, fresh-rollout, and failed passport states now keep an explicit `Recovery path` cue, so the operator can see the safe rollback/redeploy posture from the passport itself instead of opening lower recovery cards first
    - runtime smoke now requires that recovery cue on those three single-runtime states, so recovery wording stays honest across stable, verify-first, and failed review paths
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
  - latest rerun on `2026-04-18 17:59 +07` closed `deployment passport stack recovery cue v0` on the current dirty tree:
    - stack passport now keeps stack-specific recovery wording with the saved health target and whole-stack replacement boundary instead of falling back to single-runtime rollback/redeploy language
    - runtime smoke now requires that wording on the stack detail path, so stable stack recovery posture stays explicit in the same passport artifact as the rest of the runtime story
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
  - latest rerun on `2026-04-18 18:12 +07` closed `deployment passport stack incident cue v0` on the current dirty tree:
    - stack incident detail now keeps stack-specific passport incident wording with stack health failure, saved-health-target-first checks, review-first safe action, guarded whole-stack escalation, and `Diagnose, then replace stack` recovery posture instead of falling back to the generic single-runtime incident brief
    - runtime smoke now requires healthy stack detail to stay out of incident mode and requires the dedicated stack-incident path to keep those stack-specific incident and recovery cues, so `deployment passport` no longer has an obvious stack-state hole
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
  - latest rerun on `2026-04-18 18:32 +07` closed `agency fit activity trail checkpoint v0` on the current dirty tree:
    - handoff and export surfaces now keep one explicit `Activity trail` cue beside `Recent activity`, and the detail page quick reference plus activity card now summarize the current trail directly instead of leaving that story only inside the raw event list
    - runtime smoke now requires the new activity-trail helper/export contract and the on-screen handoff/detail summary, so phase-4 activity-trail quality no longer depends on visual review
    - `bash -n scripts/frontend_smoke_shared.sh scripts/frontend_runtime_smoke.sh`
    - `npm --prefix frontend run smoke:runtime`
- Следующий bounded runtime порядок:
  1. external live-host demo recording and first design-partner run
- Guardrails на следующий проход:
  - не расширять packaging work в broad repo-root doc rewrite или generic marketing pages; следующий шаг держать внутри operator/install materials and buyer-proof surfaces
  - не считать single-container deployments допустимым долгоживущим ceiling

## Week 1 Result

- The main product story is now more explicit: `server -> deploy -> observe`.
- The first pass should stay inside four surfaces only:
  - `Overview`
  - `Servers`
  - `Deployments`
  - `Templates`
- Admin, recovery, import, audit-heavy, and queue-heavy flows remain valid, but should stay secondary until the main path is already clear.
- The current UI standard is no longer “show everything important”.
- The new standard is “show the next obvious action first”.

## Week 2 Focus

- Make the product understandable to a full novice without author explanation.
- Turn `/app` into a simple `what this is / what to do first / what happens next` screen.
- Reframe `/app/server-review` as `Step 1` instead of an operator review console.
- Reframe `/app/deployment-workflow` as `Step 2` with plain language about image, deploy, and next action.
- Remove or demote text that sounds like internal ops jargon on the first pass.

## Week 2 Progress

- The `Server Review -> Deployment Workflow` bridge is now partially real, not just conceptual.
- When a reviewed server is ready, `server-review` now opens `deployment-workflow` with that target preselected.
- The create form now says more clearly when the target already came from `Server Review`, so the user knows the next move is simply setting the image.
- After the first successful deploy, the success state now points straight to runtime detail instead of leaving the user in a vague success-only state.
- The first-pass copy is now much closer to a real novice path:
  - `/app` now explains the product in a three-step story instead of only reflecting workspace state
  - `/app` also now starts with one explicit `Do this now` action instead of making the user choose from the whole page
  - `server-review` now reads as one job: save one server target, check it, then move on
  - opening a saved server now shows ordered tasks first, while edit/delete moved behind a secondary disclosure
  - `deployment-workflow` now explains Step 2 with one-lane-at-a-time guidance and simpler language around image, template, and health
- The blocked member path is now more internally consistent:
  - `/app` no longer presents Step 2 and Step 3 as if they were already open before admin Step 1 is complete
  - `/app/server-review` no longer shows a false remote-only CTA into `Deployment Workflow`
  - `/app/deployment-workflow` now opens the live lane directly when a blocked member already has deployments to review
- The first-time admin overview is now stricter too:
  - when no server is connected yet, `/app` no longer renders Step 2 as if app choice were already open
  - `/app` also no longer renders Step 3 as if live runtime review already existed before the first deploy
  - the new `smoke:beginner` guardrail now checks those blocked-step states directly
- `server-review` is now stricter in the first saved-but-unconfirmed state too:
  - once one server already exists, the live check queue now appears before the `add another server` form
  - the page now stops competing with its own main action when the right next move is `run one check`
  - `smoke:servers` now includes a pending-server fixture pass to hold that ordering in place
- `deployment-workflow` is now stricter in the first-deploy-after-server-review state too:
  - when Step 1 is already done and no deployment exists yet, the main CTA stays `Create deployment`
  - an empty first draft no longer gets mislabeled as the primary blocker just because `Image` is still blank
  - `smoke:beginner` now includes a server-ready first-deploy fixture so templates do not hijack the main lane again
- The first manual walkthrough pass found one remaining Step 2 hesitation:
  - screen: `/app/deployment-workflow` after coming from `Server Review`
  - issue: the empty first draft still showed `Image is required.` before the user typed anything
  - fix: preflight errors now wait until the user has actually started a rollout draft
  - guardrail: the first-deploy beginner smoke now fails if that premature error comes back
- The first Step 3 runtime walkthrough pass found one remaining healthy-detail hesitation:
  - screen: `/deployments/smoke-deployment` with a running and healthy runtime
  - issue: the primary action still pushed `Prepare rollout change` even though the safer next step was to open the running app and verify it
  - fix: healthy runtimes with a live endpoint now make `Open running app` primary and keep rollout changes secondary
  - guardrail: `smoke:runtime` now fails if a healthy runtime detail makes `Prepare rollout change` the main next-step action again
- The failed-runtime walkthrough path is now review-first too:
  - screen: `/app/deployment-workflow -> /deployments/review-worker`
  - issue: the workflow queue exposed delete before the failed runtime had been reviewed, and smoke detail did not represent the failed deployment
  - fix: failed cards now point to detail review before delete, and smoke detail resolves `review-worker` as a failed runtime
  - guardrail: `smoke:runtime` now fails if the failed queue exposes early delete or if failed detail stops making `Review runtime issues` primary
- The failed-runtime focus card now makes the review action explicit:
  - screen: failed primary card on `/app/deployment-workflow`
  - issue: the card no longer exposed delete first, but its main CTA still said `View details`, which left the safest next step too vague during a failed rollout
  - fix: failed focus cards now make `Review runtime issues` the primary action and keep the inline warning aligned with that same review-first wording
  - guardrail: `smoke:runtime` now fails if the failed focus card loses its primary `Review runtime issues` CTA
- The live queue now uses one action hierarchy across focus and secondary cards:
  - screen: `/app/deployment-workflow`
  - issue: focus cards had started using review-first/open-first actions, but secondary cards still collapsed everything into low-emphasis `View details` and `Open app` links
  - fix: runtime cards now follow one status-based matrix everywhere in the queue: failed cards make `Review runtime issues` primary, healthy cards with a URL make `Open app` primary, and detail review stays visibly secondary when the app is already reachable
  - guardrail: `smoke:runtime` now checks healthy secondary cards, healthy focus cards, and a failed-secondary smoke scenario so queue action hierarchy stays aligned
- The internal-only runtime path now follows the same review-first story:
  - screen: `/app/deployment-workflow` and `/deployments/internal-runtime`
  - issue: healthy runtimes without a public URL still fell back to vague `View details` language in the queue, while detail copy said the runtime was stable without making the review step explicit enough
  - fix: no-public-URL runtime cards now make detail review the primary action, running internal-only cards use `Review stable runtime`, and internal-only detail now explains that overview/ports/health/activity review comes before rollout changes
  - guardrail: `smoke:runtime` now checks an internal-only detail fixture plus focus/secondary workflow cards so private-runtime review cannot regress back into ambiguous queue copy
- The blocked member overview CTA now says what the click actually does:
  - screen: member remote-only `/app` before admin Step 1 is complete
  - issue: the primary CTA still said `See what opens next`, which was directionally correct but too vague for a first-time user trying to understand why rollout is blocked
  - fix: the blocked member overview now uses `Review rollout status`, matching the fact that the click opens the blocked deployment workflow state instead of a hidden next-step surprise
  - guardrail: `smoke:beginner` now fails if the member waiting overview loses that explicit rollout-status action
- The ready server-review state now points forward instead of backward:
  - screen: ready server task panel on `/app/server-review`
  - issue: once a server was already ready, the open task grid still kept `Check server readiness` as a primary action, so the page visually competed with the actual next move into app setup
  - fix: ready server cards now make `Choose what to run` the primary CTA, while readiness check is demoted to an explicit recheck-only action
  - guardrail: `smoke:servers` now runs a ready-server fixture and fails if the continue action stops being primary or the recheck action regains primary weight
- The first-deploy workflow tabs now stop competing with the blank create path:
  - screen: `/app/deployment-workflow` right after Step 1 is done and no deployment exists yet
  - issue: the page still showed `Check live apps` and a neutral template tab before the first deploy existed, which made Step 2 read like several equal paths instead of one obvious first click
  - fix: the live-review tab now stays hidden until at least one deployment exists, and the template path is explicitly framed as `Use saved setup instead` with a first-deploy fallback note
  - guardrail: `smoke:beginner` now fails if the first-deploy fixture brings back the live tab or loses the explicit template-fallback framing
- Template deploy success now lands on the same next step as manual create:
  - screen: template deploy success banner on `/app/deployment-workflow`
  - issue: manual create already made `Open runtime detail` the obvious next click, but template deploy success still fell back to low-emphasis `View details` copy without a secondary route back into the live queue
  - fix: template deploy success now uses the same review-first wording as manual create, with `Open runtime detail` as the primary action and `Review live queue` as the secondary follow-up
  - guardrail: `smoke:runtime` now runs a template-success workflow fixture and fails if runtime detail stops being the primary success action
- The first runtime-detail screen now preserves the verify-first story after success:
  - screen: `/app/deployment-workflow -> /deployments/*` after a fresh create/template success click
  - issue: the success banner pointed to runtime detail correctly, but the detail page still immediately offered `Prepare rollout change` as the secondary path even when the rollout had just been created and still needed first verification
  - fix: workflow success links now carry explicit `workflow-success` context, and healthy runtime detail uses that context to show a fresh-rollout review banner plus `Review runtime overview` instead of early change-prep
  - guardrail: `smoke:runtime` now loads healthy runtime detail with `?source=workflow-success` and fails if the fresh-rollout bridge banner or review-first secondary action disappears
- The fresh-rollout detail path now closes the verification loop more explicitly:
  - screen: healthy `/deployments/*?source=workflow-success` and success banners on `/app/deployment-workflow`
  - issue: even after the first bridge, a fresh rollout still landed on a fairly generic overview, and smoke did not yet prove that create/template success links were preserving the workflow-success context
  - fix: fresh rollout detail now shows a dedicated `verify app / health / activity` checklist in overview, create success got its own smoke fixture, and both create/template success links are now held to the `workflow-success` href contract
  - guardrail: `smoke:runtime` now fails if the fresh-rollout checklist disappears or if either success path stops linking into detail with `?source=workflow-success`
- The member-safe pass found one blocked-path leak:
  - screen: member `/app/deployment-workflow` and member runtime detail in remote-only mode
  - issue: blocked create/template lanes and runtime mutation controls were hidden but still rendered in HTML
  - fix: member remote-only workflow no longer renders blocked create/templates lanes, and admin-managed runtime detail no longer renders redeploy/delete controls
  - guardrail: `smoke:beginner` now checks that member workflow/detail HTML stays free of those controls while preserving `Open running app` and `Review runtime issues`
- The next member-safe pass closed one remaining identity leak:
  - screen: member live queue on `/app/deployment-workflow` and member `/deployments/*` detail for admin-managed remote runtimes
  - issue: the blocked/member-safe path still rendered admin-managed server labels like `Ops Batch` and `Smoke VPS` in review UI even after mutation controls were hidden
  - fix: member-safe runtime review now falls back to generic admin-managed target labels instead of server inventory names/host labels
  - guardrail: `smoke:beginner` now fails if the member workflow/detail fixtures expose those admin-managed server identities again
- The member export/handoff pass closed the same boundary at generated-payload level:
  - screen: member runtime detail utility/handoff layer
  - issue: the visual UI was generic, but downloadable incident JSON/markdown and copy/export payloads could still be built from raw deployment/diagnostics/activity objects
  - fix: member export payloads now strip server inventory fields, replace admin-managed targets with generic labels, redact matching activity/attention text, and omit remote suggested ports
  - guardrail: `smoke:beginner` now imports the payload sanitizer directly and fails if member exports contain raw server inventory keys, server names, SSH targets, server ids, or suggested ports
- The backend now enforces the same member boundary instead of relying on frontend sanitizers:
  - issue: owned legacy/admin-managed remote deployments and templates could still expose `server_id`, `server_name`, `server_host`, or SSH target text through API reads/exports/activity, and member API calls could still reach remote runtime live actions
  - fix: non-admin API reads/exports redact admin-managed server inventory fields, activity/notifications redact matching server identity text, and remote runtime diagnostics/logs/health/redeploy/delete now return admin-only `403`
  - guardrail: `tests.test_member_ownership_isolation` now covers owned remote deployment/template reads, ops exports, notifications/activity redaction, and blocked remote live/mutation actions
- The frontend now understands backend-redacted admin-managed runtimes:
  - issue: once the backend hid `server_id`, member runtime detail could mistake an admin-managed remote runtime for a local target and show dead mutation/template controls
  - fix: API responses include a non-sensitive `server_managed_by_admin` marker, and runtime detail uses it to hide redeploy/delete/local-template save, skip live diagnostics/logs/health calls, and show clear admin-managed live-check/template notices
  - guardrail: `smoke:beginner` now renders a redacted `admin-managed-runtime` detail fixture and fails if mutation controls, local template save, local-runtime copy, or server identity returns
- The member deployment workflow now separates two remote-only states:
  - if member already has deployments, `/app/deployment-workflow` frames the page as live review with admin-managed targets instead of saying Step 2 is still waiting
  - member live-search no longer matches hidden admin-managed server names/hosts
  - if member has no deployments, the page still stays blocked on admin Step 1 and keeps create/templates/live cards out of the HTML
  - guardrail: `smoke:beginner` now checks both the live-review member path and the waiting-for-admin member path
- The member overview now follows the same split:
  - if member already has deployments, `/app` makes live review the main path and keeps new remote deployment gated behind admin target control
  - the smoke fixture for that path uses redacted admin-managed deployments so the overview does not reintroduce server identity leaks
  - guardrail: `smoke:beginner` now checks the member overview live-review path separately from the waiting path
- The admin overview now has an explicit server-ready/no-deployments guardrail:
  - if one server is already connected and no deployments exist, `/app` points to first deployment instead of server setup
  - guardrail: `smoke:beginner` now checks that the hero CTA is `Launch first deployment`, Step 2 is active, and `Add first server target` does not return as the primary action
- The admin first-deploy bridge now keeps target context from overview into workflow:
  - if overview knows exactly one ready server and no deployments exist, `/app` links into `deployment-workflow` with that target already selected
  - `deployment-workflow` now explains when the first-deploy target came from Overview, not only from Server Review
  - guardrail: `smoke:beginner` now follows the overview link, checks the preserved `server` query, and fails if Step 2 loses the selected target or shows a premature image error
- The overview first screen now has a stronger product-entry hierarchy:
  - screen: `/app`
  - issue: the overview story was behaviorally clearer, but still felt too much like an admin/status dashboard with several similarly weighted cards
  - fix: `/app` now opens with a large product statement, one focused next-step panel, a compact signal strip, and then the three-step path; ops/admin depth stays below the first-pass path
  - guardrail: `smoke:beginner` now requires the product hero/signal strip and checks that hero -> next task -> three-step path render before operations depth
- The overview first screen now reduces scroll friction:
  - screen: `/app`
  - issue: after the product-entry pass, the user still had to scroll down to understand the three-step usage model
  - fix: the hero now includes a top quick-action rail for `Connect server`, `Deploy app`, and `Review health`, using the same real enabled/blocked state as the beginner path
  - fix: the longer three-step explanation and plain-language copy are now collapsed details, so the first screen stays action-first instead of reading-first
  - guardrail: `smoke:beginner` now requires the quick-action rail and checks it renders before the deeper path/ops sections
- The overview quick-action layer now reads more like one premium step grid than a button strip:
  - screen: `/app`
  - issue: the first quick-action pass reduced scrolling, but the dark active middle button still looked like an extra primary CTA and made the top row feel visually uneven
  - fix: the top layer is now a three-card glass grid with equal step cards, soft state tints, clearer `Start here / Ready / Locked` status labels, and a lighter current-step action treatment instead of a black active slab
  - fix: the top surfaces now use a restrained glass treatment with soft neutral/ice/sage tones, while the rest of the page stays quiet and readable
  - guardrail: the existing beginner smoke still holds the quick-action layer above the deeper overview/ops sections, and live browser smoke now validates the desktop grid/collapsed-detail shape before handoff
- The product shell is now moving out of the page body and into a shared top bar:
  - screen: `/app`, `/app/server-review`, `/app/deployment-workflow`, `/deployments/*`, `/change-password`
  - issue: `/app` kept turning into a giant hero with secondary explanation blocks, while account/help controls were not anchored as one shared product shell
  - fix: workspace routes now use one fixed top bar with a centered DeployMate badge, right-side `Help`, `Profile`, and `Logout`, while `/login` stays clean and separate
  - fix: `/app` itself now starts as one full-width action board for `Step 1 / Step 2 / Step 3` instead of hero + signal strip + next panel; deeper ops/admin sections stay below the fold
  - guardrail: `smoke:beginner` now checks the new action-surface structure and no longer depends on the old hero/next-panel markup
- The healthy runtime happy path is now reinforced in workflow as well as detail:
  - on the primary healthy runtime card in `deployment-workflow`, `Open app` now comes first and uses the primary action styling
  - `smoke:runtime` now runs a healthy-only workflow fixture so the safe verify path is checked in live queue before detail review
  - the existing detail guardrail still holds `Open running app` as the main next step on healthy runtime detail
- Local frontend smoke for the beginner path passed after this slice:
  - `scripts/frontend_beginner_smoke.sh`
  - `scripts/frontend_servers_smoke.sh`
  - `scripts/frontend_runtime_smoke.sh`
- The remaining question is no longer "do we have the right frame?" but "does a real beginner now follow it without hesitation?"

## Current State

- Local working branch for current product work: `deploymate/product-wip`
- Latest published `develop` commit: `0384fa3`
- Staging host `deploymate`:
  - `/opt/deploymate` branch `develop` currently points to `0384fa3`
  - remote `origin/develop` also points to `0384fa3`
  - pre-cleanup dirty remote state was preserved in backup branch `codex/remote-host-backup-20260410-023502`
- Latest validated package now includes:
  - member/admin runtime ownership isolation
  - shared auth throttling, explicit bootstrap admin password, strict SSH trust with persistent known_hosts
  - production env audit and production contract gate
  - remote release smoke that can run on the deploy host and can pin host resolution explicitly
  - successful end-to-end staging walkthrough with runtime smoke create/health/diagnostics/logs/activity/delete
  - first-pass beginner story rewrite across overview, server step, and deployment step
  - blocked member first-pass alignment across overview, server step, and deployment step
  - local frontend smoke confirmation for `/app`, `/app/server-review`, `/app/deployment-workflow`, and deployment detail
- Host-specific note:
  - saved runtime smoke server `prod-runtime-smoke` currently points to `103.88.241.103`
  - do not switch it back to `deploymatecloud.ru` until backend-container DNS resolution is explicitly re-verified

## Product Rule

- интерфейс DeployMate должен становиться не просто функциональным, а интуитивно понятным
- для любого важного сценария пользователю должно быть очевидно, куда нажать, чтобы пойти по основному пути
- главный следующий шаг на экране должен читаться сразу, без чтения документации и без догадок
- если на экране есть много действий, главный путь не должен теряться среди второстепенных controls
- если логика уже работает, но пользователь всё ещё не понимает, что делать дальше, такой экран считать незаконченным

Практический вывод из текущего состояния проекта:

- сейчас проект уже сильнее как operator/review console, чем как интуитивный продуктовый интерфейс
- главная UX-проблема не в отсутствии функций, а в том, что основной путь местами тонет среди exports, filters, refresh и второстепенных tools
- ближайшие продуктовые пакеты нужно оценивать не только по safety и полноте логики, но и по тому, стал ли следующий шаг очевиднее для клиента

## Short Version

Если совсем по-человечески:

- scaffold уже не просто “улучшали”
- его реально прогнали на живой продуктовой задаче
- результат этой проверки: появился новый surface [server-review/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/server-review/page.js)
- это теперь полноценное место для работы с серверами

Что это значит:

- серверы больше не должны жить в двух местах сразу
- `/app` теперь обзорный экран
- `/app/deployment-workflow` теперь основной экран для rollout creation, template reuse и live deployment review
- `/app/server-review` теперь основной экран для серверной работы
- deployment detail теперь лучше объясняет текущее runtime-состояние и даёт готовый handoff-артефакт, а не только raw diagnostics
- backend activity теперь лучше объясняет не только результат mutation, но и сам старт runtime-операции
- restore dry-run теперь понятнее отвечает на вопрос “готов ли этот bundle хотя бы к import preparation”
- restore dry-run теперь ещё и заранее ловит битые связи между секциями bundle
- restore workspace теперь проще отфильтровать под конкретный риск, а не глазами читать всё подряд
- restore workspace теперь ещё и явно показывает, что можно готовить к import дальше, что держать на merge review, а что оставлять только в dry-run
- удаление deployment теперь требует явного review и typed confirmation вместо одного случайного confirm popup

## What Was Actually Done

### 1. Scaffold был проверен на реальной фиче

Через scaffold был создан и затем доведён до реального состояния новый surface:

- [server-review/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/server-review/page.js)

Это уже не scaffold-demo и не mock page.

Это живая страница поверх настоящего server API.

### 2. Server review стал полноценным контуром

Сейчас в `server-review` есть:

- просмотр серверов
- поиск и review filters
- table view
- saved views
- export
- локальный audit trail на странице
- create server
- edit server
- test connection
- diagnostics
- suggested ports
- delete server

Простой вывод:

- серверный workflow теперь собран в одном месте
- для работы с серверами не нужно прыгать обратно на `/app`

### 3. Старый дублирующий server flow на `/app` был упрощён

На [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/page.js):

- серверный блок больше не тащит на себе полный CRUD + diagnostics flow
- там теперь короткий обзор и вход в `Server review`
- в верхних actions тоже добавлена ссылка на `Server review`

Простой вывод:

- `/app` снова стал обзорной панелью
- `server-review` стал рабочим экраном по серверам

### 4. Лишний backend starter-мусор был удалён

Scaffold сначала нагенерил отдельный fake backend под `server_review`, но после перевода страницы на реальные `/servers` endpoints этот слой стал лишним.

Он был убран.

Что осталось правильным:

- реальный backend `/servers`
- реальный frontend `server-review`

Что это значит:

- нет дублирующего API только ради шаблона
- меньше лишней поддержки

### 5. Реальный update flow серверов добавлен в backend

На backend добавлен настоящий update путь для серверов:

- db update:
  - [db.py](/Users/alexgerlitz/deploymate/backend/app/db.py)
- route update:
  - [servers.py](/Users/alexgerlitz/deploymate/backend/app/routes/servers.py)
- schema update:
  - [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- test update:
  - [test_server_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_server_api_flow.py)

Простой вывод:

- сервер теперь можно не только создать и удалить, но и нормально редактировать

### 6. Runtime detail стал нормальным handoff surface

На [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js):

- добавлен plain-language runtime summary для людей без технического контекста
- добавлен downloadable incident snapshot в JSON
- добавлен downloadable handoff в Markdown
- activity лента получила search / level filter / sort
- текущий activity view теперь можно экспортировать в CSV

На [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh):

- runtime smoke теперь проверяет новый handoff/export слой deployment detail

Простой вывод:

- deployment detail теперь годится не только для диагностики, но и для нормальной передачи состояния дальше
- оператору больше не нужно вручную собирать картину из health, logs, diagnostics и activity

### 7. Backend activity стал полезнее для runtime review

На [deployment_mutations.py](/Users/alexgerlitz/deploymate/backend/app/services/deployment_mutations.py):

- create/redeploy/delete теперь пишут явные `started` activity events
- стартовые activity messages теперь содержат более человеческое описание target, image, ports и env-shape
- failure activity messages теперь лучше объясняют, на каком шаге и в каком target произошёл сбой

На [test_deployment_routes.py](/Users/alexgerlitz/deploymate/backend/tests/test_deployment_routes.py) и [test_deployment_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_deployment_api_flow.py):

- добавлены проверки на эти новые mutation-start events и richer activity messages

Простой вывод:

- runtime detail activity теперь показывает более полезную историю
- при create/redeploy/delete оператору легче понять не только чем всё закончилось, но и что именно система пыталась сделать

### 8. Restore dry-run стал явным import-preparation decision surface

На backend:

- [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
- [test_restore_dry_run.py](/Users/alexgerlitz/deploymate/backend/tests/test_restore_dry_run.py)

Что добавлено:

- restore summary теперь возвращает `readiness_status`
- summary теперь возвращает human-readable `plain_language_summary`
- summary теперь возвращает явный `next_step`
- summary теперь возвращает `highest_risk_sections`

На frontend:

- [users/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
- [admin-export-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-export-utils.js)
- [admin-smoke-fixtures.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-smoke-fixtures.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- import readiness card
- next-step card
- plain-language import-preparation summary
- markdown export для restore preparation handoff
- restore smoke теперь проверяет новый preparation слой

Простой вывод:

- оператору теперь проще понять, можно ли вообще двигаться к import preparation
- даже человеку без технического бэкграунда стало проще объяснить, почему bundle safe, review или blocked

### 9. Restore dry-run теперь ловит cross-section reference risks

На backend:

- [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
- [test_restore_dry_run.py](/Users/alexgerlitz/deploymate/backend/tests/test_restore_dry_run.py)

Что добавлено:

- upgrade requests теперь предупреждают о ссылках на отсутствующих пользователей
- templates теперь предупреждают о ссылках на отсутствующие серверы
- deployments теперь блокируются, если ссылаются на отсутствующий сервер
- deployments теперь предупреждают о ссылках на отсутствующий template

Простой вывод:

- bundle теперь раньше сообщает, что в нём сломано между секциями
- оператору не нужно догадываться, почему import preparation нельзя считать безопасным

### 10. Restore workspace стал полезнее для ручного review

На frontend:

- [users/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
- [admin-export-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-export-utils.js)

Что добавлено:

- search по restore sections
- highest-risk-only filter
- summary по текущей видимой выборке sections
- CSV export именно текущего видимого restore view
- per-section issue summary прямо в карточках sections

Простой вывод:

- теперь проще быстро сузить restore review до реальных проблемных зон
- и проще отдать кому-то именно текущую отфильтрованную картину, а не весь отчёт целиком

### 11. Delete deployment получил нормальные destructive guardrails

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)

На smoke checks:

- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что изменилось:

- вместо простого `window.confirm` теперь открывается delete review panel
- пользователь видит impact summary перед удалением
- для удаления нужно руками ввести имя deployment
- smoke checks теперь проверяют новый delete-review слой и новые restore preparation controls

Простой вывод:

- случайно удалить deployment стало заметно сложнее
- runtime detail теперь лучше подходит для осторожной операторской работы, а не только для быстрых кликов

### 12. Restore import preparation стал более структурированным рабочим слоем

На backend:

- [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
- [test_restore_dry_run.py](/Users/alexgerlitz/deploymate/backend/tests/test_restore_dry_run.py)

Что добавлено:

- каждый restore section теперь возвращает `preparation_mode`
- каждый restore section теперь возвращает `recommended_action`
- общий restore summary теперь возвращает `preparation_summary`
- summary теперь считает секции по четырём режимам: `prepare_import`, `merge_review`, `validate_only`, `dry_run_only`

На frontend:

- [users/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
- [admin-export-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-export-utils.js)
- [admin-smoke-fixtures.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-smoke-fixtures.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- новая `Preparation mix` card в restore overview
- новый preparation summary внутри import-preparation card
- per-section preparation mode и recommended action прямо в restore section cards
- markdown/CSV export теперь тоже тащит structured preparation guidance
- restore smoke anchors теперь проверяют новый planning слой

Простой вывод:

- restore dry-run теперь объясняет не только риск, но и следующий безопасный способ работы с каждой секцией bundle
- оператору проще отделить реальные import candidates от merge-review и dry-run-only зон

### 13. Появился узкий DeployMate vertical feature scaffold

На repo tooling:

- [scaffold_deploymate_feature.sh](/Users/alexgerlitz/deploymate/scripts/scaffold_deploymate_feature.sh)
- [Makefile](/Users/alexgerlitz/deploymate/Makefile)
- [README.md](/Users/alexgerlitz/deploymate/README.md)

Что добавлено:

- новый `make scaffold-deploymate-feature`
- wrapper поверх `scaffold_deploymate_surface.sh` для текущих DeployMate-паттернов
- три узких режима: `review-workflow`, `recovery-workflow`, `guardrail-workflow`
- кроме базового surface scaffold теперь сразу создаются:
  - frontend feature-pack helper stub
  - generated smoke checks file
  - dedicated frontend smoke runner script

Что это значит practically:

- следующая review/recovery/admin-heavy фича теперь стартует не только со страницы и backend route
- она сразу получает ещё и project-specific pack для summary/export/smoke слоя
- это должно уменьшить повторную ручную сборку на ближайших пакетах, а не когда-нибудь потом

### 14. Import review стал отдельным recovery workspace

На backend:

- [import_review.py](/Users/alexgerlitz/deploymate/backend/app/routes/import_review.py)
- [import_review.py](/Users/alexgerlitz/deploymate/backend/app/services/import_review.py)
- [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- [test_import_review_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_import_review_api_flow.py)

Что добавлено:

- новый `GET /import-review`
- backend собирает current backup bundle, restore dry-run и controlled import plan в один workspace response
- `import-review` больше не starter queue, а recovery-specific review surface

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/import-review/page.js)
- [import-review-feature-pack.js](/Users/alexgerlitz/deploymate/frontend/app/lib/import-review-feature-pack.js)
- [import-review.txt](/Users/alexgerlitz/deploymate/scripts/generated_smoke_checks/import-review.txt)

Что добавлено:

- отдельная страница `/app/import-review`
- bundle card, dry-run readiness card и plan-status card
- controlled import boundary card с scope summary, reviewer guidance и typed confirmation phrase
- фильтрация import-plan sections по `plan_state` и search
- JSON / Markdown / visible-sections CSV export для текущего import review
- ссылка обратно в `/app/users` для полного restore workspace

Что это делает:

- controlled import/apply boundary теперь видна как отдельный экран, а не только как кусок внутри users/restore workspace
- оператору проще быстро увидеть текущий backup, readiness и import scope без лишнего admin шума

### 15. Restore и import-review теперь связаны в один recovery маршрут

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/import-review/page.js)
- [admin-page-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-page-utils.js)
- [import-review-feature-pack.js](/Users/alexgerlitz/deploymate/frontend/app/lib/import-review-feature-pack.js)
- [import-review.txt](/Users/alexgerlitz/deploymate/scripts/generated_smoke_checks/import-review.txt)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- из restore import plan card теперь можно открыть dedicated `import-review` именно с тем bundle, dry-run и import plan, которые оператор только что собрал
- handoff идёт через browser session storage, без отдельного backend session-layer
- `import-review` теперь явно показывает source workspace: `restore handoff` или `live backup`
- на `import-review` можно принудительно сбросить handoff и вернуться к current live backup baseline
- smoke anchors теперь покрывают и restore-side handoff кнопку, и import-review source card

Что это значит practically:

- recovery flow больше не выглядит как два несвязанных экрана
- review теперь можно продолжать на отдельной странице без потери именно того bundle-контекста, который только что проверяли
- при этом всё ещё остаётся явная возможность вернуться к live backup и не перепутать источники данных

### 16. Import review получил готовый approval trail для handoff

На backend:

- [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
- [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- [test_import_review_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_import_review_api_flow.py)

Что добавлено:

- import plan summary теперь отдаёт `approval_packet_title`
- import plan summary теперь отдаёт `approval_subject_line`
- import plan summary теперь отдаёт `approval_share_summary`
- import plan summary теперь отдаёт `approval_next_step`

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/import-review/page.js)
- [import-review-feature-pack.js](/Users/alexgerlitz/deploymate/frontend/app/lib/import-review-feature-pack.js)
- [import-review.txt](/Users/alexgerlitz/deploymate/scripts/generated_smoke_checks/import-review.txt)

Что добавлено:

- approval card теперь показывает packet title, subject line, share summary и next step
- можно скачать не только markdown approval packet, но и structured `approval trail JSON`
- можно скопировать короткий handoff summary без ручной сборки текста

Что это значит practically:

- `import-review` теперь не только объясняет решение, но и сразу собирает короткий пакет для передачи дальше
- оператору не нужно руками пересказывать bundle name, plan status, decision question и следующий шаг
- approval handoff стал больше похож на законченный workflow-артефакт, а не на один markdown-файл

### 17. Import review теперь доводит review до controlled preparation handoff

На backend:

- [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
- [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- [test_import_review_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_import_review_api_flow.py)

Что добавлено:

- import plan summary теперь отдаёт `preparation_status`
- import plan summary теперь отдаёт `preparation_packet_title`
- import plan summary теперь отдаёт `preparation_share_summary`
- import plan summary теперь отдаёт `preparation_summary`
- import plan summary теперь отдаёт `preparation_checklist`
- import plan summary теперь отдаёт `preparation_handoff_note`
- import plan summary теперь отдаёт `preparation_next_step`

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/import-review/page.js)
- [import-review-feature-pack.js](/Users/alexgerlitz/deploymate/frontend/app/lib/import-review-feature-pack.js)
- [import-review.txt](/Users/alexgerlitz/deploymate/scripts/generated_smoke_checks/import-review.txt)

Что добавлено:

- новый `Controlled preparation handoff` card внутри `import-review`
- markdown export для preparation packet
- structured `preparation trail JSON`
- copy action для короткой preparation summary

Что это значит practically:

- recovery flow теперь не обрывается на approval handoff
- следующий безопасный шаг тоже упакован: можно передать дальше scope, checklist и next step для preparation работы
- это всё ещё не apply-path и не скрытый destructive flow, а отдельный handoff на следующую безопасную стадию

### 18. Началась UX-пересборка вокруг явного главного действия

На frontend:

- [admin-ui.js](/Users/alexgerlitz/deploymate/frontend/app/app/admin-ui.js)
- [users/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
- [server-review/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/server-review/page.js)
- [import-review/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/import-review/page.js)
- [import-review.txt](/Users/alexgerlitz/deploymate/scripts/generated_smoke_checks/import-review.txt)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- `AdminPageHeader` теперь умеет принимать явный `primaryAction`, а `Refresh` больше не считается главным действием по умолчанию
- `Users` header теперь ведёт прямо к `Create user`
- `Server Review` header теперь ведёт прямо к `Add server target`
- `Import Review` header теперь ведёт прямо к `Download preparation packet`
- внутри `import-review` появился отдельный `Main next step` card, который явно говорит, что делать дальше после review

Что это значит practically:

- проект начал переход от “мощной панели инструментов” к более понятному продукту с читаемым главным путём
- на ключевых admin/recovery поверхностях теперь заметнее, что является главным действием, а что просто вспомогательным инструментом
- это ещё не полный UX-рефактор всего продукта, но правильный системный сдвиг уже начался

### 19. `/app` начал превращаться в сценарный вход в продукт

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/page.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- на верхнем уровне `/app` появился отдельный сценарный блок с понятными путями
- теперь сверху страницы виднее основные сценарии: deployment, runtime review, server review и recovery/admin path
- этот блок не заменяет deeper workspace sections ниже, а помогает сначала выбрать очевидный основной путь

Что это значит practically:

- `/app` стал меньше похож на просто обзорный dashboard и больше на продуктовый входной экран
- новый пользователь быстрее понимает не только текущее состояние системы, но и с какого сценария начать работу
- это продолжает тот же UX-сдвиг: сначала очевидный next step, потом уже детали и второстепенные инструменты

### 20. Recovery path получил явную последовательность шагов

На backend:

- [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
- [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- [test_import_review_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_import_review_api_flow.py)

Что добавлено:

- import plan summary теперь отдаёт `workflow_focus`
- import plan summary теперь отдаёт `workflow_summary`
- import plan summary теперь отдаёт `workflow_steps`

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/import-review/page.js)
- [import-review-feature-pack.js](/Users/alexgerlitz/deploymate/frontend/app/lib/import-review-feature-pack.js)
- [import-review.txt](/Users/alexgerlitz/deploymate/scripts/generated_smoke_checks/import-review.txt)

Что добавлено:

- в `import-review` появился отдельный `Recovery sequence` card
- экран теперь явно показывает текущий фокус и порядок безопасных следующих шагов
- markdown export теперь тоже тащит sequencing summary

Что это значит practically:

- recovery flow теперь легче воспринимается как последовательность действий, а не как набор отдельных packet/export блоков
- пользователю проще понять, где он находится сейчас: на review, blocked cleanup или preparation handoff
- это усиливает продуктовую понятность без открытия скрытого apply-path

### 21. Upgrade inbox начал переходить в guided review path

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/upgrade-requests/page.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- `Upgrade Requests` header теперь ведёт не просто в refresh/export pattern, а даёт явный вход в inbox review
- наверху страницы появился отдельный `Main next step` card
- экран теперь сразу показывает, на чём фокус: new, in-review или approved requests

Что это значит practically:

- `upgrade-requests` стал меньше похож на технический inbox с bulk-tools наверху
- пользователю теперь проще понять, что сначала нужно пройти текущий queue slice, а уже потом идти в bulk, saved views и audit
- это продолжает общий UX-сдвиг проекта: сначала очевидный review path, потом supporting tools

### 22. Users разделился на team-access path и recovery path

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- `Users` header теперь ведёт в `Review team access`, а не в создание пользователя как главный путь
- наверху страницы появился `Main next step` card для обычного team-access review
- recovery получил отдельный верхний `Recovery path` card
- recovery path теперь виден как отдельный маршрут, а не только как часть большого `Advanced audit and recovery` disclosure

Что это значит practically:

- один из самых смешанных экранов проекта стал понятнее по структуре
- пользователь теперь быстрее видит, идёт ли он в обычный доступ/команду или в recovery workflow
- это уменьшает путаницу между ежедневным access review и редким, более опасным recovery path

### 23. Deployment/runtime/templates ушли в отдельный workflow screen

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/page.js)
- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/deployment-workflow/page.js)
- [runtime-workspace-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/runtime-workspace-utils.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- появился отдельный `deployment-workflow` screen
- туда переехали live deployments, create deployment и deployment templates
- `/app` остался обзорным scenario-entry экраном и перестал быть смешанным toolbox-экраном для rollout path
- smoke checks теперь тоже считают deployment/template path отдельной поверхностью, а не частью обзорного `/app`

Что это значит practically:

- основной путь деплоя теперь не тонет среди ops overview, admin и recovery surfaces
- пользователю проще понять, куда идти для следующего rollout: в один отдельный deployment workspace
- проект стал ближе к intent-first структуре: обзор отдельно, rollout workflow отдельно, server review отдельно, recovery отдельно

### 24. Deployment detail стал более intent-first runtime workspace

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- у deployment detail появился отдельный верхний `Main next step` слой
- back path теперь ведёт в `deployment-workflow`, а не в общий обзорный `/app`
- runtime detail теперь явнее разделяет: сначала review/decision, потом redeploy, потом handoff/delete/tools
- handoff, delete review и deeper runtime history теперь меньше конкурируют с главным действием страницы

Что это значит practically:

- deployment detail стал не просто страницей с большим количеством мощных блоков, а более понятным рабочим экраном
- пользователю теперь проще увидеть, нужно ли сначала стабилизировать rollout, подготовить change, отдать handoff или идти в delete review
- это продолжает тот же продуктовый сдвиг: сначала очевидный safe next step, потом supporting diagnostics/history/tools

### 25. Template lifecycle стал связнее между deployment detail и deployment workflow

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)
- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/deployment-workflow/page.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- после сохранения шаблона на deployment detail появился явный переход в `deployment-workflow`
- `deployment-workflow` теперь умеет открываться сразу на нужном template context из detail-страницы
- template review/reuse/edit теперь меньше ощущается как два несвязанных места

Что это значит practically:

- пользователь теперь не теряет шаблон сразу после сохранения на runtime detail
- стало понятнее, что detail умеет сохранить текущую реальность как template, а основной lifecycle шаблона продолжается уже в deployment workflow
- это делает template path ближе к человеческому сценарию: сохранить -> открыть -> проверить -> переиспользовать

### 26. Create и redeploy стали ближе по guardrails и объясняющему слою

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/deployment-workflow/page.js)
- [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)
- [runtime-workspace-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/runtime-workspace-utils.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- `redeploy` теперь тоже делает preflight-проверку на image, парность портов и ошибки в env rows
- у `redeploy` появился такой же draft summary, как у guided create
- create и redeploy теперь лучше ощущаются как один rollout language, а не как два слегка разных технических flows

Что это значит practically:

- пользователю теперь проще доверять экрану изменения rollout: он заранее видит очевидные проблемы в форме, а не только backend error после submit
- переход между “создать новый deploy” и “изменить существующий deploy” стал понятнее по языку и поведению
- это уменьшает ощущение, что workflow и detail живут по разным правилам

### 27. Redeploy стал review-first, а не submit-first

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- кнопка `Redeploy` превратилась в `Review redeploy`
- перед реальным redeploy теперь открывается review panel с impact summary
- для redeploy теперь тоже нужен typed confirmation, как и для delete

Что это значит practically:

- risky runtime change теперь сложнее сделать случайно
- пользователь сначала видит, что именно изменится или что redeploy просто заново прогонит тот же rollout
- delete и redeploy теперь выглядят как два осознанных review-действия, а не как две кнопки с разным уровнем осторожности

### 28. Delete и redeploy получили более единый человеческий review language

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)
- [runtime-workspace-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/runtime-workspace-utils.js)

Что добавлено:

- delete и redeploy теперь используют одинаковый confirmation phrase pattern
- review panels у risky действий теперь объясняют подтверждение в одном и том же тоне
- wording стал меньше зависеть от разных случайных формулировок на каждой кнопке

Что это значит practically:

- пользователю легче понять логику опасных действий, потому что они больше не разговаривают на разных языках
- review layer на runtime detail стал восприниматься как один цельный safety pattern, а не как набор отдельных решений
- это делает risky actions более предсказуемыми даже без чтения документации

### 29. Reviewer-facing rollout copy стал общим слоем между overview, workflow и detail

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/page.js)
- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/deployment-workflow/page.js)
- [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)
- [runtime-workspace-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/runtime-workspace-utils.js)

Что добавлено:

- общий reviewer-facing copy layer для трёх основных runtime экранов
- overview, deployment workflow и deployment detail теперь объясняют основной путь более одинаковым языком
- меньше дрейфа между “obvious path”, “main next step”, “review first” и похожими product формулировками

Что это значит practically:

- человеку проще читать продукт как один связный маршрут, а не как три экрана, написанные разным тоном
- главный путь деплоя и review теперь ощущается стабильнее даже при переходе между разными surface
- это уменьшает риск, что пользователь поймёт overview, но потеряется на workflow или detail из-за смены языка

## Important Practical Meaning

Если коротко:

- server-review теперь можно считать законченным отдельным экраном
- это уже не “заготовка”
- это уже не “нужно ещё чуть-чуть, чтобы стало usable”
- это уже рабочее место для серверов
- deployment detail теперь тоже стал сильнее как рабочее место для runtime review и incident handoff
- restore layer теперь уже не просто report, а более структурированный preparation handoff
- у проекта теперь есть ещё и более узкий ускоритель именно под текущие DeployMate feature slices, а не абстрактный scaffold “на будущее”
- recovery layer теперь ещё и получил отдельный import-review экран для controlled import boundary
- restore и import-review теперь уже связаны в один маршрут, а не живут как две параллельные поверхности без handoff
- import-review теперь ещё и умеет выдавать короткий approval trail, который проще отправить дальше без пересказа руками
- import-review теперь доводит review ещё и до preparation handoff, то есть следующий безопасный шаг тоже оформлен как рабочий артефакт
- поверх этого началась явная UX-пересборка: главный следующий шаг стали выводить вперёд, а не прятать среди второстепенных действий
- `/app` поверх этого тоже начал меняться в сторону сценарного входа, а не просто обзорной панели
- теперь это касается не только CTA-слоя, но и самого deploy/runtime/templates workflow: он вынесен в отдельный `deployment-workflow`
- recovery path поверх этого теперь ещё и показывает последовательность шагов, а не только отдельные handoff-артефакты
- `upgrade-requests` поверх этого тоже начал смещаться от inbox-toolbox к guided review path
- `users` поверх этого теперь тоже начал разделяться на отдельные intent-first маршруты вместо одного смешанного admin/recovery экрана
- deployment detail поверх этого теперь тоже начал смещаться от dense runtime toolbox к более явному decision-first экрану
- поверх этого template path между detail и workflow теперь тоже стал более непрерывным, а не разорванным между двумя страницами
- поверх этого create и redeploy теперь ещё и говорят с пользователем более одинаковым языком и одинаково рано показывают draft-проблемы
- поверх этого redeploy теперь ещё и получил свой review boundary, а не оставался прямым submit-действием
- поверх этого delete и redeploy теперь ещё и подтверждаются более одинаковым человеческим языком
- поверх этого overview, workflow и detail теперь ещё и объясняют основной rollout path более одинаковым reviewer-facing языком

## What Was Verified

Проверено локально:

- `bash -n scripts/scaffold_deploymate_surface.sh` -> ok
- `cd backend && venv/bin/python -m unittest tests.test_server_api_flow` -> ok
- `npm --prefix frontend run build` -> ok
- `FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:runtime` -> ok
- `cd backend && venv/bin/python -m unittest tests.test_deployment_routes tests.test_deployment_api_flow` -> ok
- `cd backend && venv/bin/python -m unittest tests.test_restore_dry_run` -> ok
- `FRONTEND_SMOKE_PORT=3007 npm --prefix frontend run smoke:restore` -> ok
- `FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:runtime` -> ok
- повторный `cd backend && venv/bin/python -m unittest tests.test_restore_dry_run` после structured preparation plan -> ok
- повторный `npm --prefix frontend run build` после restore UI/export updates -> ok
- `bash -n scripts/scaffold_deploymate_feature.sh` -> ok
- dry run `scaffold_deploymate_feature.sh` на временном target repo -> ok
- `cd backend && venv/bin/python -m unittest tests.test_import_review_api_flow tests.test_restore_dry_run` -> ok
- `npm --prefix frontend run build` после `import-review` surface -> ok
- `git diff --check` -> ok
- повторный `cd backend && venv/bin/python -m unittest tests.test_import_review_api_flow tests.test_restore_dry_run` после restore -> import-review handoff -> ok
- повторный `npm --prefix frontend run build` после handoff/source-layer updates -> ok
- повторный `cd backend && venv/bin/python -m unittest tests.test_import_review_api_flow tests.test_restore_dry_run` после approval trail layer -> ok
- повторный `npm --prefix frontend run build` после approval trail updates -> ok
- повторный `cd backend && venv/bin/python -m unittest tests.test_import_review_api_flow tests.test_restore_dry_run` после preparation handoff layer -> ok
- повторный `npm --prefix frontend run build` после preparation handoff updates -> ok
- `npm --prefix frontend run build` после primary-action / main-next-step UX package -> ok
- `git diff --check` после primary-action / main-next-step UX package -> ok
- `npm --prefix frontend run build` после `/app` scenario-entry UX package -> ok
- `git diff --check` после `/app` scenario-entry UX package -> ok
- `cd backend && venv/bin/python -m unittest tests.test_import_review_api_flow tests.test_restore_dry_run` после recovery sequencing layer -> ok
- `npm --prefix frontend run build` после recovery sequencing layer -> ok
- `git diff --check` после recovery sequencing layer -> ok
- `npm --prefix frontend run build` после upgrade inbox UX package -> ok
- `git diff --check` после upgrade inbox UX package -> ok
- `npm --prefix frontend run build` после users dual-path UX package -> ok
- `git diff --check` после users dual-path UX package -> ok
- `npm --prefix frontend run build` после deployment workflow split -> ok
- `FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:runtime` после deployment workflow split -> ok
- `FRONTEND_SMOKE_PORT=3008 npm --prefix frontend run smoke:templates` после deployment workflow split -> ok
- `git diff --check` после deployment workflow split -> ok
- `npm --prefix frontend run build` после deployment detail intent-first layer -> ok
- `FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:runtime` после deployment detail intent-first layer -> ok
- `git diff --check` после deployment detail intent-first layer -> ok
- `npm --prefix frontend run build` после template lifecycle bridge -> ok
- `git diff --check` после template lifecycle bridge -> ok
- `npm --prefix frontend run build` после create/redeploy consistency layer -> ok
- `FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:runtime` после create/redeploy consistency layer -> ok
- `git diff --check` после create/redeploy consistency layer -> ok
- `npm --prefix frontend run build` после redeploy review-first guardrails -> ok
- `FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:runtime` после redeploy review-first guardrails -> ok
- `git diff --check` после redeploy review-first guardrails -> ok
- `npm --prefix frontend run build` после shared risky-action language layer -> ok
- `FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:runtime` после shared risky-action language layer -> ok
- `git diff --check` после shared risky-action language layer -> ok
- `npm --prefix frontend run build` после shared reviewer-facing rollout copy layer -> ok
- `FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:runtime` после shared reviewer-facing rollout copy layer -> ok
- `git diff --check` после shared reviewer-facing rollout copy layer -> ok
- `npm --prefix frontend run build` после member live/waiting deployment workflow split -> ok
- `npm --prefix frontend run smoke:beginner` после member live/waiting deployment workflow split -> ok
- `npm --prefix frontend run build` после member overview live-review split -> ok
- `npm --prefix frontend run smoke:beginner` после member overview live-review split -> ok
- `npm --prefix frontend run build` после admin server-ready overview guardrail -> ok
- `npm --prefix frontend run smoke:beginner` после admin server-ready overview guardrail -> ok
- `npm --prefix frontend run build` после overview-to-workflow first-deploy bridge -> ok
- `npm --prefix frontend run smoke:beginner` после overview-to-workflow first-deploy bridge -> ok
- `npm --prefix frontend run build` после healthy workflow open-app priority slice -> ok
- `npm --prefix frontend run smoke:runtime` после healthy workflow open-app priority slice -> ok
- `npm --prefix frontend run build` после failed workflow review-first CTA slice -> ok
- `npm --prefix frontend run smoke:runtime` после failed workflow review-first CTA slice -> ok
- `npm --prefix frontend run build` после deployment workflow runtime queue consistency package -> ok
- `npm --prefix frontend run smoke:runtime` после deployment workflow runtime queue consistency package -> ok
- `npm --prefix frontend run build` после internal-only runtime review path package -> ok
- `npm --prefix frontend run smoke:runtime` после internal-only runtime review path package -> ok
- `npm --prefix frontend run build` после blocked member overview CTA wording slice -> ok
- `npm --prefix frontend run smoke:beginner` после blocked member overview CTA wording slice -> ok
- `npm --prefix frontend run build` после ready server-review CTA hierarchy slice -> ok
- `npm --prefix frontend run smoke:servers` после ready server-review CTA hierarchy slice -> ok
- `npm --prefix frontend run build` после first-deploy workflow tab hierarchy slice -> ok
- `npm --prefix frontend run smoke:beginner` после first-deploy workflow tab hierarchy slice -> ok
- `npm --prefix frontend run build` после template deploy success consistency slice -> ok
- `npm --prefix frontend run smoke:runtime` после template deploy success consistency slice -> ok
- `npm --prefix frontend run build` после fresh rollout detail verify-first bridge slice -> ok
- `npm --prefix frontend run smoke:runtime` после fresh rollout detail verify-first bridge slice -> ok
- `npm --prefix frontend run build` после fresh rollout detail verification checklist slice -> ok
- `npm --prefix frontend run smoke:runtime` после fresh rollout detail verification checklist slice -> ok
- `npm --prefix frontend run build` после overview product-entry hierarchy slice -> ok
- `npm --prefix frontend run smoke:beginner` после overview product-entry hierarchy slice -> ok
- `npm --prefix frontend run build` после overview quick-action rail slice -> ok
- `npm --prefix frontend run smoke:beginner` после overview quick-action rail slice -> ok
- `npm --prefix frontend run build` после overview glass step-grid slice -> ok
- `npm --prefix frontend run smoke:beginner` после overview glass step-grid slice -> ok
- `npm --prefix frontend run build` после workspace shell + action-board slice -> ok
- `npm --prefix frontend run smoke:beginner` после workspace shell + action-board slice -> ok
- `README.md` / `RUNBOOK.md` обновлены под `server-review` как основной server workspace

Простой вывод:

- текущий пакет по scaffold + server-review + runtime detail handoff + richer backend mutation trace + stronger restore preparation guardrails + structured restore preparation guidance + DeployMate-specific feature scaffold + import-review workspace + restore/import-review handoff + approval trail layer + preparation handoff layer + primary-action UX package + `/app` scenario-entry layer + recovery sequencing layer + upgrade inbox UX package + users dual-path UX package + dedicated deployment workflow split + deployment detail intent-first layer + template lifecycle bridge + create/redeploy consistency layer + redeploy-review guardrails + shared risky-action language layer + shared reviewer-facing rollout copy layer + overview product-entry hierarchy + overview quick-action rail + overview glass step-grid polish + workspace shell + action-board slice находится в рабочем состоянии

## Best Next Step

Самый разумный следующий шаг сейчас:

1. Считать restore/runtime review layer уже достаточно сильным на уровне review/preparation и не раздувать его бесконечной полировкой.
2. Если делать ускоритель разработки, то только такой, который окупится прямо на следующих пакетах DeployMate, а не абстрактный framework “на будущее”.
3. Узкий DeployMate-specific vertical feature scaffold теперь уже есть, значит дальше его надо проверять только на реальной ближайшей фиче.
4. `import-review` уже проверил scaffold на реальной recovery фиче, значит дальше можно использовать тот же путь только там, где он реально экономит ручную сборку.
5. Следующий продуктовый пакет теперь логичнее брать уже после entry/CTA/sequencing/inbox-review/users-split/deployment-workflow/deployment-detail/template-bridge/create-redeploy-consistency/redeploy-review-first слоя: не возвращаться к смешанному rollout toolbox, а идти дальше в reviewer-facing rollout copy и delete/redeploy shared confirmation language.

Что из ускорения реально стоит делать сейчас:

- только то, что ускорит следующие реальные DeployMate фичи уже в ближайших пакетах
- vertical feature scaffold под текущие review/recovery/admin patterns проекта
- повторно используемые примитивы именно для review/export/guardrail flows, если они сразу войдут в следующую работу

Что из ускорения сейчас делать НЕ надо:

- ещё один общий automation framework ради красоты
- слишком абстрактный scaffold “для любых будущих проектов”
- крупный refactor, который не сокращает время до следующей законченной фичи в самом DeployMate

Что сейчас уже НЕ является хорошим следующим шагом:

- ещё один абстрактный раунд улучшения scaffold
- возврат полного server CRUD обратно на `/app`
- создание второго server screen рядом с `server-review`

## Git Cadence

Чтобы GitHub выглядел презентабельно, правило должно быть простое:

- коммитить не по каждой мелочи, а по каждому законченному логическому куску
- пушить не после каждого коммита, а после осмысленного checkpoint

Практически это значит:

- хороший коммит:
  - одна понятная тема
  - проходит релевантную локальную проверку
  - имеет внятное сообщение
- плохой коммит:
  - смесь scaffold, backend, docs и UI без общей идеи
  - “fix”, “wip”, “tmp”, если этого можно избежать
  - промежуточное сломанное состояние без причины

Нормальная частота:

- коммит: когда завершён один смысловой кусок работы
- push: когда собран 1 хороший коммит или маленькая серия из 2-3 связанных коммитов
- для длинной сессии: лучше несколько чистых коммитов и один push серии, чем 12 мелких push подряд

Простой ориентир:

- если изменение уже можно объяснить одной короткой фразой, это кандидат на коммит
- если локально уже не стыдно открыть diff в PR, это кандидат на push

Для этого репо хороший стиль такой:

- 1 коммит на платформенный/infra кусок
- 1 коммит на конкретную продуктовую фичу
- push после того, как оба куска собираются в аккуратную историю

## Fast Resume

1. Открой [HANDOFF.md](/Users/alexgerlitz/deploymate/HANDOFF.md).
2. Проверь текущее состояние:
   - `git status --short`
   - `git rev-parse --short HEAD`
3. Если продолжаешь server-review track:
   - открой [server-review/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/server-review/page.js)
   - открой [starter-api.js](/Users/alexgerlitz/deploymate/frontend/app/app/server-review/starter-api.js)
   - открой [servers.py](/Users/alexgerlitz/deploymate/backend/app/routes/servers.py)
   - открой [test_server_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_server_api_flow.py)
4. Если продолжаешь runtime detail track:
   - открой [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)
   - открой [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)
5. Если продолжаешь backend runtime trace track:
   - открой [deployment_mutations.py](/Users/alexgerlitz/deploymate/backend/app/services/deployment_mutations.py)
   - открой [test_deployment_routes.py](/Users/alexgerlitz/deploymate/backend/tests/test_deployment_routes.py)
   - открой [test_deployment_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_deployment_api_flow.py)
6. Если продолжаешь restore preparation track:
   - открой [users/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
   - открой [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
   - открой [test_restore_dry_run.py](/Users/alexgerlitz/deploymate/backend/tests/test_restore_dry_run.py)
7. Если продолжаешь runtime destructive-guardrails track:
   - открой [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)
   - открой [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)
8. Быстрые проверки:
   - `cd backend && venv/bin/python -m unittest tests.test_server_api_flow`
   - `cd backend && venv/bin/python -m unittest tests.test_deployment_routes tests.test_deployment_api_flow`
   - `cd backend && venv/bin/python -m unittest tests.test_restore_dry_run`
   - `npm --prefix frontend run build`
   - `FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:runtime`
   - `FRONTEND_SMOKE_PORT=3007 npm --prefix frontend run smoke:restore`
9. Если цель — завершить этот пакет:
   - проверить docs/handoff diff
   - собрать commit
