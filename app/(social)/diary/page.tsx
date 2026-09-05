import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/market/auth-actions";

export default async function MyDiaryPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/signin?next=%2Fdiary");
  redirect(`/u/${encodeURIComponent(profile.handle)}`);
}
