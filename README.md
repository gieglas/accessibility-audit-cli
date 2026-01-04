# Accessibility Audit Core

This project is a **command-line accessibility auditing tool** built on top of **Puppeteer** and **axe-core**, designed to run repeatable, standards-aligned accessibility audits.

## What it does

- Loads an audit configuration JSON
- Audits pages using Puppeteer + axe-core
- Produces:
  - Raw findings (direct tool output)
  - Normalised findings (grouped, standards-aligned)
- Persists each audit run as a JSON file

## Requirements

- Node.js v20+
- npm
- `@consevangelou/accessibility-audit-core` npm package
- Local execution (some sites block cloud runners)

## Installation

```bash
npm install
```

## Running an audit

### Basic

Using **node**

```bash
node cli/run-audit.mjs audit-config.json
```

Using **npm**

```bash
npm run audit -- audit-config.json
```

### Debug mode

Using **node**

```bash
node cli/run-audit.mjs audit-config.json --debug
```

Using **npm**

```bash
npm run audit -- audit-config.json --debug
```

Debug mode captures screenshots and rendered HTML in `/debug`.

## Audit config example

```json
{
    "standard": "EN301549-v3.2.1",
    "sites": [
        {
            "siteId": "govcy",
            "baseUrl": "https://www.gov.cy",
            "pages": [
                {
                    "pageId": "home",
                    "url": "https://www.gov.cy/"
                },
                {
                    "pageId": "search",
                    "url": "https://www.gov.cy/?s=performance"
                }
            ]
        },
        {
            "siteId": "consevangelou",
            "baseUrl": "https://consevangelou.com/",
            "pages": [
                {
                    "pageId": "home",
                    "url": "https://consevangelou.com/"
                },
                {
                    "pageId": "search",
                    "url": "https://consevangelou.com/search/"
                }
            ]
        }
    ]
}
```

## Output

- Running an audit produces **persistent audit result files** on disk.
  Each audit run generates **one JSON file per site**, containing:

  - Metadata about the audit run
  - The scope of pages audited
  - Raw findings from axe-core
  - Normalised findings grouped for reporting and aggregation

  These files are designed to be:

  - Immutable (never modified after creation)
  - Easy to aggregate later (per site, per period, per standard)
  - Independent of reporting or visualisation logic

### Output files and folder structure

Audit results are stored under the `audits/` directory using a **standard-first, site-centric structure**.

Current structure:

```text
audits/
└── EN301549_v3.2.1/
    └── site-govcy/
        ├── run-20251229T124734Z.json
        ├── run-20251230T124740Z.json
```

**Explanation:**

- `EN301549_v3.2.1/`
  The reference standard used for the audit.
  This allows future audits against newer standards to coexist safely.
- `site-govcy/`
  One folder per audited site (`siteId` from the audit config).
- `run-YYYYMMDDTHHMMSSZ.json`
  One file per audit execution, named using the UTC timestamp of the run.
  This makes time-based aggregation trivial without opening files.

Each file represents **one audit run for one site**.

------

### Output schema (high-level)

Each audit run file follows this structure:

```
{
  schemaVersion,
  auditRun,
  environment,
  standard,
  scope,
  results
}
```

At a glance:

- `auditRun` → when and how long the audit ran
- `environment` → tooling context (axe-core, Node version)
- `standard` → accessibility standard used
- `scope` → site and pages audited
- `results` → findings (raw + normalised)

------

### Output schema (detailed)

Below is the full logical schema, with key fields explained.

#### Root

```yml
schemaVersion: string
auditRun: AuditRunMeta
environment: EnvironmentMeta
standard: StandardMeta
scope: AuditScope
results: AuditResults
```

------

#### AuditRunMeta

```yaml
auditRun: {
  auditRunId: string,
  startedAt: ISODateString,
  finishedAt: ISODateString,
  durationMs: number
}
```

- `auditRunId`
  Unique identifier for this run.
- `startedAt`, `finishedAt`
  ISO timestamps in UTC.
- `durationMs`
  Total execution time for this site.

------

#### EnvironmentMeta

```yaml
environment: {
  tool: "axe-core",
  nodeVersion: string
}
```

Describes the runtime environment that produced the audit.

------

#### StandardMeta

