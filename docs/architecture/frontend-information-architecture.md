# Frontend Information Architecture

## Scope

This note records the layout research and the implementation rule for the SeekDesk daily work frontend. The goal is to keep the main workspace focused on frequent work while moving low-frequency configuration, governance, and diagnostics into a settings-oriented area.

## Research Inputs

Firecrawl research files:

- `.firecrawl/search-ai-workspace-layout.json`
- `.firecrawl/search-developer-tool-layout.json`

Sources reviewed:

- GoodData, [Six Principles of Dashboard Information Architecture](https://www.gooddata.ai/blog/six-principles-of-dashboard-information-architecture/): use structure, navigation, hierarchy, grouping, labeling, and filtering to prevent dashboard overload.
- Abduzeedo, [AI workspace UX UI design dashboard: Notis+](https://abduzeedo.com/ai-workspace-ux-ui-design-dashboard-notis): AI workspaces should use a disciplined sidebar plus central workspace model, with quiet CRM-style utility instead of feature spectacle.
- Chrome DevTools, [Chat with AI assistance](https://developer.chrome.com/docs/devtools/ai-assistance/chat): AI assistance works best as a contextual panel with history, walkthrough, and follow-up flow rather than a page full of unrelated controls.
- Home Assistant, [Put Developer Tools Back to Where it Was](https://github.com/orgs/home-assistant/discussions/2749): advanced utilities can move under settings, but high-value daily tools must remain discoverable and direct.

UI/UX Pro Max guidance used:

- Keep a flat, minimal SaaS dashboard style.
- Use Teal as the primary state color and Orange for main actions.
- Keep hover/focus states stable and accessible.
- For Next.js internal navigation, prefer `next/link` over raw anchors.

## SeekDesk Layout Rule

Main navigation is split into two groups:

- Frequent work area: assistant, templates, context, workflows, artifacts, sessions.
- Settings and governance: models/usage, connectors, approvals/permissions, activity audit.

This preserves direct access for smoke tests and power users while preventing the dashboard from presenting every capability as an equal top-level work mode.

## Current Implementation

- `apps/web/src/app/page.tsx` keeps the existing `data-daily-view-nav` selectors for compatibility.
- Low-frequency modules are grouped under `settingsViews` and rendered through one settings section area.
- The model settings section also shows persistence state because data-layer health is diagnostic/configuration information.
- The dashboard keeps the current Teal/Orange visual language and the existing feature panel components.

## Follow-up

The next front-end engineering step should be extracting the dashboard shell, nav model, and settings section renderer from `page.tsx` into feature components. This branch intentionally keeps the change scoped to information architecture and compatibility.
