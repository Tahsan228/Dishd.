import Link from "next/link";
import { reviewText } from "@/lib/social/rich-text";
export function ReviewText({ text }: { text: string }) {
  return <>{reviewText(text).map((part, i) => !part.href ? <span key={i}>{part.text}</span> : part.external ? <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-forest underline decoration-forest/30 underline-offset-4">{part.text}</a> : <Link key={i} href={part.href} className="font-medium text-forest underline decoration-forest/30 underline-offset-4">{part.text}</Link>)}</>;
}
