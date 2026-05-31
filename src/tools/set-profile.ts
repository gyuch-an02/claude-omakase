import { z } from "zod";
import * as profileLib from "../profile.js";

export const setProfileInput = z.object({
  role: z
    .string()
    .optional()
    .describe("Short label for the user's role (e.g. 'backend engineer', 'data scientist', 'researcher')."),
  occupation: z
    .string()
    .optional()
    .describe("More specific job title or area (e.g. 'ML infrastructure', 'frontend', 'DevOps')."),
  languages: z
    .array(z.string())
    .optional()
    .describe("Programming languages or tools the user works with daily (e.g. ['Python', 'TypeScript', 'SQL'])."),
  tools: z
    .array(z.string())
    .optional()
    .describe("Key tools or platforms (e.g. ['GitHub', 'Notion', 'AWS', 'dbt'])."),
  usecases: z
    .array(z.string())
    .optional()
    .describe("Recurring workflows or use cases (e.g. ['code review', 'data analysis', 'writing docs'])."),
});

export const setProfileDescription = `Save the user's profile so future recommend_skills calls return better matches.

When to call:
  - First session: after asking "what kind of work do you do?" — call this with their answer.
  - User updates their role or tools ("I switched to Python" / "I'm now doing data work").
  - User explicitly asks to update their profile.

Only include fields the user actually mentioned. Omit fields to leave them unchanged.
Returns the updated profile so you can confirm it back to the user in one sentence.`;

export async function handle(args: z.infer<typeof setProfileInput>) {
  const existing = await profileLib.load();
  const merged = {
    ...existing,
    ...(args.role !== undefined ? { role: args.role } : {}),
    ...(args.occupation !== undefined ? { occupation: args.occupation } : {}),
    ...(args.languages !== undefined ? { languages: args.languages } : {}),
    ...(args.tools !== undefined ? { tools: args.tools } : {}),
    ...(args.usecases !== undefined ? { usecases: args.usecases } : {}),
  };
  await profileLib.save(merged);
  return { ok: true, profile: merged };
}
