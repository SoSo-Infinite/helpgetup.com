import { handleSignup } from "@/lib/signup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Name and email for updates. Stored in Vercel Blob. The log and step notes omit them. The alert webhook still receives them. */
export function POST(req: Request) {
  return handleSignup(req);
}
