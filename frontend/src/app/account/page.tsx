"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getAuthSession, submitAuthRequest } from "@/lib/auth-api";

type MessageKind = "success" | "error" | "info";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<MessageKind>("info");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const notice = new URLSearchParams(window.location.search).get("notice");
    if (notice) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    getAuthSession()
      .then((session) => {
        if (!active) return;
        setEmail(session.email ?? "");
        setMfaEnabled(Boolean(session.mfaEnabled));
        if (notice === "login-success") {
          setMessage("Connexion réussie. Votre compte est prêt.");
          setMessageKind("success");
        }
      })
      .catch(() => {
        if (active) router.replace("/login");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await submitAuthRequest("password/change", {
        currentPassword: String(data.get("currentPassword") ?? ""),
        newPassword: String(data.get("newPassword") ?? ""),
        confirmPassword: String(data.get("confirmPassword") ?? ""),
      });
      setMessage(result.message ?? "Mot de passe modifié.");
      setMessageKind("success");
      window.location.replace("/login?notice=password-changed");
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "Échec du changement.");
    }
  }

  async function startTotp() {
    try {
      const result = await submitAuthRequest("mfa/totp/setup", {});
      setTotpSecret(result.secret ?? "");
      setMessageKind("info");
      setMessage("Ajoutez ce secret à une application TOTP, puis saisissez son code.");
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "Impossible de démarrer le MFA.");
    }
  }

  async function enableTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await submitAuthRequest("mfa/totp/enable", {
        code: String(data.get("totpCode") ?? ""),
      });
      setMfaEnabled(true);
      setTotpSecret("");
      setRecoveryCodes(result.recoveryCodes ?? []);
      setMessageKind("success");
      setMessage("MFA activée. Les codes de secours ne seront plus affichés.");
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "Code invalide.");
    }
  }

  async function disableTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await submitAuthRequest("mfa/totp/disable", {
        password: String(data.get("mfaPassword") ?? ""),
        code: String(data.get("mfaCode") ?? ""),
      });
      setMessage(result.message ?? "MFA désactivée.");
      setMessageKind("success");
      window.location.replace("/login?notice=mfa-disabled");
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "Échec de la désactivation.");
    }
  }

  async function logout() {
    try {
      await submitAuthRequest("logout", {});
      window.location.replace("/login?notice=logout");
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "Impossible de fermer la session.");
    }
  }

  if (isLoading) return <main className="p-8">Chargement du compte...</main>;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-5 py-12">
      <Link href="/" className="text-sm font-semibold text-blue-700">
        ← Accueil
      </Link>
      <section className="card border border-slate-200 bg-white shadow-sm">
        <div className="card-body">
          <h1 className="text-2xl font-bold">Sécurité du compte</h1>
          <p>{email}</p>
          {message && (
            <p
              role={messageKind === "error" ? "alert" : "status"}
              aria-live="polite"
              className={`alert text-base font-semibold ${
                messageKind === "success"
                  ? "alert-success"
                  : messageKind === "error"
                    ? "alert-error"
                    : "alert-info"
              }`}
            >
              {message}
            </p>
          )}
          <button type="button" className="btn btn-neutral !text-white" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </section>

      <section className="card border border-slate-200 bg-white shadow-sm">
        <div className="card-body">
          <h2 className="text-lg font-semibold">Changer le mot de passe</h2>
          <form className="grid gap-3" onSubmit={changePassword}>
            <label htmlFor="currentPassword">Mot de passe actuel</label>
            <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" className="input w-full" required />
            <label htmlFor="newPassword">Nouveau mot de passe</label>
            <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" className="input w-full" required />
            <label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</label>
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" className="input w-full" required />
            <button className="btn btn-neutral !text-white" type="submit">Changer le mot de passe</button>
          </form>
        </div>
      </section>

      <section className="card border border-slate-200 bg-white shadow-sm">
        <div className="card-body">
          <h2 className="text-lg font-semibold">Authentification multifacteur (TOTP)</h2>
          {!mfaEnabled && !totpSecret && (
            <button type="button" className="btn btn-neutral !text-white" onClick={startTotp}>
              Configurer une application TOTP
            </button>
          )}
          {!mfaEnabled && totpSecret && (
            <>
              <p>Secret à saisir dans votre application d’authentification :</p>
              <code className="select-all break-all rounded bg-slate-100 p-3">{totpSecret}</code>
              <form className="grid gap-3" onSubmit={enableTotp}>
                <label htmlFor="totpCode">Code à 6 chiffres</label>
                <input id="totpCode" name="totpCode" inputMode="numeric" autoComplete="one-time-code" className="input w-full" required />
                <button type="submit" className="btn btn-neutral !text-white">Vérifier et activer</button>
              </form>
            </>
          )}
          {mfaEnabled && (
            <>
              <p>MFA TOTP activée.</p>
              <form className="grid gap-3" onSubmit={disableTotp}>
                <label htmlFor="mfaPassword">Mot de passe actuel</label>
                <input id="mfaPassword" name="mfaPassword" type="password" autoComplete="current-password" className="input w-full" required />
                <label htmlFor="mfaCode">Code TOTP ou code de secours</label>
                <input id="mfaCode" name="mfaCode" autoComplete="one-time-code" className="input w-full" required />
                <button type="submit" className="btn btn-neutral !text-white">Désactiver MFA</button>
              </form>
            </>
          )}
          {recoveryCodes.length > 0 && (
            <div role="alert" className="rounded border border-amber-500 p-3">
              <p className="font-semibold">Enregistrez ces codes de secours maintenant.</p>
              <ul className="mt-2 list-inside list-disc font-mono">
                {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
              </ul>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
