# Promo demo kit — "Claude notices. You approve."

Everything needed to record the 30-second before/after clip for README, X,
and Show HN. The core idea: **don't show a faster install — show the moment
Claude brings a skill up unprompted.** That moment can't be conveyed in text.

## Storyboard (final cut ≈ 30s)

| t | scene | source |
|---|---|---|
| 0–4s | Title card: *"You keep doing the same task. Claude never notices."* | post-production |
| 4–10s | BEFORE montage: the same CHANGELOG chore in 2 earlier sessions (2× speed, jump cuts, corner counter "session 1… session 2") | optional extra recording, or skip and let the title card carry it |
| 10–20s | **THE MOMENT** — 3rd request; Claude does the edit, then unprompted: *"I've noticed you've updated CHANGELOG.md in 3 separate sessions — there's a skill for this. Install it?"* Hold 1s. | `demo.tape` scene 1 |
| 20–26s | `yes` → installed → next prompt shows it active | `demo.tape` scenes 2–3 |
| 26–30s | End card: the two `/plugin` install lines + *"Omakase. Claude picks. You approve."* | post-production |

The 10–20s frame is also the thumbnail.

## Research demo — "It curates the tool. You approve." (`demo-research.tape`)

Aimed at a research audience (e.g. a PI). One recurring chore — turning raw
results into **publication-quality figures** — shown through both omakase
mechanisms, each as a clean off/on before/after. The served skill is the REAL
catalog entry `delphine-l-…-data-visualization` (scientific matplotlib/seaborn,
publication-quality figures).

### Beat A — recommendation (intent → a tool you'd never have found)

| | Without omakase | With omakase |
|---|---|---|
| find a plotting approach | search blogs, copy matplotlib boilerplate, guess chart type | ask in plain words |
| quality | trial-and-error styling, non-publication output | skill applies chart-type choice + publication styling |
| discovery | never learn the skill exists | Claude offers it, you say "yes" |

Prompt that reproducibly surfaces the scientific data-visualization skill at
rank 1 (score ~93, far ahead): **"my matplotlib plots look bad — help me make
clear, publication-quality figures with seaborn"**. Recorded by
`demo-research.tape`.

### Beat B — hook (the chore you didn't realize was automatable)

A researcher hand-edits their plotting script `make_figures.py` every time the
data changes. Across three sessions the repetition hook notices and offers the
same data-visualization skill — unprompted.

```bash
node docs/demo/seed-repetition.mjs --file make_figures.py   # plant 2 prior sessions
# then, in a FRESH Claude session, have it edit make_figures.py ONCE →
# the 3rd-session strike fires the hint; Claude offers the skill in one line
node docs/demo/seed-repetition.mjs --reset                  # restore real state
```

| | Without omakase | With omakase |
|---|---|---|
| recurring figure edits | redo by hand every session, forever | caught on the 3rd, offered a skill |
| trigger | you must notice it's repetitive | the hook notices for you |

### The off/on contrast cut

Record each beat twice — once with the omakase hooks/MCP disabled (the "before":
nothing happens, you do it by hand), once enabled (the "after": the offer
appears). Cut side by side under a single title card. The asymmetry — *nothing*
vs *a one-line offer* — is the whole pitch; it reads better than any
time-saved number.

### Honest scope (useful when a researcher asks "does it know MY field?")

The catalog covers the **generic research scaffolding** — visualization,
statistics, web/literature research, academic translation — strongly. It does
NOT (yet) carry bioinformatics-specific skills (FASTA/VCF), PubMed/arXiv search,
or formal lab notebooks. That gap is the case for omakase's `propose_new_skill`
and for keeping domain-core skills in-house: omakase serves the scaffolding, you
own the domain.

## Prerequisites

- [vhs](https://github.com/charmbracelet/vhs) (`brew install vhs` / `go install github.com/charmbracelet/vhs@latest`)
- Claude Code with the omakase **plugin** installed (hooks must be registered):
  ```
  /plugin marketplace add gyuch-an02/claude-omakase
  /plugin install claude-omakase@omakase
  ```
- A scratch project directory containing a real `CHANGELOG.md` (record there,
  not in this repo — keeps the frame clean).
- The catalog must contain a changelog-ish skill so the nudge has something to
  serve (`omakase.find_skill "update changelog"` should return matches).

## Recording

```bash
# 1. Plant the two "previous sessions" (backs up your real state first)
node docs/demo/seed-repetition.mjs

# 2. Record — from the scratch project dir
vhs path/to/claude-omakase/docs/demo/demo.tape

# 3. Restore your real repetition state
node docs/demo/seed-repetition.mjs --reset
```

Dry-run once before the real take: Claude's response timing varies, and every
`Sleep` in the tape that cuts Claude off mid-stream needs stretching.

### Retakes

The nudge fires **once per workflow** (the hook remembers it in `nudged`).
For a retake, re-run step 1 — the seed script resets `nudged` along with the
planted events.

### Knobs

| env | demo use |
|---|---|
| `OMAKASE_SESSION_COOLDOWN_HOURS=0` | record the *starter-pack* variant: fresh user, first session, chef greets immediately |
| `OMAKASE_REPETITION_THRESHOLD=2` | fire on the 2nd strike if you want an even shorter setup |

## Publishing

- **README**: uncomment the demo block in the hero section (see the
  `<!-- DEMO -->` marker) once `assets/demo.gif` exists.
- **X / Reddit r/ClaudeAI**: `assets/demo.mp4` + the two install lines.
- **Show HN**: link the GIF; title shaped like *"Show HN: Claude notices you
  repeating work and offers the skill for it"*.
