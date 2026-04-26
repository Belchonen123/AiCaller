<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Outbound calling — rules
- Outbound calls are initiated via lib/retell/client.ts createPhoneCall. Never call Retell's REST API directly from any other file.
- The dispatcher (lib/retell/dispatcher.ts) is the ONLY authorized writer of call_tasks.status transitions from 'queued'/'scheduled' to 'in_progress'. All other status transitions flow through the webhook.
- Never initiate outbound calls to numbers not present in call_tasks. No ad-hoc /api/retell/make-call endpoints.
- Respect campaign.call_window_start / end / timezone. Dispatcher must skip tasks outside window.
- Test-mode calls (campaign.purpose='test') bypass certain rate limits but still go through the same dispatcher.
- Never log to_phone, from_phone, metadata contents, or merge_fields values. Log only campaign_id, call_task_id, and status transitions.

## CSV upload — rules
- Max file size 2 MB, max 5000 rows per upload.
- Phone normalization is authoritative — the lib/phone.ts normalizePhone() result is stored; the raw value is kept for debugging only in call_tasks.to_phone_raw.
- Reject uploads that exceed limits entirely — do not partial-accept over-limit files.
- Rejected rows are stored in call_upload_batches.rejected_rows as an audit trail, not re-surfaced as call_tasks.

## Scope boundaries added
- Still no HHAeXchange/CHAMPS/EVV integration.
- CSV upload only in v1. No direct database import or spreadsheet connector.
- Test-outbound mode is single-number, single-call. No bulk self-test runs.
- Outbound still uses Retell's infrastructure — we are not building our own voice stack.

## What "call my own phone" means for demos
- For the boss demo: open /dashboard/test-call, enter Ben's phone, pick a scenario, click "Call me now." The AI places an outbound call to Ben within ~5 seconds. Ben role-plays the intake staff; the AI role-plays a caller (new referral / caregiver applicant / etc.). After hangup, the transcript and extracted intake data appear in /dashboard/calls and are linked to a newly-created lead.
- This demonstrates: voice quality, natural conversation, structured extraction, lead reconciliation — all in one 2-minute call.

## Agent templates — rules
- All agent creation MUST flow through the template system. Never call lib/retell/client.ts importAgent directly from UI handlers; always go through importTemplateToRetell which enforces variable substitution, webhook URL normalization, and audit logging.
- Never hardcode phone numbers, URLs, or agency names in template JSON. Use {{variables}}.
- System templates (is_system=true) are immutable from the UI. Changes require a seed script update.
- When editing a tenant-owned template that has already been imported to Retell, warn the user — live agents will not automatically update unless they click "Save and re-import."
- Never log retell_payload contents. Log only template_id, slug, and action verb.

## Seed script
- scripts/seed-system-templates.ts must be run once after 0005 migration, and again any time system templates change.
- The script is idempotent — safe to rerun. Version numbers track history.

## File structure
- Templates live in the agent_templates table, not in the filesystem.
- docs/templates/*.json are reference examples only — they are not loaded at runtime.
