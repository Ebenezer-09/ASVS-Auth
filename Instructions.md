OWASP ASVS — V6 Authentification
Référentiel de vérification de la sécurité des applications · Mai 2025
Ce tableau récapitule les 47 exigences du chapitre V6, de V6.1 à V6.8. Pour chaque exigence, tu trouveras son objectif, le mécanisme technique à mettre en place et un test concret permettant de vérifier sa conformité.
1. Vue d’ensemble
Section	Domaine	Nombre d’exigences
V6.1	Documentation d’authentification	3
V6.2	Sécurité des mots de passe	12
V6.3	Sécurité générale de l’authentification	8
V6.4	Cycle de vie et récupération des facteurs	6
V6.5	Exigences générales de MFA	8
V6.6	Authentification hors bande (out-of-band)	4
V6.7	Authentification cryptographique	2
V6.8	Fournisseurs d’identité (IdP)	4
Total	Chapitre V6	47
Les niveaux indiquent le niveau d’assurance de sécurité visé : L1 (socle), L2 (sécurité renforcée, notamment MFA) et L3 (sécurité avancée, avec des mécanismes d’authentification plus robustes).
2. V6.1 — Documentation d’authentification
ID / Niveau	Exigence	Mécanisme technique	Test de sécurité
6.1.1 — L1	Documenter les protections contre la force brute et le credential stuffing, sans permettre le verrouillage malveillant des comptes.	Rate limiting, CAPTCHA ou anti-bot adaptatif, temporisation progressive, limitation par compte et adresse IP, alertes.	Effectuer de nombreuses tentatives échouées. Vérifier que les tentatives sont limitées et qu’un attaquant ne peut pas bloquer durablement le compte d’une victime.
6.1.2 — L2	Documenter une liste de mots interdits liés au contexte de l’application.	Liste noire contenant le nom de l’organisation, les produits, les rôles, les projets et leurs variantes.	Tenter d’utiliser le nom de l’application et ses variantes comme mot de passe. L’inscription ou le changement doit être refusé.
6.1.3 — L2	Documenter tous les parcours d’authentification et leur niveau de sécurité.	Inventaire des connexions par mot de passe, SSO, MFA, récupération et API, avec les contrôles associés.	Tester chaque parcours, y compris les routes alternatives et mobiles. Aucun ne doit contourner les protections documentées.
3. V6.2 — Sécurité des mots de passe
ID / Niveau	Exigence	Mécanisme technique	Test de sécurité
6.2.1 — L1	Minimum 8 caractères ; 15 caractères fortement recommandés.	Validation côté serveur de la longueur du mot de passe.	Tester 7, 8 et 15 caractères. Sept doit être refusé, huit accepté si les autres contrôles passent.
6.2.2 — L1	Permettre à l’utilisateur de changer son mot de passe.	Endpoint sécurisé de changement de mot de passe, accessible à l’utilisateur authentifié.	Vérifier que l’utilisateur peut changer son mot de passe et se reconnecter avec le nouveau.
6.2.3 — L1	Exiger le mot de passe actuel et le nouveau lors du changement.	Vérification du mot de passe actuel côté serveur ; contrôle du nouveau mot de passe.	Envoyer un mot de passe actuel erroné. Le changement doit échouer sans modifier les identifiants.
6.2.4 — L1	Vérifier les nouveaux mots de passe contre au moins 3 000 mots de passe courants compatibles avec la politique de l’application.	Liste de mots de passe courants, filtrée selon les règles de longueur applicables.	Essayer des mots de passe connus comme très courants. Ils doivent être rejetés même s’ils respectent la longueur minimale.
6.2.5 — L1	Ne pas imposer de composition obligatoire.	Autoriser les phrases de passe, les espaces et les différentes catégories de caractères sans imposer un nombre minimal de majuscules, chiffres ou symboles.	Tester une phrase longue en minuscules, un mot de passe avec espaces et un mot de passe avec symboles. Ils doivent être acceptés si les autres règles sont respectées.
6.2.6 — L1	Masquer la saisie des mots de passe.	HTML input type="password" ; option facultative pour afficher temporairement la saisie.	Inspecter le champ dans le navigateur et vérifier que le mot de passe est masqué par défaut.
6.2.7 — L1	Autoriser le collage et les gestionnaires de mots de passe.	Ne pas bloquer les événements de collage ni désactiver les fonctionnalités natives des navigateurs.	Coller un mot de passe généré par un gestionnaire et vérifier que la connexion fonctionne.
6.2.8 — L1	Vérifier le mot de passe exactement tel qu’il a été reçu.	Aucune troncature, conversion de casse ou normalisation destructive avant vérification.	Comparer deux mots de passe ne différant que par la casse, les espaces significatifs ou un caractère final. Le système ne doit pas les rendre artificiellement équivalents.
6.2.9 — L2	Accepter les mots de passe d’au moins 64 caractères.	Limites cohérentes dans le frontend, l’API, la base et la fonction de hachage.	Enregistrer puis utiliser un mot de passe de 64 caractères ou davantage. Vérifier qu’il n’est pas tronqué.
6.2.10 — L2	Ne pas imposer un renouvellement périodique systématique.	Politique de renouvellement déclenchée par une compromission, un risque identifié ou une demande de l’utilisateur.	Vérifier qu’aucune expiration périodique arbitraire ne force le changement d’un mot de passe toujours sûr.
6.2.11 — L2	Utiliser la liste de mots spécifiques au contexte.	Contrôle serveur de la liste documentée et de ses variantes pertinentes.	Essayer des mots de passe construits à partir du nom du produit, d’un rôle ou d’un nom de projet.
6.2.12 — L2	Vérifier les mots de passe contre une base de mots de passe compromis.	Base locale de mots de passe divulgués ou service spécialisé, avec transmission minimale des données sensibles.	Tester un mot de passe connu comme compromis et vérifier son rejet lors de l’inscription ou du changement.
Points techniques importants :
- Les mots de passe doivent être stockés avec un algorithme adapté au stockage de mots de passe, par exemple Argon2id, et non en clair ni avec un simple SHA-256.
- La comparaison doit porter sur le secret exact fourni par l’utilisateur. Attention aux limites de longueur et aux transformations automatiques dans le frontend ou le backend.
- La liste des mots de passe courants et celle des mots de passe compromis sont deux contrôles distincts, même si elles peuvent se recouper.
4. V6.3 — Sécurité générale de l’authentification
ID / Niveau	Exigence	Mécanisme technique	Test de sécurité
6.3.1 — L1	Mettre en œuvre les protections contre la force brute et le credential stuffing conformément à la documentation.	Rate limiting, détection d’automatisation, surveillance des échecs et réponses adaptatives.	Réaliser des tests contrôlés de tentatives répétées et vérifier les limites réellement appliquées côté serveur.
6.3.2 — L1	Supprimer ou désactiver les comptes par défaut.	Désactivation des comptes admin, root ou autres comptes prédéfinis non nécessaires ; suppression des identifiants par défaut.	Rechercher les comptes prédéfinis et vérifier qu’ils ne permettent pas de se connecter avec des identifiants connus.
6.3.3 — L2	Exiger la MFA ou une combinaison de mécanismes d’authentification à facteur unique.	Mot de passe + TOTP, clé FIDO/passkey ou autre combinaison de facteurs appropriée. Au niveau L3, un facteur matériel résistant au phishing est requis.	Tenter d’accéder à une ressource protégée avec seulement le premier facteur. L’accès doit rester bloqué tant que l’authentification requise n’est pas terminée.
6.3.4 — L2	Documenter toutes les voies d’authentification et appliquer les mêmes garanties.	Inventaire des endpoints et flux : web, mobile, SSO, API, récupération et connexion alternative.	Tester les voies secondaires pour rechercher un contournement de la MFA ou une politique plus faible.
6.3.5 — L3	Avertir les utilisateurs des tentatives suspectes, réussies ou échouées.	Alertes en cas de nouvel appareil, localisation inhabituelle, échecs répétés ou authentification partielle.	Simuler une tentative suspecte puis une connexion réussie après plusieurs échecs. Vérifier que les notifications prévues sont émises.
6.3.6 — L3	Ne pas utiliser le courrier électronique comme mécanisme d’authentification.	Éviter les codes email comme facteur d’authentification ; préférer TOTP ou des mécanismes cryptographiques adaptés.	Parcourir les flux de connexion et de MFA pour vérifier qu’un code reçu par email ne suffit pas à authentifier l’utilisateur.
6.3.7 — L3	Avertir après une modification des données d’authentification.	Notification après réinitialisation, changement de mot de passe, de nom d’utilisateur ou d’adresse email.	Modifier les données d’authentification et vérifier que l’utilisateur reçoit une notification sans divulgation excessive.
6.3.8 — L3	Empêcher l’énumération des comptes valides.	Messages d’erreur génériques, codes HTTP cohérents et traitement suffisamment homogène ; réponses génériques pour l’inscription et la récupération.	Comparer les réponses pour un compte existant et un compte inexistant, y compris les codes HTTP, messages et temps de réponse.
À comprendre : les trois attaques à distinguer
- Force brute : essayer de nombreuses valeurs de mot de passe contre un compte.
- Credential stuffing : réutiliser des couples identifiant/mot de passe issus d’autres fuites.
- Énumération des comptes : découvrir quels utilisateurs possèdent un compte grâce aux réponses de l’application.
Ces attaques nécessitent des protections complémentaires. Un simple CAPTCHA ne remplace ni le rate limiting ni la neutralisation des différences de réponses.
5. V6.4 — Cycle de vie et récupération des facteurs d’authentification
ID / Niveau	Exigence	Mécanisme technique	Test de sécurité
6.4.1 — L1	Générer des mots de passe initiaux et des codes d’activation aléatoires et sécurisés, à durée de vie courte ou utilisables une seule fois. Ils ne doivent pas devenir des mots de passe permanents.	CSPRNG, jetons d’activation imprévisibles, expiration et invalidation après utilisation. Obliger l’utilisateur à définir son propre mot de passe.	Générer plusieurs codes et vérifier leur imprévisibilité, leur expiration et leur invalidation après la première utilisation.
6.4.2 — L1	Ne pas utiliser d’indices de mot de passe ni de questions secrètes.	Supprimer les questions de connaissance personnelle et utiliser un processus de récupération sécurisé.	Vérifier les formulaires de connexion et de récupération : aucune question secrète ne doit permettre de récupérer l’accès.
6.4.3 — L2	Sécuriser la réinitialisation d’un mot de passe oublié sans contourner la MFA activée.	Jeton de réinitialisation aléatoire, temporaire, à usage unique, lié au compte ; maintien des garanties MFA.	Demander une réinitialisation puis tenter d’accéder au compte sans satisfaire les facteurs requis. Vérifier également l’expiration et le rejeu du jeton.
6.4.4 — L2	En cas de perte d’un facteur MFA, vérifier l’identité au même niveau que lors de l’inscription.	Procédure de récupération renforcée, vérification d’identité proportionnée et révocation du facteur perdu.	Simuler la perte d’un téléphone ou d’une clé. Vérifier qu’une simple connaissance du nom d’utilisateur ou de l’email ne suffit pas à supprimer la MFA.
6.4.5 — L3	Envoyer suffisamment tôt les instructions de renouvellement des facteurs qui expirent.	Notifications anticipées et rappels automatiques avant expiration.	Configurer un facteur de test avec une expiration proche et vérifier l’envoi des rappels selon la politique définie.
6.4.6 — L3	Permettre aux administrateurs de déclencher une réinitialisation sans choisir ni connaître le nouveau mot de passe.	Lien de réinitialisation temporaire ou procédure imposant à l’utilisateur de définir lui-même son secret. Journalisation de l’action administrative.	Déclencher une réinitialisation depuis un compte administrateur. Vérifier que celui-ci ne peut pas définir le mot de passe final ni le lire.
Point critique : la récupération de compte est souvent le maillon faible de l’authentification. Une MFA robuste n’apporte pas une protection suffisante si un simple lien de récupération permet de la contourner.
6. V6.5 — Exigences générales de l’authentification multifacteur (MFA)
ID / Niveau	Exigence	Mécanisme technique	Test de sécurité
6.5.1 — L2	Les secrets de récupération, codes hors bande et TOTP ne doivent réussir qu’une seule fois.	Stocker l’état d’utilisation des codes ; invalider atomiquement un code après validation. Pour les TOTP, empêcher la réutilisation d’un même intervalle accepté.	Soumettre deux fois le même code valide, y compris avec des requêtes simultanées. La seconde validation doit échouer.
6.5.2 — L2	Hacher les secrets de recherche de moins de 112 bits d’entropie avec un algorithme de stockage de mots de passe approuvé et un sel aléatoire d’au moins 32 bits. Une fonction de hachage standard est admise à partir de 112 bits d’entropie.	Hachage adapté au stockage de secrets, avec sel aléatoire. Appliquer un hachage rapide approprié aux secrets à forte entropie lorsque le référentiel le permet.	Inspecter le stockage backend : les secrets faibles ne doivent pas être conservés en clair ni protégés par un simple hachage rapide. Vérifier que le sel est aléatoire.
6.5.3 — L2	Générer les secrets de recherche, codes hors bande et graines TOTP avec un générateur cryptographiquement sûr.	CSPRNG fourni par le système ou une bibliothèque cryptographique éprouvée.	Examiner le code de génération et les dépendances. Vérifier l’absence de générateurs prévisibles comme Math.random() pour ces secrets.
6.5.4 — L2	Assurer au moins 20 bits d’entropie pour les secrets de recherche et codes hors bande.	Codes aléatoires avec suffisamment de possibilités, associés à un rate limiting.	Vérifier l’espace des valeurs possibles et le caractère aléatoire des codes. Tester les protections contre les essais répétés.
6.5.5 — L2	Définir une durée de vie pour les demandes, codes et jetons hors bande, et pour les TOTP. Maximum : 10 minutes pour les demandes hors bande et 30 secondes pour les TOTP.	Horodatage serveur, expiration vérifiée côté backend et invalidation après usage.	Soumettre un code expiré. Vérifier son rejet après la limite définie, y compris si l’horloge du navigateur est modifiée.
6.5.6 — L3	Permettre la révocation de tout facteur, y compris matériel, en cas de perte ou de vol.	Registre des facteurs enregistrés, suppression ou désactivation, révocation des clés et invalidation des sessions concernées selon la politique.	Révoquer un facteur de test puis tenter de l’utiliser. L’authentification doit échouer.
6.5.7 — L3	N’utiliser la biométrie que comme facteur secondaire, avec un facteur de possession ou de connaissance.	Biométrie associée, par exemple, au déverrouillage local d’une passkey ou d’un authentificateur sécurisé.	Vérifier que la biométrie seule ne permet pas de contourner les autres facteurs requis par la politique.
6.5.8 — L3	Vérifier les TOTP à partir d’une source temporelle fiable, et non d’une heure contrôlée par le client.	Horloge système synchronisée avec une source de temps fiable ; validation TOTP côté serveur.	Modifier l’heure du navigateur ou du téléphone et vérifier que cela ne permet pas d’accepter un code expiré ou invalide.
Précisions techniques sur les TOTP
Un TOTP est un code calculé à partir d’un secret partagé et d’un intervalle temporel. Dans une implémentation classique, l’algorithme est défini par RFC 6238.
Exemple de comportement attendu :
1. Le serveur génère un secret initial sécurisé.
2. L’utilisateur associe une application d’authentification.
3. L’application produit un code temporaire.
4. Le serveur vérifie le code avec sa propre heure de référence.
5. Après validation, le même code ne doit pas pouvoir être rejoué avec succès.
Le contrôle anti-rejeu est distinct du contrôle d’expiration : un code peut être encore dans sa fenêtre temporelle tout en ayant déjà été utilisé.
7. V6.6 — Authentification hors bande (out-of-band)
L’authentification hors bande utilise un canal secondaire, par exemple une application mobile recevant une demande de validation. Le SMS est une méthode restreinte, et le courrier électronique n’est pas considéré comme un canal hors bande acceptable dans les exigences décrites ici.



