---
description: SDD pipeline (optional step) — adversarially grill the user about a spec or plan until it survives, then write the resolved decisions back into the artifact
argument-hint: "[topic-slug]"
---

You are running **/grill**, an optional stress-test step in the spec-driven pipeline (see `CLAUDE.md → "Spec-driven workflow"`). It slots after `/specify` or `/plan`, before `/implement`. Stay **live in this session** — this is an interview, not a batch job.

1. **Resolve the artifact (ambiguity guard, same rules as /plan):**
   - If `$ARGUMENTS` names a topic slug, use its most advanced artifact: the plan in `docs/superpowers/plans/*<slug>*-plan.md` if one exists, else the spec in `docs/superpowers/specs/*<slug>*-design.md`.
   - Otherwise read `docs/superpowers/INDEX.md`; candidates are features with status `Spec'd` or `Planned`. **0** → stop ("nothing to grill — run `/specify` first"). **Exactly 1** → use it. **2+** → refuse; list slugs, ask for `/grill <slug>`. Never fall back to file mtime.
   - State which artifact you picked.
2. **Read the artifact fully, then interview the user about it — one question at a time.** Wait for the answer before asking the next; multiple questions at once is bewildering. For every question, state your recommended answer so the user can just say "yes".
   - **Facts vs decisions:** if a _fact_ is discoverable in the codebase (does this helper exist? what does the schema look like? is X already handled?), look it up yourself — never ask. Only _decisions_ go to the user: trade-offs, scope calls, behavior under ambiguity.
   - **Riskiest first.** Order questions by blast radius: data model / contract changes, then failure modes and edge cases, then sequencing, then naming/cosmetics. Walk each unresolved branch of the design; resolve dependencies between decisions one at a time.
   - **Stop condition:** stop when the remaining unknowns would no longer change the design or the task list — not when questions run out. Say explicitly that you've reached it. If the user answers "don't care" twice in a row, you're past the useful zone — wrap up.
3. **Write the results back — decisions live in files, not the conversation:**
   - Append a `## Grilling — YYYY-MM-DD` section to the artifact you grilled: one bullet per resolved decision (`**Q** → decision, why`). If an answer invalidates existing content, edit that content in place too — the artifact must not contradict itself.
   - If grilling a spec changed it materially, note that `/plan` (or re-running `/plan`) must pick up the changes.
   - Append `## <timestamp> — grill: <topic>` to `docs/superpowers/JOURNAL.md` (questions asked, decisions changed, anything invalidated).
   - INDEX status is unchanged — grilling refines an artifact, it doesn't advance the phase.
4. **Do not implement anything.** Tell the user: artifact updated at `<path>`, N decisions resolved. Next step is `/plan` (if you grilled a spec and it shifted) or `/implement`.
