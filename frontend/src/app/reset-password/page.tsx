"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitAuthRequest } from "@/lib/auth-api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);
    try {
      const result = await submitAuthRequest("password/reset", {
        token,
        password: String(formData.get("password") ?? ""),
        confirmPassword: String(formData.get("confirmPassword") ?? ""),
      });
      setMessage(result.message ?? "Mot de passe réinitialisé.");
      router.push("/login?notice=password-reset");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Le lien est invalide ou expiré.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="card w-full max-w-sm border border-slate-200 bg-white shadow-sm">
        <div className="card-body p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Nouveau mot de passe
          </h1>
          {!token ? (
            <p role="alert" className="text-sm text-red-700">
              Le lien de réinitialisation est invalide ou incomplet.
            </p>
          ) : (
            <form className="mt-2" onSubmit={handleSubmit}>
              <label className="label" htmlFor="password">
                Nouveau mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="input w-full"
                autoComplete="new-password"
                required
              />
              <label className="label mt-3" htmlFor="confirmPassword">
                Confirmer le mot de passe
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className="input w-full"
                autoComplete="new-password"
                required
              />
              {message && <p role="status" className="mt-3 text-sm">{message}</p>}
              <button
                type="submit"
                className="btn btn-neutral !text-white mt-4 w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Réinitialisation..." : "Réinitialiser"}
              </button>
            </form>
          )}
          <Link href="/login" className="link link-primary mt-4 text-sm">
            Retour à la connexion
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="p-8">Chargement...</main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
