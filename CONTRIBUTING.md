# Contributing

Thanks for contributing to Financial Leak Detector.

## Development workflow

1. Fork and create a branch from `main`.
2. Keep changes scoped (feature/fix/docs).
3. Test affected pages locally in a browser.
4. Run a quick sanity pass for broken links, console errors, and layout issues.
5. Open a PR with a concise description and screenshots for UI changes.

## Code guidelines

- Keep JavaScript modular and browser-compatible (no build step required).
- Prefer DOM APIs over large HTML string templates for dynamic tables/lists.
- Avoid dead code and commented-out logic.
- Reuse existing CSS tokens and utility classes.

## Commit messages

Use clear, conventional messages:

- `fix: ...`
- `feat: ...`
- `docs: ...`
- `chore: ...`

