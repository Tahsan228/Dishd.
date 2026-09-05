import { SocialHeader } from "@/components/social/social-header";

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return <><SocialHeader />{children}</>;
}
