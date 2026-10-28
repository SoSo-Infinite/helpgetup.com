import { handleSignup } from "@/lib/signup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Name and email for updates. A private Blob file, or the alert when Blob is unset. The log omits both. */
export function POST(req: Request) {
  return handleSignup(req);
}
