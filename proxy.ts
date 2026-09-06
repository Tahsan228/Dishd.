import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session cookie on every page request.
 * Server Components cannot write cookies, so without this a session would
 * silently expire mid-visit.
 *
 * Renamed from middleware.ts: the `middleware` convention is deprecated in
 * Next.js 16 and renamed to `proxy`. Behaviour is identical.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

/**
 * Pages only.
 *
 * Every request that reaches this function costs a network round trip to
 * Supabase to refresh the session. The previous matcher excluded `_next` and a
 * couple of image types but still ran on `/manifest.webmanifest`, the local
 * font files and the app icons — so a single page view paid for the auth call
 * several times over, and page loads were observed taking seconds.
 *
 * Static assets never need a session, so they are excluded by extension. The
 * dot in the extension group is escaped properly here; the old pattern used a
 * single backslash inside a double-quoted string, which JavaScript dropped, so
 * it was matching any character rather than a literal dot.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|logos/|icons/|fonts/|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|otf|txt|xml|webmanifest)$).*)",
  ],
};
