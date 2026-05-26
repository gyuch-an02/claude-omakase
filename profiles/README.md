# profiles/

Role-based recommendation defaults. When `recommend_skills` is called and the user's profile matches one of the roles here, the linked entries are surfaced first.

This is a low-effort knob the community can extend without touching code:

- One JSON file per role, named `<role-slug>.json`.
- File shape:

```json
{
  "role": "data-scientist",
  "match": ["data", "scientist", "ml", "research"],
  "recommend": ["filesystem", "fetch", "python-sandbox", "jupyter"]
}
```

`match` is a list of terms (substrings of `profile.role` or `profile.occupation`) that trigger this default set. `recommend` is a list of catalog entry ids — they're filtered to "still exists in catalog" at runtime.

Add new roles via PR. Each PR adds one file, easy to review.
