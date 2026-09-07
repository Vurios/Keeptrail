import { AuditEventStream } from "@/components/audit/audit-event-stream";
import { SEED_AUDIT_EVENTS } from "@/lib/data";

export default async function ActivityAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuditEventStream activityId={id} initialEvents={SEED_AUDIT_EVENTS} />;
}
