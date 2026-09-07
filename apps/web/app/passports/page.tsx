import { PassportList } from "@/components/passports/passport-list";
import { SEED_PASSPORTS } from "@/lib/data";

export default function PassportsPage() {
  return <PassportList initialPassports={SEED_PASSPORTS} />;
}
