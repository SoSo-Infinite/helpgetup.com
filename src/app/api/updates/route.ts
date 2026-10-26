import { handleSignup } from "@/lib/signup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Name and email for updates and help resources. Logged like /api/t. No new vendor. */
export function POST(req: Request) {
  return handleSignup(req);
}