```yaml
standard: {
  standardId: string,
  wcagVersion: string
}
```

References the standard JSON used to interpret WCAG criteria.

------

#### AuditScope

```yaml
scope: {
  siteId: string,
  pages: [
    {
      pageId: string,
      url: string
    }
  ]
}
```

Defines **what was audited**, not what was found.

------

#### AuditResults

```yaml
results: {
  rawFindings: RawFinding[],
  normalisedFindings: {
    compliance: NormalisedFinding[],
    other: NormalisedFinding[]
  }
}
```

Two layers are intentionally preserved:

- `rawFindings`
  Tool-level, unfiltered output from axe-core.
- `normalisedFindings`
  Grouped, classified, reporting-ready findings.

------

#### RawFinding

A RawFinding represents **one axe-core violation on one DOM node**.

```c#
{
  rawFindingId: string,
  auditRunId: string,
  siteId: string,
  pageId: string,
  pageUrl: string,

  source: "cli",
  tool: "axe-core",
  timestamp: ISODateString,

  ruleId: string,
  message: string,
  selector: string,

  wcagTags: string[],
  impact: "minor" | "moderate" | "serious" | "critical",

  findingType: "violation"
}
```

Raw findings are **never aggregated or altered**.

------

#### NormalisedFinding

Normalised findings are **grouped summaries** suitable for compliance reporting.

```c#
{
  auditRunId: string,
  siteId: string,
  pageId: string,
  pageUrl: string,

  wcagCriterionId: string | null,
  ruleId: string | null,

  classification: "automated-violation",
  severity: "low" | "medium" | "high" | "critical",

  occurrenceCount: number,
  sourceRawFindingIds: string[]
}
```

Grouping rules:

- If a WCAG criterion is resolved → grouped under `compliance`
- If no WCAG criterion is resolved → grouped under `other`

This separation ensures:

- Conservative compliance reporting
- Non-WCAG best-practice issues remain visible but distinct

------

### Example output (excerpt)

```json
{
  "schemaVersion": "1.0",
  "auditRun": {
    "auditRunId": "run-1767115568791",
    "startedAt": "2025-12-30T17:26:08.791Z",
    "finishedAt": "2025-12-30T17:26:18.454Z",
    "durationMs": 9663
  },
  "environment": {
    "tool": "axe-core",
    "nodeVersion": "v22.20.0"
  },
  "standard": {
    "standardId": "EN301549_v3.2.1",
    "wcagVersion": "2.1"
  },
  "scope": {
    "siteId": "govcy",
    "pages": [
      {
        "pageId": "home",
        "url": "https://www.gov.cy/"
      },
      {
        "pageId": "search",
        "url": "https://www.gov.cy/?s=performance"
      }
    ]
  },
  "results": {
    "rawFindings": [
      {
        "rawFindingId": "6c04cb29-580f-49f7-9a7d-6402c97e8a17",
        "auditRunId": "run-1767115568791",
        "siteId": "govcy",
        "pageId": "home",
        "pageUrl": "https://www.gov.cy/",
        "source": "cli",
        "tool": "axe-core",
        "timestamp": "2025-12-30T17:26:13.218Z",
        "ruleId": "landmark-main-is-top-level",
        "message": "Ensure the main landmark is at top level",
        "selector": "#webchat",
        "wcagTags": [
          "cat.semantics",
          "best-practice"
        ],
        "impact": "moderate",
        "findingType": "violation"
      },
      {
        "rawFindingId": "8f79304d-ddb4-4575-aaf3-6af1a6d4d05a",
        "auditRunId": "run-1767115568791",
        "siteId": "govcy",
        "pageId": "search",
        "pageUrl": "https://www.gov.cy/?s=performance",
        "source": "cli",
        "tool": "axe-core",
        "timestamp": "2025-12-30T17:26:18.442Z",
        "ruleId": "label",
        "message": "Ensure every form element has a label",
        "selector": "#service-type-filter",
        "wcagTags": [
          "cat.forms",
          "wcag2a",
          "wcag412",
          "section508",
          "section508.22.n",
          "TTv5",
          "TT5.c",
          "EN-301-549",
          "EN-9.4.1.2",
          "ACT",
          "RGAAv4",
          "RGAA-11.1.1"
        ],
        "impact": "critical",
        "findingType": "violation"
      }
    ],
    "normalisedFindings": {
      "compliance": [
        {
          "auditRunId": "run-1767115568791",
          "siteId": "govcy",
          "pageId": "search",
          "pageUrl": "https://www.gov.cy/?s=performance",
          "wcagCriterionId": "4.1.2",
          "ruleId": null,
          "classification": "automated-violation",
          "severity": "critical",
          "occurrenceCount": 1,
          "sourceRawFindingIds": [
            "8f79304d-ddb4-4575-aaf3-6af1a6d4d05a"
          ]
        }
      ],
      "other": [
        {
          "auditRunId": "run-1767115568791",
          "siteId": "govcy",
          "pageId": "home",
          "pageUrl": "https://www.gov.cy/",
          "wcagCriterionId": null,
          "ruleId": "landmark-main-is-top-level",
          "classification": "automated-violation",
          "severity": "medium",
          "occurrenceCount": 1,
          "sourceRawFindingIds": [
            "6c04cb29-580f-49f7-9a7d-6402c97e8a17"
          ]
        }
      ]
    }
  }
}
```

