# Backend d’authentification

API Express pour le TP ASVS V6. Supabase PostgreSQL est l’unique moteur de base
de données, en développement, dans les tests et en production. Les tests utilisent
un PostgreSQL émulé en mémoire ; aucun fichier SQLite n’est créé.

## Configuration

Le serveur lit `backend/.env` au démarrage. Copiez `.env.example` vers `.env`,
puis configurez au minimum :

- `SUPABASE_DB_URL` : chaîne de connexion PostgreSQL Supabase, conservée côté
  serveur. `SUPABASE_DB_SSL=true` active TLS. Si la validation du certificat
  échoue, définissez `SUPABASE_DB_CA` sur le chemin du certificat CA téléchargé
  depuis Supabase ; ne désactivez pas la vérification TLS en production.
- `JWT_SECRET` : secret aléatoire d’au moins 32 octets.
- `TOTP_ENCRYPTION_KEY` : clé AES-256 en base64, générée avec
  `openssl rand -base64 32`.
- En production, configurez le relais SMTP Brevo avec `EMAIL_HOST`,
  `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` et
  `DEFAULT_FROM_EMAIL`. Le backend Node utilise ces variables directement ;
  `EMAIL_BACKEND` est une option Django et n’est pas nécessaire ici.
- Les variables SMTP standard `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
  `SMTP_USER`, `SMTP_PASS` et `SMTP_FROM` restent également prises en charge.
  Si SMTP et Resend sont tous les deux configurés, le backend privilégie SMTP.
- Définissez `FRONTEND_URL` sur l’URL publique Vercel afin que le lien de
  réinitialisation renvoie vers la bonne page. Sur Render, supprimez la clé
  `RESEND_API_KEY` si vous ne souhaitez plus utiliser Resend.
- `FRONTEND_URL` et `FRONTEND_ORIGINS` : URL d’envoi des liens et origines
  navigateur autorisées.
- `TRUST_PROXY_HOPS` : nombre exact de reverse proxies de confiance devant
  l’API (0 par défaut). Configurez-le pour que le rate limiting utilise la vraie
  adresse IP ; ne faites pas confiance à tous les proxies par défaut.
- `AUTH_RATE_LIMIT_MAX` et `AUTH_RATE_LIMIT_WINDOW_MINUTES` : nombre maximal
  de requêtes d’authentification par adresse IP et durée de la fenêtre fixe.
  Par défaut : 10 requêtes par 15 minutes. Le compteur est partagé dans
  Supabase entre les routes d’authentification et les instances.

Le MFA TOTP est obligatoire par défaut. Ne réutilisez pas la même valeur pour
`JWT_SECRET` et `TOTP_ENCRYPTION_KEY`. Le fichier `.env` est ignoré par Git ;
ne placez jamais ces secrets dans le frontend ou dans `NEXT_PUBLIC_*`.

Au démarrage, le backend crée les tables dans `public`, visibles dans Supabase
Dashboard → Table Editor. Il active la RLS sans policy publique : le frontend
ne peut pas accéder directement à ces tables. Le backend migre automatiquement
les anciennes tables `asvs_auth` vers `public` lorsqu’elles existent et que la
table correspondante n’existe pas encore dans `public`.

```sh
npm install
cp .env.example .env
npm start
```

## Routes

- `GET /api/health` : disponibilité.
- `POST /api/auth/register` : `{ "email", "password", "confirmPassword" }`.
  Après création, l’interface démarre la session et guide immédiatement le
  nouvel utilisateur dans la configuration TOTP, la saisie du premier code et
  la sauvegarde des codes de secours.
- `POST /api/auth/login` : `{ "email", "password" }`. Le premier accès reçoit
  une étape obligatoire d’enrôlement TOTP ; les connexions suivantes demandent
  un code TOTP ou un code de secours.
- `POST /api/auth/mfa/enroll/setup` et `/mfa/enroll/verify` : enrôlement MFA
  initial, associé au jeton temporaire d’enrôlement.
- `POST /api/auth/mfa/verify` : validation MFA à la connexion.
- `POST /api/auth/password/reset-request` et `/password/reset` : récupération
  avec jeton aléatoire, à usage unique et valable 10 minutes. La réponse
  de demande reste générique pour ne pas révéler l’existence du compte. Si
  l’envoi échoue, le jeton non livré est supprimé et la réponse reste générique.
- `GET /api/auth/me`, `POST /api/auth/logout` : session authentifiée.
- `POST /api/auth/password/change` : mot de passe actuel requis ; révoque les
  sessions existantes.
- `POST /api/auth/mfa/totp/setup`, `/mfa/totp/enable` et `/mfa/totp/disable` :
  gestion TOTP sur une session authentifiée.

Le jeton de session est un cookie `HttpOnly`, `SameSite=Lax`, `Secure` en
production, limité à une heure et vérifié contre une session révocable en base.
La protection contre la force brute et le credential stuffing combine un plafond
de requêtes par IP, cinq échecs par couple IP/compte et cinq codes incorrects
par défi MFA. Après chaque échec, un délai progressif (250 ms par échec,
plafonné à 2 secondes) s’applique aux tentatives suivantes du même compte ou de
la même IP. Les compteurs sont partagés via Supabase et les clés sont hachées
avec HMAC avant stockage. Les succès effacent le compteur du compte. Aucun
compte n’est verrouillé : les délais sont temporaires et plafonnés.

Le frontend local est autorisé par défaut à `http://localhost:3000` et appelle
`http://localhost:4000/api`. Remplacez ces valeurs pour le déploiement.