ID / Niveau	Exigence	Mécanisme technique	Test de sécurité
6.6.1 — L2	Si le SMS ou l’appel téléphonique est proposé, le numéro doit avoir été validé au préalable. D’autres méthodes plus robustes doivent être proposées, avec information sur les risques. Le téléphone et le SMS ne sont pas disponibles au niveau L3.	Vérification préalable du numéro ; préférence pour TOTP ou clés cryptographiques ; détection des changements de SIM et des portages suspects si le SMS est conservé.	Essayer d’activer le SMS avec un numéro non vérifié. Vérifier aussi qu’une application de niveau L3 ne propose pas ce mécanisme.
6.6.2 — L2	Lier chaque demande, code ou jeton hors bande à la demande d’authentification d’origine.	Nonce ou identifiant de transaction unique, associé au compte, à la session et à la demande initiale ; durée de vie limitée.	Générer deux demandes, puis tenter d’utiliser le code de la première pour la seconde. La validation doit échouer.
6.6.3 — L2	Protéger les mécanismes hors bande à base de codes contre la force brute avec un rate limiting. Envisager au moins 64 bits d’entropie.	Limitation des tentatives par compte et par transaction, expiration, surveillance des échecs et codes à forte entropie lorsque le mécanisme le permet.	Soumettre de nombreux codes incorrects. Vérifier le blocage ou le ralentissement des tentatives et l’absence de contournement par création répétée de demandes.
6.6.4 — L3	Protéger les notifications push contre les attaques de type push bombing.	Rate limiting, plafonnement des demandes, notification contextuelle et correspondance de numéros (number matching) lorsque disponible.	Déclencher plusieurs demandes successives. Vérifier qu’elles sont limitées et que l’utilisateur ne peut pas être amené à approuver involontairement une demande étrangère.
À distinguer : le push bombing consiste à inonder l’utilisateur de demandes de validation pour l’inciter à approuver une connexion frauduleuse. La correspondance de numéros réduit ce risque en demandant de confirmer un nombre affiché dans le contexte de connexion.
8. V6.7 — Mécanismes d’authentification cryptographique
Ces mécanismes reposent sur une preuve cryptographique, par exemple une clé FIDO ou une carte à puce. Le serveur envoie un défi que l’authentificateur doit signer ou traiter à l’aide d’une clé protégée.
ID / Niveau	Exigence	Mécanisme technique	Test de sécurité
6.7.1 — L3	Protéger les certificats utilisés pour vérifier les assertions d’authentification cryptographique contre toute modification.	Stockage protégé des certificats et des clés de confiance, contrôle d’intégrité, gestion sécurisée des autorités de certification et des mises à jour.	Tenter de modifier un certificat ou une configuration de confiance. Vérifier que l’altération est détectée et que les assertions non fiables sont rejetées.
6.7.2 — L3	Utiliser un nonce de défi d’au moins 64 bits, statistiquement unique ou unique pendant toute la durée de vie du dispositif cryptographique.	Nonce généré avec un CSPRNG, associé à la transaction et vérifié côté serveur ; protection contre la réutilisation.	Capturer une réponse d’authentification valide et la rejouer lors d’une nouvelle demande. Le serveur doit la rejeter. Vérifier aussi la longueur et l’unicité des défis.
Exemple de déroulement d’une authentification cryptographique
1. L’utilisateur
Initie une connexion avec sa clé FIDO ou sa passkey.


