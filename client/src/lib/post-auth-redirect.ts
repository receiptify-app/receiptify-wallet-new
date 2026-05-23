const PENDING_SPLIT_INVITE_KEY = "pendingSplitInvite";

export function setPendingSplitInvite(token: string) {
  try {
    sessionStorage.setItem(PENDING_SPLIT_INVITE_KEY, token);
  } catch {
    // sessionStorage may be unavailable (private mode, etc.) — ignore.
  }
}

export function peekPendingSplitInvite(): string | null {
  try {
    return sessionStorage.getItem(PENDING_SPLIT_INVITE_KEY);
  } catch {
    return null;
  }
}

export function consumePendingSplitInvite(): string | null {
  const token = peekPendingSplitInvite();
  if (token) {
    try {
      sessionStorage.removeItem(PENDING_SPLIT_INVITE_KEY);
    } catch {
      // ignore
    }
  }
  return token;
}

export function getPostAuthRedirect(fallback: string = "/"): string {
  const token = consumePendingSplitInvite();
  return token ? `/split/invite/${token}` : fallback;
}
