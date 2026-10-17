import Link from "next/link";

const protections = [
  {
    number: "01",
    title: "Un mot de passe vérifié",
    description:
      "Les mots de passe faibles, courants ou compromis sont refusés lors de l’inscription.",
  },
  {
    number: "02",
    title: "Une vérification en deux étapes",
    description:
      "Protégez votre compte avec un code TOTP depuis votre application d’authentification.",
  },
  {
    number: "03",
    title: "Des sessions maîtrisées",
    description:
      "Les sessions sont révocables et les opérations sensibles demandent une nouvelle vérification.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-base-100 text-base-content">
      <header className="navbar mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex-1">
          <Link href="/" className="flex items-center gap-3" aria-label="ASVS Auth, accueil">
            <span className="grid size-10 place-items-center rounded-lg bg-neutral text-white">
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
            <span className="text-lg font-bold tracking-tight">ASVS Auth</span>
          </Link>
        </div>
        <nav aria-label="Navigation principale" className="flex items-center gap-3">
          <Link href="/login" className="link link-hover hidden text-sm sm:inline">
            Se connecter
          </Link>
          <Link href="/register" className="btn btn-neutral btn-sm !text-white sm:btn-md">
            Créer un compte
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <div>
          <div className="badge badge-outline gap-2 px-3 py-3 text-xs font-medium">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            Sécurité au cœur de l’authentification
          </div>
          <h1 className="mt-6 max-w-2xl text-4xl leading-tight font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Vos comptes méritent{" "}
            <span className="underline decoration-base-300 decoration-4 underline-offset-8">
              une vraie protection.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-base-content/70">
            Une expérience simple pour se connecter, avec des protections
            solides : mots de passe contrôlés, authentification à deux facteurs
            et sessions sécurisées.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/register" className="btn btn-neutral !text-white">
              Créer mon compte
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
            <Link href="/login" className="link link-hover text-sm font-medium">
              J’ai déjà un compte
            </Link>
          </div>
          <p className="mt-5 text-xs text-base-content/50">
            Configuration guidée de la vérification en deux étapes à l’inscription.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div
            className="absolute -inset-5 rounded-[2rem] bg-base-200/80"
            aria-hidden="true"
          />
          <div className="card relative border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-6 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-base-content/60">Les protections incluses</p>
                  <h2 className="mt-1 text-xl font-bold">Sécurité intégrée</h2>
                </div>
                <span className="badge badge-outline">ASVS</span>
              </div>

              <div className="divider my-0" />

              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-base-200">
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
                    <p className="font-semibold">Mot de passe robuste</p>
                    <p className="text-sm text-base-content/60">Contrôlé à l’inscription</p>
                  </div>
                  <span className="ml-auto text-success" aria-label="Activé">✓</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-base-200">
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
                    <p className="font-semibold">Vérification en deux étapes</p>
                    <p className="text-sm text-base-content/60">Code depuis votre application</p>
                  </div>
                  <span className="ml-auto text-success" aria-label="Activé">✓</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-base-200">
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
                    <p className="font-semibold">Alertes de sécurité</p>
                    <p className="text-sm text-base-content/60">Notifications par e-mail</p>
                  </div>
                  <span className="ml-auto text-success" aria-label="Activé">✓</span>
                </div>
              </div>

              <div className="alert alert-success py-3 text-sm">
                <span className="font-medium">Une configuration guidée, dès votre inscription.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-base-300 bg-base-200/50">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
          <p className="text-sm font-semibold tracking-wide text-base-content/60 uppercase">
            Pensé pour une connexion plus sûre
          </p>
          <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
            {protections.map((protection) => (
              <article key={protection.number}>
                <p className="font-mono text-sm text-base-content/45">{protection.number}</p>
                <h2 className="mt-3 text-lg font-bold">{protection.title}</h2>
                <p className="mt-2 text-sm leading-6 text-base-content/70">
                  {protection.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-sm text-base-content/60 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>ASVS Auth · Authentification conçue avec la sécurité en tête.</p>
        <Link href="/login" className="link link-hover w-fit">
          Accéder à mon compte
        </Link>
      </footer>
    </main>
  );
}
