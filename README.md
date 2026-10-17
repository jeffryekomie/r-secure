# RTL Connect — Application de gestion wifi pour les clients RTL Gabon

## Architecture (VPN, sans dépendance au fabricant)

```
App mobile (React Native / Expo) — 5 onglets : Accueil, Appareils, Planning, Réseau, Aide
        │  HTTPS / JSON
        ▼
Backend (Node.js / Express) — auth, routeurs, appareils, planning, support
        │  HTTP, à travers le tunnel VPN
        ▼
Serveur VPN OpenVPN — backend/vpn/
        │  Tunnel permanent
        ▼
Routeur ZLT W154R Plus (IDU) + ZLT X17U (ODU, antenne extérieure sans interface propre)
```

Matériel confirmé : le **W154R Plus** est l'unité intérieure/routeur (interface
192.168.1.1, wifi, VPN Client). L'ODU X17U est l'antenne extérieure, sans
configuration propre. Le VPN Client du W154R Plus fonctionne en **OpenVPN** —
confirmé compatible avec le serveur fourni dans `backend/vpn/`.

## Fonctionnalités couvertes

- Allumer / couper le wifi, à la demande
- Minuteur ponctuel ("couper dans 30 min / 1h / 2h")
- Créneaux récurrents (jours + heure de début/fin)
- Liste des appareils connectés, avec déconnexion (kick), réautorisation,
  et retrait de la liste/historique sans blocage réseau
- Limite de connexion quotidienne par appareil (blocage auto à la limite,
  remise à zéro chaque jour — sans jamais lever un kick manuel, voir audit ci-dessous)
- Nom du réseau (SSID), mot de passe, visibilité (masqué/visible)
- Onglet Aide avec les informations de support (numéro 202, horaires)

## Étape obligatoire avant production

`backend/src/services/localRouterApi.js` contient des **requêtes placeholder**
(schéma `/goform/...`, non confirmé pour le W154R Plus). Connectez-vous à
`192.168.1.1`, ouvrez les DevTools (F12 → Network), changez le SSID / mot de
passe / visibilité / état wifi un par un, et partagez les requêtes exactes
("Copy as cURL") pour ajuster ce fichier.

## Démarrer le backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

## Lancer les tests automatisés de la logique du scheduler

```bash
cd backend
node --test test/schedulerLogic.test.js
```

Aucune dépendance à installer — utilise le test runner natif de Node.js 22+.

## Mettre en place le serveur VPN

Voir `backend/vpn/README.md`.

## Démarrer l'app mobile

```bash
cd mobile
npm install
npx expo start
```

Changez `BASE_URL` dans `mobile/src/api/client.js`.

## Générer l'APK Android (Expo / EAS Build)

Le projet est React Native (Expo) — **pas compatible avec Capacitor**, qui sert
à emballer des sites web, pas des apps React Native. Le chemin natif correct
pour ce projet est **EAS Build**, l'outil officiel d'Expo. `app.json` et
`eas.json` sont déjà configurés (profil `preview` = fichier `.apk` direct).

```bash
cd mobile
npm install -g eas-cli        # une seule fois sur votre machine
eas login                     # créez un compte gratuit sur expo.dev si besoin
eas build -p android --profile preview
```

La commande envoie le projet sur les serveurs de build d'Expo (gratuit avec
limite mensuelle sur le plan gratuit) et vous donne un lien de téléchargement
du `.apk` une fois le build terminé (quelques minutes).

Pour une version destinée au Play Store plus tard (format `.aab` au lieu
d'`.apk`) :

```bash
eas build -p android --profile production
```


## Ce qu'il reste à faire

- [ ] Capturer les requêtes réelles de 192.168.1.1 et ajuster `localRouterApi.js`
- [ ] Monter le serveur VPN sur une machine avec IP/domaine fixe
- [ ] Générer un profil `.ovpn` par routeur vendu
- [ ] Construire le formulaire d'ajout de créneau dans l'app (bouton déjà présent)
- [ ] Ajouter un bouton "Réautoriser" dans l'app pour les appareils kickés manuellement (route API déjà prête : `unblockDevice`)
- [ ] Rendre les contenus de l'onglet Aide modifiables depuis un futur back-office (actuellement en base, modifiables seulement par requête SQL directe)
- [ ] Ajouter HTTPS + nom de domaine avant la mise en production