2. Le serveur
Génère un défi unique et l’envoie à l’authentificateur.


3. L’authentificateur
Utilise sa clé privée protégée pour produire une réponse cryptographique.


4. Le serveur
Vérifie la réponse, le défi, l’origine et le contexte avant d’autoriser la connexion.


Le principe essentiel est que la clé privée ne doit pas être transmise au serveur. Le défi unique contribue à empêcher les attaques par rejeu.
9. V6.8 — Authentification avec un fournisseur d’identité (IdP)
Cette section concerne notamment OpenID Connect (OIDC), OAuth utilisé dans un parcours de connexion et SAML. Elle est particulièrement importante lorsque l’application permet de se connecter avec Google, Microsoft ou un fournisseur d’identité d’entreprise.
ID / Niveau	Exigence	Mécanisme technique	Test de sécurité
6.8.1 — L2	Empêcher l’usurpation d’identité lorsqu’il existe plusieurs fournisseurs d’identité.	Identifier un utilisateur par le couple (issuer, subject) — fournisseur et identifiant utilisateur — plutôt que par l’adresse email seule.	Créer des identités de test auprès de deux IdP. Vérifier qu’un même identifiant utilisateur ou une même adresse email ne provoque pas une fusion non autorisée des comptes.
6.8.2 — L2	Vérifier systématiquement la présence et l’intégrité des signatures numériques des assertions d’authentification.	Validation des signatures JWT ou SAML, de l’émetteur, de l’audience, de l’expiration et des paramètres cryptographiques attendus.	Modifier une assertion, utiliser un jeton mal signé ou non signé, ou changer son audience. Toutes ces tentatives doivent être rejetées.
6.8.3 — L2	Traiter les assertions SAML de manière unique et ne les accepter qu’une fois pendant leur période de validité.	Contrôle de l’identifiant de l’assertion, suivi des assertions déjà utilisées, vérification de la fenêtre temporelle et de la réponse SAML.	Soumettre deux fois la même assertion SAML valide. La deuxième tentative doit échouer.
6.8.4 — L2	Vérifier que l’IdP a satisfait les exigences d’authentification attendues par l’application.	Contrôle des revendications OIDC pertinentes, telles que acr, amr et auth_time, selon le fournisseur et le niveau exigé. Définir un comportement de secours documenté si ces informations manquent.	Simuler un jeton indiquant une authentification trop ancienne ou un facteur insuffisant. L’accès à la fonction sensible doit être refusé ou soumis à une nouvelle authentification.
Pour une implémentation OIDC, il faut notamment distinguer :
- iss : l’émetteur du jeton ;
- sub : l’identifiant de l’utilisateur chez cet émetteur ;
- aud : le destinataire prévu du jeton ;
- exp : la date d’expiration ;
- acr, amr, auth_time : informations utiles sur le niveau, les méthodes et le moment de l’authentification, lorsqu’elles sont fournies.
Référence technique : OWASP ASVS 5.0 — V6 Authentication. Les exigences et niveaux ci-dessus sont repris du chapitre de référence.




