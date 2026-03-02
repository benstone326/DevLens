# Code Quality Checklist

## ✅ What looks good

- [x] Clear project structure by runtime context (`background`/`content`/`panel`/`popup`/`shared`/`tools`) for maintainability and onboarding.
- [x] Manifest uses MV3 with module service worker, aligned with current Chrome extension standards.
- [x] Reusable shared helpers exist (`useHover`, `postToParent`) to reduce duplicated UI/event code.
- [x] TypeScript is used across core app code, with explicit interfaces/types in UI components.

## ⚠️ Readability / maintainability risks

- [ ] Large “god components” (e.g., `InspectorPanel.tsx`) combine many responsibilities, which hurts readability and testability over time.
- [ ] Heavy inline style usage mixed with utility classes may make theming/consistency harder to enforce at scale.

## ⚠️ Standards / robustness gaps

- [ ] Loose typing in critical paths (`any` in window globals and runtime messages) weakens type safety and can hide runtime bugs.
- [ ] Permissive `postMessage('*')` usage plus source-only checks (without strict origin validation) is a security-hardening opportunity.
- [ ] Broad extension surface area (`<all_urls>` in both content scripts and host permissions) may exceed least-privilege best practice unless strictly required.
- [ ] No lint/test scripts configured in `package.json` (only `dev`/`build`/`preview`), so standards compliance is largely manual.

## Suggested “good standard” checklist to adopt

- [ ] Add ESLint + TypeScript strict checks and a `npm run lint` script.
- [ ] Add a minimal test setup (smoke/unit tests) and `npm test`.
- [ ] Split `InspectorPanel.tsx` into smaller components/hooks by concern.
- [ ] Replace repeated `window as any` globals with typed declarations.
- [ ] Harden message passing with stricter origin/channel validation.
