# Developer Notes

## Compliance model (important)

The project deliberately separates:

- **issue detection** (tools such as axe-core)
- **compliance determination** (reference standards)

This logic is documented in detail in the README under:

> **“Compliance and Standards”**

Developers should **not**:

- infer compliance directly from tool output
- add new compliance logic without updating the reference standard

All compliance behaviour must be:

- explicit
- standard-driven
- versioned via `core/standards/`

This ensures that:

- historical audit runs remain valid
- aggregation logic can evolve safely
- compliance results remain defensible

## Architecture

```text
cli/
  run-audit.mjs
core/
  adapters/
  normalisation/
  persistence/
  standards/
test/
```

- CLI orchestrates
- Core contains pure logic

## Why Puppeteer + axe-core

- axe-core is industry standard
- Puppeteer gives deterministic rendering + debug

## Normalisation

Findings are split into:

- `compliance` → WCAG-mapped
- `other` → best-practice / non-WCAG

This prevents overstating compliance.

## Persistence

Each audit run:

- Is immutable
- Is self-contained
- Stored as JSON

Aggregation is a later concern.

## Debug mode

Captures:

- Screenshot
- Rendered HTML

Used for diagnosing WAF, JS rendering, or bot challenges.

## Testing

Unit tests cover:

- WCAG resolution
- Normalisation
- Adapters

CLI runner is not unit tested by design.