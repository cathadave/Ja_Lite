# Ja Lite Codex Instructions

## Project purpose
Ja Lite is a controlled MVP build for a command-driven construction operations system.
Protect the current working baseline and extend it carefully.

## Non-negotiable working rules
- Full file replacements only
- Never return snippets or partial patches
- Do not refactor unrelated files
- Do not redesign working features
- Request and inspect the exact current files expected to change before modifying anything
- Make the smallest safe change possible
- Build one layer at a time
- Test each new layer immediately before moving on

## Preserve these working areas unless absolutely required
- Next.js frontend
- FastAPI backend
- Supabase connectivity
- Command parsing
- Execution logging
- Recent Activity flow
- Project detail live data flow
- Stable modal confirmation behavior

## Required response format
For every coding task, return:
1. Full replacement files only
2. What changed
3. Expected result
4. Exact test method

## Change discipline
- Modify only the files needed for the current section
- Do not introduce broad architectural rewrites
- Optimize for stability over speed
- If a bug appears, isolate the smallest safe fix

## Current MVP build order
1. SMS communications layer
2. Email communications layer
3. Voice-to-text input
4. Seed realistic dummy data
5. End-to-end MVP validation