10. Checklist finale d’audit
Voici une checklist synthétique que tu peux utiliser lors d’un audit d’application. Elle complète les tests détaillés ci-dessus.
Contrôle de conformité
35 contrôles de synthèse couvrant les 47 exigences détaillées




V6.1 — Documentation
[ ] Les protections contre la force brute et le credential stuffing sont documentées.
[ ] La liste de mots de passe interdits spécifiques au contexte est définie.
[ ] Toutes les voies d’authentification sont documentées.

V6.2 — Mots de passe
[ ] La longueur minimale est appliquée et les mots de passe longs sont acceptés.
[ ] Le changement de mot de passe nécessite le secret actuel.
[ ] Les mots de passe courants et compromis sont rejetés.
[ ] Les gestionnaires de mots de passe et le collage sont autorisés.
[ ] Le mot de passe n’est ni tronqué ni transformé.
[ ] Les secrets sont stockés avec un hachage adapté.

V6.3 — Sécurité générale
[ ] Le rate limiting est effectif côté serveur.
[ ] Les comptes par défaut inutiles sont absents ou désactivés.
[ ] La MFA est imposée au niveau requis.
[ ] Les messages d’erreur ne permettent pas l’énumération des comptes.
[ ] Les notifications de sécurité prévues sont envoyées.

