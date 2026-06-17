# Claude Omakase — research demo: "It curates the tool. You approve."
#
# Two beats, both about data-visualization — the recurring research chore of
# turning raw results into publication-quality figures:
#
#   Beat A (recommendation): the researcher just asks for figures; omakase
#     surfaces the data-visualization skill they'd never have found.
#   Beat B (hook): the researcher keeps hand-editing make_figures.py across
#     sessions; the repetition hook notices on the 3rd and offers the same skill.
#
# Record TWO clips (recommended) so each beat reads cleanly, then cut together
# with before/after title cards. See docs/demo/README.md for the storyboard,
# seeding, and the off/on contrast takes.
#
#   # Beat A:
#   vhs docs/demo/demo-research.tape           # records assets/demo-research-A.*
#   # Beat B (seed first!):
#   node docs/demo/seed-repetition.mjs --file make_figures.py
#   # ...then drive Claude to edit make_figures.py once in a fresh session.
#
# NOTE: Claude's streaming timing varies — dry-run once and stretch any Sleep
# that cuts a reply off mid-stream.

Output assets/demo-research-A.gif
Output assets/demo-research-A.mp4

Set FontSize 18
Set Width 1280
Set Height 720
Set Theme "Catppuccin Mocha"
Set TypingSpeed 55ms
Set Padding 16

# ── Beat A — recommendation. A real research ask, nothing about "skills".
Type "claude"
Enter
Sleep 6s

Type "my matplotlib plots look bad — help me make clear, publication-quality figures with seaborn"
Enter

# omakase find_skill ranks the catalog; the data-visualization skill
# (scientific matplotlib/seaborn, publication-quality) surfaces. Claude offers
# it in one line and asks before installing. This pause is the thumbnail.
Sleep 35s

# ── The entire user contribution: approval.
Type "yes, install it"
Enter

# install_skill runs; Claude confirms and uses the skill to produce the figures.
Sleep 30s

Sleep 4s
