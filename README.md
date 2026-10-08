# Facebook Events API

API REST pour des groupes et des événements : comptes, membres, rôles, demandes d’adhésion, invitations, organisateurs, participants et sondages.

Les corps de requête et les codes de réponse sont dans la doc OpenAPI, servie sur `/api/docs`.

## Règles métier

Un email est unique.

Un groupe a trois visibilités et trois rôles. Le créateur est `superadmin`. Il reste toujours au moins un `superadmin`.

| Rôle       | Publier, créer un événement | Inviter, traiter une demande | Retirer un membre, changer les rôles |
| ---------- | --------------------------- | ---------------------------- | ------------------------------------ |
| member     | Si le groupe l’autorise     | Non                          | Non                                  |
| admin      | Toujours                    | Oui                          | Non                                  |
| superadmin | Toujours                    | Oui                          | Oui                                  |

`membersCanPost` et `membersCanCreateEvents` limitent les membres. Un admin et un superadmin peuvent publier et créer un événement même quand ces options sont fausses.

| Visibilité | Qui voit la fiche         | Adhésion                                             |
| ---------- | ------------------------- | ---------------------------------------------------- |
| public     | Tout utilisateur connecté | Il rejoint directement                               |
| private    | Tout utilisateur connecté | Demande, ou invitation d’un admin ou d’un superadmin |
| secret     | Les membres               | Invitation d’un admin ou d’un superadmin             |

Le contenu d’un groupe privé (membres, événements) est réservé aux membres. Un groupe secret n’apparaît pas pour les autres.

Un événement a au moins un organisateur et des participants. Le créateur commence dans les deux listes. On ne retire pas le dernier organisateur. `startDate` est avant `endDate`.

Un événement `public` est lisible par tout utilisateur connecté, qui peut le rejoindre. Un événement `private` se rejoint en acceptant une invitation.

Un événement a zéro ou plusieurs sondages, créés et supprimés par un organisateur. Chaque sondage a une ou plusieurs questions, chaque question au moins deux options. Un participant choisit une option par question et peut remplacer son bulletin. Qui peut lire l’événement voit les questions, le nombre de voix et ses propres choix.

## À confirmer avec le métier

Ces choix sont en place. Ils restent à valider.

- Inviter les membres d’un groupe crée une invitation en attente pour chaque membre qui n’est pas déjà participant. Accepter ajoute un participant.
- Organisateurs et participants sont deux listes indépendantes. Nommer un organisateur ne l’inscrit pas à l’événement.
- Le créateur garde l’administration de l’événement après avoir quitté les organisateurs.
- Un événement privé est aussi lisible par son créateur et par un admin ou un superadmin de son groupe.
- Une invitation en attente ne donne pas accès à l’événement.
- Un groupe secret ne porte pas d’événement public. Le groupe d’un événement ne change pas. Sa visibilité peut passer de `public` à `private`.
- Supprimer un groupe supprime ses événements, leurs invitations, leurs sondages et les réponses. Retirer un participant efface ses réponses sur cet événement.
- L’icône et la photo de couverture sont des URL.

## Stack

Node.js 22, Express 5, MongoDB via Mongoose, Zod, JWT, bcrypt, Helmet, CORS, express-rate-limit, dotenv. La doc OpenAPI est servie par l’API.

## Sécurité

- Helmet, CORS limité à `CORS_ORIGINS`, rate limit sur `/api` et plus strict sur `/api/auth`
- JWT dans `Authorization: Bearer`. Le hash du mot de passe n’est dans aucune réponse
- Zod refuse les champs inconnus. Les identifiants MongoDB sont validés avant la requête
- `sanitizeFilter` : une valeur de filtre est comparée telle quelle

## Démarrage

Node.js 22+ et Docker. L’image `mongo:8` s’arrête sur les noyaux Linux récents de Docker Desktop, donc MongoDB 7 :

```bash
docker run -d --name facebook-mongo -p 27017:27017 mongo:7
cp .env.example .env
openssl rand -base64 32   # coller le résultat dans JWT_SECRET
npm install
npm run dev
```

`docker stop facebook-mongo` arrête MongoDB, `docker start facebook-mongo` le relance. La base `facebook-events` est créée au premier enregistrement.

```
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/facebook-events
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
CORS_ORIGINS=http://localhost:3000
```

L’API écoute sur `PORT`. `npm start` lance la même application sans rechargement.

## Test dans le terminal avec curl

L’API tourne. Les commandes enchaînent le chemin nominal : deux comptes, un groupe public, un événement, un sondage, puis une adhésion privée et une invitation secrète.

