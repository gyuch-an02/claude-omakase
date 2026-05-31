---
name: write-a-skill
description: Help the user create a new Claude Code skill (SKILL.md). Use when user wants to automate a recurring workflow or capture a reusable instruction set.
triggers: ["write a skill", "create a skill", "new skill", "make a skill", "I keep doing this manually"]
---

# Write a Skill

Help the user turn a recurring workflow into a reusable Claude Code skill.

## Process

1. **Understand the workflow**: ask what task the user repeats. What triggers it? What does success look like?
2. **Draft a SKILL.md**:
   - YAML frontmatter: `name`, `description`, `triggers` (3-5 phrases that activate it)
   - Body: concise instructions Claude follows when the skill activates
   - Include steps, examples, and what NOT to do
3. **Write the file**: create `~/.claude/skills/<name>/SKILL.md` with the draft
4. **Test it**: ask the user to start a new session and trigger the skill by saying one of the trigger phrases
5. **Iterate**: refine based on what felt off in the test

## Good skill anatomy

```
---
name: my-skill
description: One sentence. When to use it.
triggers: ["phrase 1", "phrase 2", "phrase 3"]
---

# My Skill

What Claude does when this skill activates. Be concrete.

## Steps
1. ...
2. ...

## Examples
**User:** [trigger phrase]
**Claude:** [response]
```

## Tips

- Keep it under 200 lines — skills should be focused
- Triggers should be natural phrases the user actually says
- One skill = one workflow. Don't bundle unrelated things.
- If the skill needs reference data (e.g. API docs), add a separate file and reference it
