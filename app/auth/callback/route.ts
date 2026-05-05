import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function getPublicCallbackError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit")) {
    return "Too many email requests. Wait a few minutes, then try again.";
  }

  if (normalized.includes("expired") || normalized.includes("invalid")) {
    return "This confirmation link is invalid or expired. Request a new email and try again.";
  }

  return "We could not confirm this account. Request a new email and try again.";
}

function redirectToLoginWithError(origin: string, message: string) {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", getPublicCallbackError(message));
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const error = requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const supabase = await createClient();

  if (error) {
    return redirectToLoginWithError(requestUrl.origin, error);
  }

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return redirectToLoginWithError(requestUrl.origin, exchangeError.message);
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  if (tokenHash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type
    });

    if (verifyError) {
      return redirectToLoginWithError(requestUrl.origin, verifyError.message);
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  return redirectToLoginWithError(requestUrl.origin, "Confirmation link is invalid or expired.");
}
