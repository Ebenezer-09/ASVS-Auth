import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-900">
      <header className="navbar mx-auto min-h-16 max-w-6xl border-b border-slate-100 px-4 sm:min-h-20 sm:border-0 sm:px-8">
        <div className="flex-1">
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label="ASVS Auth, accueil">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral text-white sm:size-10">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="size-5"
              >
                <path
                  d="M12 3 19 6v5c0 4.5-2.9 8.1-7 10-4.1-1.9-7-5.5-7-10V6l7-3Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="m9 12 2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="truncate text-base font-bold tracking-tight sm:text-lg">ASVS Auth</span>
          </Link>
        </div>
        <nav aria-label="Navigation principale" className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/login" className="link link-hover hidden text-sm text-slate-800 sm:inline">
            Se connecter
          </Link>
          <Link href="/register" className="btn btn-neutral btn-xs !text-white sm:btn-md">
            Créer un compte
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-9 px-4 py-10 sm:gap-12 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <div>
          <div className="badge badge-outline h-auto gap-2 px-3 py-2 text-center text-xs leading-5 font-medium text-slate-800">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            TP de sécurité · OWASP ASVS 5.0 — V6
          </div>
          <h1 className="mt-5 max-w-2xl text-3xl leading-tight font-bold tracking-tight sm:mt-6 sm:text-5xl lg:text-6xl">
            Comprendre la sécurité de{" "}
            <span className="underline decoration-base-300 decoration-4 underline-offset-8">
              l’authentification.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-700 sm:mt-6 sm:text-lg sm:leading-8">
            Dans le cadre de ce TP, nous essayons de suivre les critères
            d’authentification OWASP ASVS 5.0 (chapitre V6) et de mettre en
            pratique leurs contrôles : mots de passe, vérification TOTP et
            gestion des sessions.
          </p>
          <div className="mt-6 flex flex-col items-stretch gap-4 min-[420px]:flex-row min-[420px]:items-center sm:mt-8">
            <Link href="/register" className="btn btn-neutral !text-white">
              Tester le parcours
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="size-4"
              >
                <path
                  d="M4 10h12m-5-5 5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link href="/login" className="link link-hover w-fit text-sm font-medium text-slate-900">
              Déjà un compte ?
            </Link>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-600 sm:mt-5">
            Démonstration des mécanismes d’authentification dans le cadre d’un TP.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md px-1">
          <div
            className="absolute -inset-2 rounded-3xl bg-slate-50 sm:-inset-5 sm:rounded-[2rem]"
            aria-hidden="true"
          />
          <div className="card relative border border-slate-200 bg-white shadow-sm">
            <div className="card-body gap-5 p-5 sm:gap-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-600">Projet pédagogique</p>
                  <h2 className="mt-1 text-lg leading-snug font-bold sm:text-xl">Notions mises en pratique</h2>
                </div>
                <span className="badge badge-outline">V6</span>
              </div>

              <div className="divider my-0" />

              <div className="space-y-5">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
                      <path
                        d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="15" r="1" fill="currentColor" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-semibold">Politique de mot de passe</p>
                    <p className="text-sm leading-5 text-slate-600">Validation et bonnes pratiques</p>
                  </div>
                  <span className="ml-auto text-success" aria-label="Activé">✓</span>
                </div>
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
                      <rect
                        x="5"
                        y="3"
                        width="14"
                        height="18"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                      <path
                        d="M9 7h6m-6 4h1m3 0h1m-5 4h1m3 0h1m-5 3h1m3 0h1"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <div>
                    <p className="font-semibold">MFA avec TOTP</p>
                    <p className="text-sm leading-5 text-slate-600">Code temporaire d’authentification</p>
                  </div>
                  <span className="ml-auto text-success" aria-label="Activé">✓</span>
                </div>
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
                      <path
                        d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-semibold">Gestion des sessions</p>
                    <p className="text-sm leading-5 text-slate-600">Connexion et révocation</p>
                  </div>
                  <span className="ml-auto text-success" aria-label="Activé">✓</span>
                </div>
              </div>

              <div className="alert alert-success py-3 text-sm">
                <span className="font-medium">Un parcours de démonstration guidé.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-slate-100 px-4 py-6 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>TP de sécurité · Réalisé par Bakouan et Ouedraogo</p>
        <Link href="/login" className="link link-hover w-fit text-slate-900">
          Accéder à mon compte
        </Link>
      </footer>
    </main>
  );
}
