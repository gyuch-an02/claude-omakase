# Claude Omakase — 30s promo: "Claude notices. You approve."
#
# Records THE MOMENT: the repetition nudge firing live, unprompted, followed by
# a one-word approval and the install. The two "before" sessions are planted by
# docs/demo/seed-repetition.mjs, so the first on-camera edit is the 3rd strike.
#
#   vhs docs/demo/demo.tape        # → assets/demo.gif + assets/demo.mp4
#
# Read docs/demo/README.md FIRST — seeding, prerequisites, retakes.
#
# NOTE on Sleep values: Claude's streaming output is nondeterministic. The
# sleeps below are generous defaults for a warm session — do a dry run and
# stretch whichever one cuts Claude off mid-answer.

Output assets/demo.gif
Output assets/demo.mp4

Set FontSize 18
Set Width 1280
Set Height 720
Set Theme "Catppuccin Mocha"
Set TypingSpeed 60ms
Set Padding 16

# ── Scene 1: an ordinary request — the user asks for the SAME chore they've
#    done in two earlier sessions. Nothing about skills is mentioned.
Type "claude"
Enter
Sleep 6s

Type "add a changelog entry for the new export feature"
Enter

# Claude edits CHANGELOG.md → PostToolUse hook counts strike 3 → the nudge is
# injected into THIS turn. Claude finishes the edit, then — unprompted —
# offers the matching skill. This pause is the thumbnail frame.
Sleep 35s

# ── Scene 2: the entire user contribution to skill management.
Type "yes"
Enter

# install_skill runs; Claude confirms what got installed and why.
Sleep 25s

# ── Scene 3: proof it stuck.
Type "what skills do I have installed now?"
Enter
Sleep 20s

Sleep 4s
