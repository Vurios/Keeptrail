import { notFound } from "next/navigation";
import { PassportDetail } from "@/components/passports/passport-detail";
import { SEED_PASSPORTS } from "@/lib/data";

export default async function PassportClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passport = SEED_PASSPORTS.find((p) => p.id === id);

  if (!passport) {
    notFound();
  }

  return <PassportDetail passport={passport} />;
}
