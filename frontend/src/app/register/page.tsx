"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { submitAuthRequest } from "@/lib/auth-api";
import { AuthMessage } from "@/components/auth-message";

type RegistrationStep = "register" | "enroll" | "verify" | "recovery" | "complete";
type MessageKind = "success" | "error" | "info";

export default function RegisterPage() {
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<MessageKind>("info");
  const [step, setStep] = useState<RegistrationStep>("register");
  const [isMfaEnrollment, setIsMfaEnrollment] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordIsLongEnough = Array.from(password).length >= 8;
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage("");
    try {
      if (step === "register") {
        if (!passwordIsLongEnough) {
          setMessageKind("error");
          setMessage("Le mot de passe doit contenir au moins 8 caractères.");
          return;
        }
        if (!passwordsMatch) {
          setMessageKind("error");
          setMessage("Les mots de passe ne correspondent pas.");
          return;
        }

        const formData = new FormData(event.currentTarget);
        const address = String(formData.get("email") ?? "");
        setEmail(address);
        await submitAuthRequest("register", {
          email: address,
          password,
          confirmPassword,
        });

        const login = await submitAuthRequest("login", {
          email: address,
          password,
        });
        setPassword("");
        setConfirmPassword("");

        if (login.mfaEnrollmentRequired) {
          setIsMfaEnrollment(true);
          const setup = await submitAuthRequest("mfa/enroll/setup", {});
          setTotpSecret(setup.secret ?? "");
          setOtpauthUrl(setup.otpauthUrl ?? "");
          setSecretCopied(false);
          setStep("enroll");
          setMessageKind("info");
          setMessage("");
        } else if (login.mfaRequired) {
          setStep("verify");
          setMessageKind("info");
          setMessage("Saisissez le code de votre application d’authentification pour terminer la connexion.");
        } else {
          setStep("complete");
          setMessageKind("success");
          setMessage("Inscription terminée. Vous êtes connecté.");
        }
        return;
      }

      const formData = new FormData(event.currentTarget);
      const code = String(formData.get("code") ?? "");
      if (step === "enroll") {
        const result = await submitAuthRequest("mfa/enroll/verify", { code });
        setRecoveryCodes(result.recoveryCodes ?? []);
        setStep("recovery");
        setMessageKind("success");
        setMessage("Code validé. La vérification en deux étapes est activée.");
        return;
      }

      if (step === "verify") {
        await submitAuthRequest("mfa/verify", { code });
        setStep("complete");
        setMessageKind("success");
        setMessage("Code OTP validé. Connexion réussie.");
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

  const registerStep = step === "register";
  const otpStep = step === "enroll" || step === "verify";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base-200 px-5 py-10">
      {message && (
        <div className="w-full max-w-md">
          <AuthMessage
            kind={messageKind}
            message={message}
            onDismiss={() => setMessage("")}
          />
        </div>
      )}
      <section className="card w-full max-w-lg bg-base-100 shadow-sm">
        <div className="card-body gap-4 p-6 sm:p-8">
          <Link href="/" className="link link-primary w-fit text-sm font-medium">
            ← Retour à l’accueil
          </Link>
          <h1 className="text-2xl font-bold">
            {registerStep
              ? "Créer un compte"
              : otpStep
                ? "Configurer la vérification OTP"
                : step === "recovery"
                  ? "Enregistrement terminé"
                  : "Inscription réussie"}
          </h1>
          {otpStep && (
            <ul className="steps steps-horizontal w-full text-xs">
              <li className={`step ${isMfaEnrollment ? "step-primary" : "step-success"}`}>
                Configurer
              </li>
              <li className={`step ${isMfaEnrollment ? "" : "step-primary"}`}>
                Vérifier
              </li>
              <li className="step">Terminé</li>
            </ul>
          )}
          {otpStep && email && (
            <p className="text-sm text-base-content/70">
              Compte : <span className="font-medium text-base-content">{email}</span>
            </p>
          )}
          <form className="mt-2" onSubmit={handleSubmit}>
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium text-base-content/70">
                {registerStep
                  ? "Inscription"
                  : otpStep
                    ? "Vérification en deux étapes"
                    : "Compte sécurisé"}
              </legend>

              {registerStep && (
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

                  <label className="label" htmlFor="password">
                    Mot de passe
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="input w-full"
                    placeholder="Au moins 8 caractères"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-describedby="password-guidance"
                  />

                  <label className="label" htmlFor="confirmPassword">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    className="input w-full"
                    placeholder="Retapez votre mot de passe"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />

                  <ul
                    id="password-guidance"
                    className="mt-3 space-y-2 text-sm"
                    aria-label="Critères du mot de passe"
                    aria-live="polite"
                  >
                    <li className={passwordIsLongEnough ? "text-green-700" : "text-slate-700"}>
                      <span aria-hidden="true">{passwordIsLongEnough ? "✓" : "○"}</span>{" "}
                      Au moins 8 caractères
                    </li>
                    <li className={passwordsMatch ? "text-green-700" : "text-slate-700"}>
                      <span aria-hidden="true">{passwordsMatch ? "✓" : "○"}</span>{" "}
                      Les mots de passe sont identiques
                    </li>
                    <li className="text-slate-700">
                      Majuscules, chiffres et symboles ne sont pas obligatoires.
                    </li>
                    <li className="text-slate-700">
                      Les mots de passe courants, compromis et liés au contexte sont refusés.
                    </li>
                  </ul>
                </>
              )}

              {otpStep && (
                <>
                  {isMfaEnrollment && (
                    <div className="space-y-3">
                      <h2 className="font-semibold">Ajouter à votre application</h2>
                      <p className="text-sm text-base-content/70">
                        Scannez ce QR code avec Google Authenticator,
                        Microsoft Authenticator ou une application TOTP.
                      </p>
                      <div className="mx-auto grid w-fit place-items-center bg-base-100 p-2">
                        {otpauthUrl ? (
                          <QRCodeSVG
                            value={otpauthUrl}
                            size={192}
                            level="M"
                            marginSize={2}
                            title="QR code privé de configuration TOTP"
                          />
                        ) : (
                          <div className="grid size-48 place-items-center bg-base-200 text-center text-sm text-base-content/60">
                            QR code indisponible
                          </div>
                        )}
                      </div>

                      <details className="collapse collapse-arrow rounded-none border-y border-base-300">
                        <summary className="collapse-title min-h-0 cursor-pointer px-0 py-3 text-sm font-medium">
                          Je ne peux pas scanner le QR code
                        </summary>
                        <div className="collapse-content px-0">
                          <p className="text-xs leading-5 text-base-content/70">
                            Saisissez cette clé manuellement dans votre application :
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <code className="min-w-0 flex-1 break-all font-mono text-xs font-semibold">
                              {totpSecret}
                            </code>
                            <button
                              type="button"
                              className="btn btn-neutral btn-sm !text-white shrink-0"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(totpSecret);
                                  setSecretCopied(true);
                                  setMessage("");
                                } catch {
                                  setMessageKind("error");
                                  setMessage("Copie impossible. Sélectionnez la clé et copiez-la manuellement.");
                                }
                              }}
                            >
                              {secretCopied ? "Copié ✓" : "Copier"}
                            </button>
                          </div>
                        </div>
                      </details>

                      <p className="text-xs leading-5 text-base-content/60">
                        Cette clé est privée : ne la partagez avec personne. Le
                        QR est généré directement dans votre navigateur.
                      </p>
                    </div>
                  )}
                  <div className="mt-5">
                    <label className="label items-center gap-2" htmlFor="code">
                      {isMfaEnrollment
                        ? "Vérifier votre application"
                        : "Code de votre application ou code de secours"}
                    </label>
                    <input
                      id="code"
                      name="code"
                      className="input input-bordered h-14 w-full text-center font-mono text-2xl tracking-[0.45em]"
                      autoComplete="one-time-code"
                      inputMode={isMfaEnrollment ? "numeric" : "text"}
                      maxLength={isMfaEnrollment ? 6 : 64}
                      placeholder={isMfaEnrollment ? "000000" : "Code"}
                      required
                      autoFocus
                    />
                    <p className="text-xs leading-5 text-base-content/60">
                      {isMfaEnrollment
                        ? "Le code change régulièrement. Saisissez le code actuellement affiché dans l’application."
                        : "Saisissez le code actuel de votre application d’authentification."}
                    </p>
                  </div>
                </>
              )}

              {step === "recovery" && (
                <div role="status" className="alert alert-warning mt-3">
                  <div>
                    <p className="font-semibold">
                      Enregistre ces codes de secours maintenant. Ils ne seront plus affichés.
                    </p>
                    <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm">
                      {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              {step !== "recovery" && step !== "complete" && (
                <button
                  type="submit"
                    className="btn btn-neutral !text-white mt-2 w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Traitement..."
                    : step === "register"
                      ? "Créer mon compte"
                      : isMfaEnrollment
                        ? "Valider le code et activer la MFA"
                        : "Valider le code OTP"}
                </button>
              )}

              {(step === "recovery" || step === "complete") && (
                <Link
                  href="/account?notice=login-success"
                  className="btn btn-neutral !text-white mt-2 w-full"
                >
                  Continuer vers mon compte
                </Link>
              )}
            </fieldset>
          </form>
          {registerStep && (
            <p className="mt-2 text-center text-sm text-base-content/70">
              Vous avez déjà un compte ?{" "}
              <Link href="/login" className="link link-primary font-medium">
                Se connecter
              </Link>
            </p>
          )}
          {otpStep && isMfaEnrollment && (
            <p className="text-center text-xs leading-5 text-base-content/60">
              Après validation, enregistrez vos codes de secours : ils
              permettront de récupérer l’accès si vous perdez votre appareil.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
