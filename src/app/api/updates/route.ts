import { handleSignup } from "@/lib/signup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Name and email for updates. Stored in Vercel Blob, and still logged and webhooked. */
export function POST(req: Request) {
  return handleSignup(req);
}
