# Background Job Architecture

## Current State

Shiftfy uses **Vercel Cron Jobs** for scheduled tasks (see `vercel.json`):

| Cron Job                | Schedule       | Purpose                                |
| ----------------------- | -------------- | -------------------------------------- |
| `generate-time-entries` | `0 2 * * *`    | Auto-generate time entries from shifts |
| `overtime-check`        | `0 3 * * 1`    | Weekly overtime compliance check       |
| `payroll-lock`          | `0 4 1 * *`    | Monthly payroll period lock            |
| `break-reminder`        | `*/15 * * * *` | Break compliance reminders             |
| `data-retention`        | `30 4 * * 0`   | DSGVO data retention cleanup           |

## Recommended: Inngest Integration

For production-grade async job processing, integrate [Inngest](https://www.inngest.com/) — a serverless event-driven queue that runs on Vercel:

### Installation

```bash
npm install inngest
```

### Setup Pattern

```typescript
// src/lib/inngest.ts
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "shiftfy" });
```

```typescript
// src/app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { functions } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
```

### Example Functions

```typescript
// src/lib/inngest/functions.ts
import { inngest } from "@/lib/inngest";

export const generatePDF = inngest.createFunction(
  { id: "generate-pdf", retries: 3 },
  { event: "report/pdf.requested" },
  async ({ event }) => {
    // Generate PDF, upload to Vercel Blob, update DB
  },
);

export const sendNotification = inngest.createFunction(
  { id: "send-notification", retries: 2 },
  { event: "notification/send" },
  async ({ event }) => {
    // Send email/push notification
  },
);

export const functions = [generatePDF, sendNotification];
```

### Use Cases for Migration

| Current (sync)          | Future (async via Inngest)                |
| ----------------------- | ----------------------------------------- |
| PDF generation in-route | `inngest.send("report/pdf.requested")`    |
| Email sending in-route  | `inngest.send("notification/send")`       |
| Export job processing   | `inngest.send("export/job.started")`      |
| Auto-scheduler runs     | `inngest.send("scheduler/run.requested")` |

### Benefits

- **Retries** with exponential backoff
- **Rate limiting** built-in
- **Observability** dashboard
- **No infrastructure** — runs on Vercel serverless
- **Fan-out** — process many items in parallel