## État des contrôles ASVS décrits dans `../Instructions.md`

| Exigences | État dans cette application |
| --- | --- |
| V6.1.1, V6.3.1 | Limitation distribuée par IP, IP/compte et défi MFA ; temporisation progressive plafonnée après échecs ; alertes après échecs répétés ; aucun verrouillage de compte. Les contrôles anti-automatisation ralentissent les scripts, mais ne constituent pas un CAPTCHA ou une détection comportementale dédiée. |
| V6.1.2, V6.2.11 | Blocage des termes du contexte présent dans `criteria/password.js` ; liste à compléter avec les noms réels de l’organisation, produits et rôles. |
| V6.1.3 | Routes password, MFA, récupération et session listées ci-dessus ; aucun flux SSO/API supplémentaire n’est exposé. |
| V6.2.1, V6.2.5, V6.2.6, V6.2.7, V6.2.8, V6.2.9, V6.2.10 | Longueur minimale serveur de 8 points de code, sans règle de composition ; saisie masquée/collage permis ; secret exact haché avec Argon2id ; maximum 1024 octets ; aucun renouvellement périodique. |
| V6.2.2, V6.2.3 | Changement de mot de passe par session authentifiée, avec mot de passe actuel ; révocation des sessions. |
| V6.2.4 | Dictionnaire `@zxcvbn-ts/language-common` sous licence MIT : 17 950 entrées d’au moins 8 caractères dans la version testée. |
| V6.2.12 | Vérification Have I Been Pwned par k-anonymity (seul le préfixe SHA-1 est envoyé). Échec fermé avec HTTP 503 si le service est indisponible. |
| V6.3.2, V6.3.3, V6.3.4 | Pas de compte par défaut ; TOTP obligatoire avant l’accès à une session ; même contrôle pour les routes authentifiées. |
| V6.3.8 | Connexion et inscription génériques pour les comptes existants/inexistants. Les mesures temporelles doivent encore être contrôlées sur l’infrastructure de déploiement. |
| V6.4.1, V6.4.2 | Aucun mot de passe initial ni question secrète. |
| V6.4.3, V6.4.6 | Récupération par jeton temporaire, aléatoire, stocké sous forme de hachage, à usage unique ; l’étape MFA reste obligatoire ensuite. Pas de parcours administrateur de reset. |
| V6.4.4, V6.5.1–5, V6.5.8 | TOTP serveur valable uniquement pendant l’intervalle courant de 30 s (aucune tolérance de dérive), source horaire serveur, secret chiffré AES-256-GCM, codes de secours Argon2id, usage unique et opérations anti-rejeu atomiques. Synchronisez les horloges serveur et téléphone. |
| V6.3.5, V6.3.7 | SMTP pour les modifications de mot de passe et de MFA, ainsi qu’une alerte après cinq échecs de connexion et après succès suivant une série d’échecs. Les alertes de nouvel appareil/localisation et la notification de changement d’adresse restent à compléter. |
| V6.3.6, V6.6 | Aucun code email/SMS/push n’est utilisé comme facteur MFA. Les parcours SMS, push, numéro vérifié et anti-push-bombing ne sont pas proposés et restent à développer si requis. |
| V6.5.6, V6.5.7, V6.7 | Révocation de TOTP/codes de secours disponible. Passkeys, clés matérielles, assertions cryptographiques et biométrie ne sont pas implémentées. |
| V6.8 | Aucun IdP OIDC/SAML n’est configuré ; association d’identité, validation de jetons et protections anti-rejeu IdP restent à développer avant toute activation SSO. |

Cette application n’est donc pas encore certifiable sur les 47 exigences :
les alertes de risque, les fournisseurs d’identité et les authentificateurs
cryptographiques de niveau L3 nécessitent des implémentations/configurations
supplémentaires. SMTP seul ne remplace pas ces facteurs.

## Vérification

```sh
npm test
```