```bash
BASE=http://localhost:3000
# Lit une valeur dans le JSON d'une réponse. field "$OWNER" user.id affiche l'id.
field() { node -e 'let v=JSON.parse(process.argv[1]); for (const k of process.argv[2].split(".")) v=v[k]; console.log(v)' "$1" "$2"; }

# Ada crée son compte. La réponse contient le jeton et l'utilisateur.
OWNER=$(curl -s -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"password123","firstName":"Ada","lastName":"Lovelace"}')
OWNER_TOKEN=$(field "$OWNER" token)
OWNER_ID=$(field "$OWNER" user.id)

# Bea crée le sien.
GUEST=$(curl -s -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"bea@example.com","password":"password123","firstName":"Bea","lastName":"Guest"}')
GUEST_TOKEN=$(field "$GUEST" token)
GUEST_ID=$(field "$GUEST" user.id)

# Ada lit son profil, puis change son prénom.
curl -s "$BASE/api/users/me" -H "Authorization: Bearer $OWNER_TOKEN"
curl -s -X PATCH "$BASE/api/users/me" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"firstName":"Augusta"}'

# Ada crée un groupe public. Elle en est superadmin.
GROUP=$(curl -s -X POST "$BASE/api/groups" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Public club","visibility":"public"}')
GROUP_ID=$(field "$GROUP" id)

# Bea rejoint directement : un groupe public n'a pas de demande d'adhésion.
curl -s -X POST "$BASE/api/groups/$GROUP_ID/join" -H "Authorization: Bearer $GUEST_TOKEN"

# Ada crée un événement dans le groupe. Elle est organisatrice et participante.
EVENT=$(curl -s -X POST "$BASE/api/groups/$GROUP_ID/events" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Picnic","startDate":"2026-06-01T18:00:00.000Z","endDate":"2026-06-01T22:00:00.000Z","location":"Park","visibility":"public"}')
EVENT_ID=$(field "$EVENT" id)

# Une invitation en attente pour chaque membre qui n'est pas déjà participant. Ici, Bea.
INVITES=$(curl -s -X POST "$BASE/api/groups/$GROUP_ID/events/$EVENT_ID/invite-members" \
  -H "Authorization: Bearer $OWNER_TOKEN")
# Bea accepte. Elle devient participante.
curl -s -X POST "$BASE/api/event-invitations/$(field "$INVITES" 0.id)/accept" \
  -H "Authorization: Bearer $GUEST_TOKEN"

# Ada crée un sondage : une question, deux options.
POLL=$(curl -s -X POST "$BASE/api/events/$EVENT_ID/polls" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"questions":[{"text":"Menu","options":["Pizza","Salad"]}]}')
QUESTION_ID=$(field "$POLL" questions.0.id)
OPTION_ID=$(field "$POLL" questions.0.options.0.id)

# Bea répond. Un participant choisit une option par question.
curl -s -X PUT "$BASE/api/events/$EVENT_ID/polls/$(field "$POLL" id)/answers" \
  -H "Authorization: Bearer $GUEST_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"choices\":[{\"questionId\":\"$QUESTION_ID\",\"optionId\":\"$OPTION_ID\"}]}"

# Bea relit le sondage : les totaux et son propre choix.
curl -s "$BASE/api/events/$EVENT_ID/polls" -H "Authorization: Bearer $GUEST_TOKEN"

# Ada crée un groupe privé.
PRIVATE=$(curl -s -X POST "$BASE/api/groups" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Private club","visibility":"private"}')
PRIVATE_ID=$(field "$PRIVATE" id)

# Bea envoie une demande. Ada l'accepte : Bea devient membre.
curl -s -X POST "$BASE/api/groups/$PRIVATE_ID/join" -H "Authorization: Bearer $GUEST_TOKEN"
curl -s -X POST "$BASE/api/groups/$PRIVATE_ID/join-requests/$GUEST_ID/accept" \
  -H "Authorization: Bearer $OWNER_TOKEN"

# Ada crée un groupe secret.
SECRET=$(curl -s -X POST "$BASE/api/groups" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Secret club","visibility":"secret"}')
SECRET_ID=$(field "$SECRET" id)

# Ada invite Bea. Bea accepte et devient membre.
INVITE=$(curl -s -X POST "$BASE/api/groups/$SECRET_ID/invitations" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$GUEST_ID\"}")
curl -s -X POST "$BASE/api/group-invitations/$(field "$INVITE" id)/accept" \
  -H "Authorization: Bearer $GUEST_TOKEN"
```

## Améliorations possibles

- Billetterie
- Albums photo
- Publications dans le groupe