## Compliance and Standards

### Compliance philosophy

This tool follows a **conservative, standards-first approach** to accessibility compliance.

- Automated tools are treated as **evidence generators**, not compliance arbiters
- A finding only affects compliance if it:
  - maps to a WCAG Success Criterion, **and**
  - exists in the selected EN 301 549 reference standard

This avoids:

- overstating compliance
- inflating non-normative issues
- producing results that cannot be defended in audits or legal contexts

As a result, compliance outputs are:

- **traceable** (each finding maps to a criterion)
- **repeatable** (same input → same output)
- **explainable** to auditors, service owners, and the public

Best-practice findings are preserved separately to support improvement, without distorting compliance results.

------

### Why “compliance” is treated explicitly

This project makes a **clear distinction** between:

- **Accessibility findings** (what tools detect)
- **Legal / standards compliance** (what the law and EN 301 549 require)

Not every accessibility issue detected by automated tools:

- maps cleanly to WCAG Success Criteria
- is legally enforceable
- should affect compliance statistics

For this reason, **compliance is not inferred implicitly** — it is **explicitly resolved** using a reference standard.

------

### How compliance is determined

Compliance is determined during **normalisation**, not during scanning.

Flow:

1. Tools (axe-core) produce **RawFindings**
2. Raw findings contain:
   - rule IDs
   - WCAG tags (when available)
3. Each finding is resolved against the reference standard:
   - If a WCAG criterion exists in the standard → **compliance**
   - If not → **other (non-compliance)**

This logic ensures:

- Compliance results are **defensible**
- Best-practice issues remain visible but do not pollute compliance metrics
- Reporting remains aligned with EN 301 549 and monitoring requirements

------

### `normalisedFindings.compliance` vs `normalisedFindings.other`

Normalised findings are split into two explicit groups:

```
normalisedFindings: {
  compliance: [...],
  other: [...]
}
```

#### `compliance`

Contains only findings that:

- Map to a WCAG Success Criterion
- Exist in the selected reference standard
- Are eligible for legal / regulatory reporting

These findings are intended for:

- Monitoring reports
- Compliance dashboards
- KPIs and trend analysis

#### `other`

Contains findings that:

- Are best-practice
- Are informative but non-normative
- Do not map to a WCAG criterion in the standard

These findings are intended for:

- Implementation teams
- Debugging
- Quality improvement

They are **explicitly excluded** from compliance statistics.

------

### Why standards are externalised

Standards are stored separately (included in the `@consevangelou/accessibility-audit-core` package) because:

- EN 301 549 versions change
- WCAG versions evolve
- Reporting rules may differ by jurisdiction

By externalising standards:

- The same audit engine can be reused
- Historical audits remain valid
- Aggregation can be standard-aware in the future

This also enables future support for:

- EN 301 549 v4.x
- WCAG 2.2 / 3.0
- National monitoring variants

------

### Design principle

> **Tools detect issues.
> Standards decide compliance.**

This separation is intentional, conservative, and aligned with official accessibility monitoring practices.

## Notes

- Empty arrays are always returned if no findings exist.
- Compliance findings are strictly WCAG-mapped.

## License

MIT © 2026 Constantinos Evangelou
