# Actualizer Design Tokens

This system is built for a healthcare SaaS interface that should feel credible, dense, and calm: navy for trust, teal for high-signal actions, and blue-tinted neutrals for clinical clarity.

## Naming Discipline

Use semantic tokens in product UI. Raw `--brand-*` and `--neutral-*` ramps are foundation values only.

- Use `--color-bg-*` for page and surface fills.
- Use `--color-fg-*` for text, icons, and foreground affordances.
- Use `--color-border-*` for separators, input strokes, and focus rings.
- Use `--color-accent-*` for primary and secondary actions.
- Use `--color-success-*`, `--color-warning-*`, `--color-danger-*`, and `--color-info-*` for system feedback.
- Use `--color-urgency-*` only for homecare triage severity.

Tailwind utilities mirror the semantic names: `bg-bg-page`, `bg-bg-surface`, `text-fg-primary`, `border-border-default`, `bg-accent-primary`, `text-success-fg`.

## Raw Ramps

`--brand-navy-*` is the primary identity ramp. Use it through `--color-accent-primary`, `--color-bg-emphasis`, and link tokens.

`--brand-teal-*` is the signal ramp. Use it through `--color-accent-secondary` and `--color-border-focus`; it should draw attention without making the interface feel promotional.

`--neutral-*` is the healthcare trust neutral ramp. It is warmer than pure gray but slightly blue-tinted to pair with clinical data layouts.

## Semantic Color Usage

Page and surfaces:

- `--color-bg-page`: app background.
- `--color-bg-surface`: cards, panels, sidebars.
- `--color-bg-surface-raised`: popovers, menus, elevated UI.
- `--color-bg-surface-sunken`: recessed sections, table headers, input groups.
- `--color-bg-muted`: quiet fills and secondary UI blocks.
- `--color-bg-emphasis`: selected or informational emphasis background.
- `--color-bg-inverse`: dark brand areas.

Foreground:

- `--color-fg-primary`: body text and core labels.
- `--color-fg-secondary`: secondary copy, metadata, inactive nav.
- `--color-fg-tertiary`: timestamps, helper text, low-emphasis facts.
- `--color-fg-disabled`: disabled labels and icons.
- `--color-fg-on-brand`: text on primary navy or teal accents.
- `--color-fg-on-emphasis`: text on emphasis backgrounds.
- `--color-fg-link` and `--color-fg-link-hover`: inline links.

Borders:

- `--color-border-subtle`: low-contrast row separators.
- `--color-border-default`: cards, inputs, table borders.
- `--color-border-strong`: section boundaries.
- `--color-border-emphasis`: selected or highlighted surfaces.
- `--color-border-focus`: focus-visible and validation focus states.

## Status And Urgency

Use status tokens for app state feedback: success, warning, danger, and info. These are not triage colors.

Use urgency tokens for homecare-specific clinical or operational severity:

- `--color-urgency-emergent`: immediate safety risk.
- `--color-urgency-urgent`: time-sensitive follow-up.
- `--color-urgency-routine`: normal queue work.
- `--color-urgency-informational`: passive context.

## Contrast Pairings

These pairings were selected for WCAG AA minimum and AAA body-text targets where applicable:

- `--color-fg-primary` on `--color-bg-page`, `--color-bg-surface`, and `--color-bg-surface-raised`.
- `--color-fg-secondary` on `--color-bg-page` and `--color-bg-surface`.
- `--color-fg-on-brand` on `--color-accent-primary` and `--color-accent-primary-hover`.
- `--color-fg-on-brand` on `--color-accent-secondary` only for short labels or icons; prefer navy text for long text on teal tints.
- `--color-fg-on-emphasis` on `--color-bg-emphasis`.
- `--color-success-fg` on `--color-success-bg`.
- `--color-warning-fg` on `--color-warning-bg`.
- `--color-danger-fg` on `--color-danger-bg`.
- `--color-info-fg` on `--color-info-bg`.

Dark mode inverts neutral lightness, desaturates navy, and brightens teal so focus, links, and high-signal controls remain visible.

## Typography

Inter is the primary UI font. IBM Plex Sans is reserved for headings and trust-forward marketing or dashboard section titles. JetBrains Mono is for IDs, phone numbers, timestamps, JSON, logs, and tabular operational data.

Use the modular type scale:

- `text-xs`: labels, captions, badges.
- `text-sm`: dense tables, metadata, compact controls.
- `text-base`: default body.
- `text-md`: large body or empty states.
- `text-lg`: section headings.
- `text-xl`: page titles.
- `text-2xl` and `text-3xl`: hero or marketing moments only.

## Spacing, Radius, Shadow, Motion

Spacing is based on a 4px rhythm. Prefer standard Tailwind spacing utilities generated from `--spacing: 0.25rem`.

Radius is intentionally restrained: `rounded-md` for controls, `rounded-lg` for cards, `rounded-xl` for modals, and `rounded-full` for pills.

Shadows should create hierarchy, not decoration. Use `shadow-xs` or `shadow-sm` for cards and `shadow-lg` or above only for popovers, modals, and command surfaces.

Motion defaults to `--duration-fast` for interactions and `--duration-base` for normal state changes. `--ease-spring` is available but should be rare.

## Focus

Focus must always be visible. Global `:focus-visible` uses `--shadow-focus`; on navy or inverse surfaces, add `focus-on-brand` or wrap the region with `data-focus-surface="brand"`.
