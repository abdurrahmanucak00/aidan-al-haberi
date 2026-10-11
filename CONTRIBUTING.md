# Contributing

Thanks for taking the time to contribute. This document covers the essentials.

## Getting set up

```bash
git clone https://github.com/abdurrahmanucak00/aidan-al-haberi.git
cd aidan-al-haberi
npm install
npm run dev
```

You will need a Tavily API key and a Gemini API key to exercise the research
pipeline end to end. Enter them in the app's **Ayarlar** (Settings) tab — never in
source files.

## Before opening a pull request

Run all three checks and make sure they pass:

```bash
npm run typecheck
npm test
npm run build
```

`npm test` is fully offline: it transpiles the real Gemini source, runs it in a
sandboxed VM, and mocks every HTTP response. No API keys or network access are
needed, so it is safe to run in CI.

## Code conventions

- **TypeScript everywhere**, strict mode. Avoid `any`; prefer explicit types or
  `unknown` with narrowing.
- **Formatting** is handled by Prettier — run `npm run format` before committing.
- **Linting**: `npm run lint`.
- Match the existing structure: shared logic in `src/renderer/src/lib/`, UI in
  `src/renderer/src/components/`, shared contracts in `src/renderer/src/types/`.

## Working on the AI layer

The Gemini integration is intentionally defensive. If you change it, preserve these
behaviours:

1. **Validate before displaying.** Never render an unvalidated model response as a
   finished analysis.
2. **Never fabricate content.** If a story cannot be analysed, it must remain marked
   `pending` with its source text intact. Do not generate placeholder prose or a
   default importance score.
3. **Preserve partial results.** One failing story must not discard the stories that
   already succeeded.
4. **Do not send an explicit `maxOutputTokens`.** The model default is used on
   purpose.
5. **Add a regression test.** Any change to error classification, retry behaviour,
   parsing, or recovery needs a case in `tests/gemini.test.cjs`.

## Commit messages

Short imperative subject lines, for example:

```
Fix truncated batch losing completed summaries
Add retry for pending summaries
```

## Reporting bugs

Include the version from `package.json`, your operating system, and the research
terminal output. **Redact API keys** before pasting logs — they start with `tvly-`
(Tavily) and `AIza` (Gemini).

## Security issues

Do not open a public issue. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
