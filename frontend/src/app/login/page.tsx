"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { submitAuthRequest } from "@/lib/auth-api";
import { AuthMessage } from "@/components/auth-message";

type MessageKind = "success" | "error" | "info";

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<MessageKind>("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaEnrollment, setMfaEnrollment] = useState(false);
  const [enrollmentComplete, setEnrollmentComplete] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [forgotPassword, setForgotPassword] = useState(false);

  useEffect(() => {
    const notice = new URLSearchParams(window.location.search).get("notice");
    const notices: Record<string, string> = {
      logout: "Déconnexion réussie.",
      "password-reset": "Mot de passe réinitialisé avec succès. Vous pouvez vous connecter.",
      "password-changed": "Mot de passe modifié avec succès. Connectez-vous avec le nouveau mot de passe.",
      "mfa-disabled": "MFA désactivée. Vous pouvez vous connecter.",
    };
    if (notice && notices[notice]) {
      window.history.replaceState({}, "", window.location.pathname);
      queueMicrotask(() => {
        setMessage(notices[notice]);
        setMessageKind("success");
      });
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);
    try {
      if (forgotPassword) {
        const result = await submitAuthRequest("password/reset-request", {
          email: String(formData.get("email") ?? ""),
        });
        setMessageKind("info");
        setMessage(result.message ?? "Si le compte existe, un lien sera envoyé.");
        return;
      }

      if (mfaPending) {
        const result = await submitAuthRequest(mfaEnrollment ? "mfa/enroll/verify" : "mfa/verify", {
          code: String(formData.get("code") ?? ""),
        });
        if (mfaEnrollment) {
          setRecoveryCodes(result.recoveryCodes ?? []);
          setEnrollmentComplete(true);
          setMfaPending(false);
          setMessageKind("success");
          setMessage("MFA activée. Enregistrez vos codes de secours avant de continuer.");
        } else {
          router.push("/account?notice=login-success");
        }
        return;
      }

      const result = await submitAuthRequest("login", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      if (result.mfaRequired) {
        setMfaPending(true);
        setMessageKind("info");
        setMessage("Saisissez un code TOTP ou un code de secours.");
      } else if (result.mfaEnrollmentRequired) {
        setMfaPending(true);
        setMfaEnrollment(true);
        const setup = await submitAuthRequest("mfa/enroll/setup", {});
        setTotpSecret(setup.secret ?? "");
        setMessageKind("info");
        setMessage("La MFA est obligatoire. Configurez une application TOTP pour continuer.");
      } else {
        router.push("/account?notice=login-success");
      }
    } catch (error) {
      setMessageKind("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible de joindre le serveur. Réessayez.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 py-12">
      {message && (
        <div className="w-full max-w-sm">
          <AuthMessage
            kind={messageKind}
            message={message}
            onDismiss={() => setMessage("")}
          />
        </div>
      )}
      <section className="card w-full max-w-sm border border-slate-200 bg-white shadow-sm">
        <div className="card-body p-6 sm:p-8">
          <Link href="/" className="link link-hover text-sm font-semibold text-slate-900">
            ← Retour à l’accueil
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Connexion</h1>
          <form className="mt-2" onSubmit={handleSubmit}>
            <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
              <legend className="fieldset-legend">
                {forgotPassword
                  ? "Réinitialiser le mot de passe"
                  : enrollmentComplete
                    ? "Codes de secours"
                    : mfaPending
                    ? mfaEnrollment
                      ? "Configurer la MFA"
                      : "Vérification MFA"
                    : "Se connecter"}
              </legend>

              {!mfaPending && !enrollmentComplete && (
                <>
                  <label className="label" htmlFor="email">
                    Adresse e-mail
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="input w-full"
                    placeholder="nom@exemple.com"
                    autoComplete="email"
                    required
                  />
                </>
              )}

              {!mfaPending && !enrollmentComplete && !forgotPassword && (
                <>
                  <label className="label" htmlFor="password">
                    Mot de passe
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="input w-full"
                    placeholder="Mot de passe"
                    autoComplete="current-password"
                    required
                  />
                </>
              )}

              {mfaPending && (
                <>
                  {mfaEnrollment && (
                    <>
                      <p className="mt-2 text-sm">
                        Enregistrez ce secret dans une application d’authentification :
                      </p>
                      <code className="select-all break-all rounded bg-slate-100 p-3">
                        {totpSecret}
                      </code>
                    </>
                  )}
                  <label className="label" htmlFor="code">
                    {mfaEnrollment ? "Code TOTP à 6 chiffres" : "Code TOTP ou code de secours"}
                  </label>
                  <input
                    id="code"
                    name="code"
                    className="input w-full"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    required
                  />
                </>
              )}

              {enrollmentComplete && (
                <>
                  <p className="mt-3 text-sm font-semibold">
                    Ces codes sont affichés une seule fois. Conservez-les dans un endroit sûr.
                  </p>
                  <ul className="list-inside list-disc rounded bg-slate-100 p-3 font-mono text-sm">
                    {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
                  </ul>
                </>
              )}

              {!enrollmentComplete && (
                <button
                  type="submit"
                  className="btn btn-neutral !text-white mt-4"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Traitement..."
                    : forgotPassword
                      ? "Envoyer le lien"
                      : mfaPending
                        ? mfaEnrollment
                          ? "Activer la MFA"
                          : "Vérifier"
                        : "Se connecter"}
                </button>
              )}
              {enrollmentComplete && (
                <button
                  type="button"
                  className="btn btn-neutral !text-white mt-4"
                  onClick={() => router.push("/account?notice=login-success")}
                >
                  Continuer
                </button>
              )}
            </fieldset>
          </form>
          {!mfaPending && !enrollmentComplete && (
            <button
              type="button"
              className="link link-primary mt-3 text-sm"
              onClick={() => {
                setForgotPassword((value) => !value);
                setMessage("");
              }}
            >
              {forgotPassword ? "Retour à la connexion" : "Mot de passe oublié ?"}
            </button>
          )}
          {!forgotPassword && !mfaPending && !enrollmentComplete && (
            <p className="mt-2 text-center text-sm text-slate-600">
              Vous n’avez pas de compte ?{" "}
              <Link href="/register" className="link link-primary font-semibold">
                Créer un compte
              </Link>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
