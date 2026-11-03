# AI agent instructions for this repo

## Overview
- This is a Vite + React + TypeScript + Tailwind + shadcn-ui app that acts as a hub for multiple AI tools.
- Main entrypoints: [src/main.tsx](src/main.tsx) (bootstraps React) and [src/App.tsx](src/App.tsx) (providers + routing).
- Routing is via react-router; each route in App maps to a page in [src/pages](src/pages) (for example /dashboard → [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx), /ocr-evaluation → [src/pages/OCREvaluation.tsx](src/pages/OCREvaluation.tsx)).

## Running and building
- Use npm run dev for local development (Vite dev server on port 8081 as per [vite.config.ts](vite.config.ts)).
- Use npm run build for production builds and npm run build:dev for a development-mode build.
- Use npm run preview to serve a built bundle locally; npm run lint runs eslint over the project.

## Routing, pages, and layout
- The top-level router, QueryClientProvider, toasters, and global SessionTimeout live in [src/App.tsx](src/App.tsx); add new pages by:
  - Creating a component under [src/pages](src/pages) and
  - Registering its route in the <Routes> block in App.
- Many tools are also discoverable from the dashboard via app codes; see mapping logic in [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) (getIconForTool, getImageForTool, getCategoryForTool, getPathForTool).
- When introducing a new tool that should appear on the dashboard, update both the path map and any relevant icon/image/category maps so cards render correctly.

## APIs, env, and backend integration
- Core API helpers live in [src/api.ts](src/api.ts) and [src/utils/api.ts](src/utils/api.ts); there are parallel helpers for advanced item generation in [src/utils/Aigapi.ts](src/utils/Aigapi.ts).
- API base URLs come from Vite env variables such as VITE_API_BASE_URL, VITE_API_APPS_URL, VITE_API_QUIZ_URL, VITE_ITEM_GEN_API_URL, and VITE_AIG_ITEM_GEN_API_URL; reuse these rather than hard-coding URLs.
- In development, calls that use the /api prefix are proxied by Vite to https://ai.excelsoftcorp.com/ai-apps/api (see [src/api/base.ts](src/api/base.ts) and [vite.config.ts](vite.config.ts)); prefer getApiBase or a /api path instead of embedding full dev URLs.
- Some legacy or experimental helpers have an _ish suffix (for example [src/api_ish.ts](src/api_ish.ts), [src/api/base_ish.ts](src/api/base_ish.ts)); when adding or updating behavior, prefer the non-_ish versions unless you are explicitly fixing those older flows.
- Shared API types such as LearningObjective, AppDetail, UsageRequestPayload, and BookUsage are defined alongside the fetch helpers; extend these interfaces instead of redefining shapes in components.

## Session, auth, and user context
- Authentication and registration flows use the loginUser and registerUser helpers in [src/api.ts](src/api.ts) and [src/utils/api.ts](src/utils/api.ts); these write user and code information into sessionStorage.
- Session codes (usercode, custcode, orgcode, appcode) are normalized in [src/lib/session.ts](src/lib/session.ts) by reading multiple possible keys; when writing new auth-related code, keep keys consistent with this helper.
- The dashboard and several tools assume a userInfo object in sessionStorage (see [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx)); if you change the login payload shape, ensure userInfo continues to provide userCode, orgCode, customerCode, userRole, and username.
- Global idle timeout behavior is centralized in [src/components/SessionTimeout.tsx](src/components/SessionTimeout.tsx); if you need special handling for a route, adjust the isAuthRoute logic rather than reimplementing timers.

## App codes and cross-service behavior
- The backend exposes tool metadata via getAppDetails (see [src/utils/api.ts](src/utils/api.ts) and its AppDetail type). The appCode field drives:
  - Dashboard card appearance (icon, image, category) in [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) and
  - Navigation path via getPathForTool in the same file.
- When wiring a new backend app:
  - Ensure the backend returns the correct appCode.
  - Add or update the corresponding entry in Dashboard’s maps and mapping to a route defined in App.

## UI components and styling
- Reusable UI primitives (Button, Card, Dialog, Tooltip, Table, etc.) live in [src/components/ui](src/components/ui); follow existing usage patterns when building new screens (for example OCREvaluation’s rich UI in [src/pages/OCREvaluation.tsx](src/pages/OCREvaluation.tsx)).
- Tailwind is configured in [tailwind.config.ts](tailwind.config.ts) with shadcn-style CSS variables and animations; use existing utility classes and variants where possible instead of adding ad-hoc inline styles.

## Feature work guidelines
- For new API interactions, first add typed helpers in the appropriate API module (src/api.ts, src/utils/api.ts, or src/utils/Aigapi.ts) and then consume them from pages or components; avoid calling fetch or axios directly inside page components when a shared helper already exists.
- For changes that affect authentication, session state, or tool availability, always consider the knock-on effects on Dashboard, SessionTimeout, and any components that read from sessionStorage or use getSessionCodes.
- Large feature pages (like OCREvaluation) are stateful and UI-heavy; prefer extracting reusable subcomponents and keeping derived state in hooks within the same file rather than introducing global state libraries.