V6.4 — Récupération
[ ] Les codes initiaux sont aléatoires, temporaires et à usage unique.
[ ] Aucune question secrète n’est utilisée.
[ ] La réinitialisation ne contourne pas la MFA.
[ ] La perte d’un facteur déclenche une récupération sécurisée.
[ ] L’administrateur ne connaît pas le nouveau mot de passe.

V6.5 — MFA
[ ] Les codes sont à usage unique et protégés contre le rejeu.
[ ] Les secrets sont générés par un CSPRNG.
[ ] Le stockage des secrets est adapté à leur entropie.
[ ] Les durées de validité sont contrôlées côté serveur.
[ ] Les facteurs perdus peuvent être révoqués.
[ ] La vérification TOTP utilise une horloge fiable.

V6.6 — Hors bande
[ ] Les numéros utilisés pour le SMS sont vérifiés préalablement.
[ ] Les codes sont liés à leur demande d’origine.
[ ] Les tentatives de validation sont limitées.
[ ] Les demandes push sont protégées contre les abus.

V6.7 — Cryptographie
[ ] Les certificats et les éléments de confiance sont protégés.
[ ] Les défis sont suffisamment longs, uniques et non rejouables.

V6.8 — Fournisseurs d’identité
[ ] Les comptes sont identifiés par fournisseur et identifiant stable.
[ ] Les signatures et revendications des jetons sont vérifiées.
[ ] Les assertions SAML ne peuvent pas être rejouées.
[ ] Le niveau d’authentification exigé est effectivement contrôlé.
