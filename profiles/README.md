# profiles/

Role-based recommendation defaults. When `recommend_skills` is called and the user's profile matches one of the roles here, the linked entries are surfaced first.

This is a low-effort knob the community can extend without touching code:

- One JSON file per role, named `<role-slug>.json`.
- File shape:

```json
{
  "role": "data-scientist",
  "match": ["data", "scientist", "ml", "research"],
  "recommend": ["jupyter-notebook", "openai-docs"],
  "evidence": [
    {
      "match": ["data", "scientist", "ml"],
      "source": "https://storage.googleapis.com/kaggle-media/surveys/Kaggle%20State%20of%20Machine%20Learning%20and%20Data%20Science%20Report%202022.pdf",
      "note": "Kaggle's DS/ML survey is representative of data science and machine learning tooling."
    }
  ]
}
```

`match` is a list of terms (substrings of `profile.role` or `profile.occupation`) that trigger this default set. `recommend` is a list of catalog entry ids — they're filtered to "still exists in catalog" at runtime.

`evidence` is optional but encouraged for role defaults. Use it to justify why each match term belongs in the profile. Keep notes short: one source link plus the exact terms it supports is enough.

Add new roles via PR. Each PR adds one file, easy to review.
