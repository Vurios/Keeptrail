import { ActivityList } from "@/components/activities/activity-list";
import { SEED_ACTIVITIES } from "@/lib/data";

export default function HomePage() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <ActivityList initialActivities={SEED_ACTIVITIES} />
    </div>
  );
}
