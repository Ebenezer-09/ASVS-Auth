const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"
).replace(/\/+$/, "");

type ApiErrorResponse = {
  error?: string;
  message?: string;
  mfaRequired?: boolean;
  mfaEnrollmentRequired?: boolean;
  secret?: string;
  otpauthUrl?: string;
  recoveryCodes?: string[];
  errors?: Array<{ message: string }>;
};

export async function submitAuthRequest(
  endpoint:
    | "register"
    | "login"
    | "mfa/verify"
    | "mfa/enroll/setup"
    | "mfa/enroll/verify"
    | "password/reset-request"
    | "password/reset"
    | "password/change"
    | "logout"
    | "mfa/totp/setup"
    | "mfa/totp/enable"
    | "mfa/totp/disable",
  credentials: Record<string, string>,
) {
  const response = await fetch(`${apiBaseUrl}/auth/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(credentials),
  });

  const result = (response.status === 204
    ? {}
    : await response.json()) as ApiErrorResponse;
  if (!response.ok) {
    throw new Error(
      result.error ??
        result.errors?.[0]?.message ??
        "La requête n’a pas pu être traitée.",
    );
  }

  return result;
}

export async function getAuthSession() {
  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    credentials: "include",
  });
  const result = (await response.json()) as ApiErrorResponse & {
    email?: string;
    mfaEnabled?: boolean;
  };
  if (!response.ok) {
    throw new Error(result.error ?? "Authentification requise.");
  }
  return result;
}
