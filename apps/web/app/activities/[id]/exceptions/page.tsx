import { ExceptionQueueView } from "@/components/exceptions/exception-queue-view";
import { SEED_EXCEPTIONS } from "@/lib/data";

export default async function ActivityExceptionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ExceptionQueueView activityId={id} initialExceptions={SEED_EXCEPTIONS} />;
}
