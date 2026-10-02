# DESIGN_SYSTEM.md

## 1. Product Design Direction

ContractAI should feel like a professional document-analysis workspace rather than a generic AI chatbot.

Design priorities:

1. Clarity
2. Trust
3. Document readability
4. Fast navigation
5. Strong citation visibility
6. Calm professional visual hierarchy

## 2. Layout

Primary application layout:

```text
┌──────────────────────────────────────────────┐
│ Header                                       │
├──────────────┬───────────────────────────────┤
│ Document     │ Main workspace                │
│ navigation   │                               │
│              │ PDF / Chat / Comparison       │
└──────────────┴───────────────────────────────┘
```

Desktop is the primary target.

The layout should remain usable on smaller screens.

## 3. Core Screens

### Dashboard

Show:

- application name,
- upload action,
- document library,
- processing states,
- document metadata,
- recent activity.

### Document Workspace

Two-pane layout:

- document viewer,
- chat panel.

The citation click interaction should connect these two panes.

### Comparison

Two contract versions should be visually distinguishable.

Show:

- clause/section name,
- old content,
- new content,
- change explanation,
- significance.

### Agent Research

Show live execution steps such as:

- Searching document
- Reading section
- Checking clause
- Comparing evidence
- Preparing answer

Avoid using only a generic spinner.

## 4. Colors

Use a restrained professional palette.

Recommended semantic colors:

- Primary: dark blue / indigo
- Background: neutral gray
- Surface: white
- Text: dark neutral
- Muted text: gray
- Success: green
- Warning: amber
- Error: red
- Citation: blue or indigo
- Highlight: soft yellow

Do not use excessive gradients or decorative effects.

## 5. Typography

Use a clean sans-serif font.

Recommended hierarchy:

- Page title: 24–32px
- Section title: 18–24px
- Body: 14–16px
- Metadata: 12–14px
- Code/technical data: monospace

Document text should prioritize readability over visual decoration.

## 6. Components

Build reusable components:

- Button
- Badge
- Card
- Dialog
- Dropdown
- Toast
- Progress indicator
- Processing status
- Document card
- Chat message
- Citation
- PDF viewer
- Comparison row
- Agent step

Use a consistent component library.

## 7. States

Every important component should define:

### Loading

Explain what is happening.

Example:

> Extracting document text…

### Empty

Explain what the user should do.

Example:

> No contracts yet. Upload your first contract to begin.

### Error

Explain the problem and next action.

Example:

> We could not extract readable text from this PDF. Try a text-based PDF or a higher-quality scan.

### Success

Clearly show completion.

Example:

> Document ready — 42 pages indexed.

## 8. Citations

Verified citations should visually communicate trust.

Example:

```text
✓ Verified · Page 21
"The aggregate liability shall not exceed..."
```

Unverified content must never look identical to verified citations.

## 9. Accessibility

- Use semantic HTML.
- Maintain keyboard navigation.
- Provide visible focus states.
- Use accessible labels.
- Do not rely on color alone.
- Maintain sufficient contrast.
- Buttons must communicate their action.

## 10. Interaction Principles

- Avoid unnecessary animation.
- Keep document navigation predictable.
- Clicking a citation should immediately move to the source.
- Preserve user-entered text.
- Cancellation should preserve already-generated answer content.
- Destructive actions require confirmation where appropriate.
