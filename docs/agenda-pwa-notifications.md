# Notifications PWA Agenda / Habits

Ce module envoie des notifications Web Push pour l'Agenda sans app iOS native.

## Fonctionnalités incluses

- Brief du matin à l'heure choisie dans les paramètres Agenda.
- Rappel de récap du soir à l'heure choisie, uniquement si le récap du jour n'est pas encore rempli.
- Abonnement PWA par appareil depuis `/admin/agenda/settings`.
- Notification test.
- Nettoyage automatique des subscriptions expirées (`404` / `410`).

## Pré-requis iPhone

Sur iPhone, l'utilisateur doit :

1. ouvrir AgenceFlow dans Safari ;
2. ajouter le site à l'écran d'accueil ;
3. ouvrir AgenceFlow depuis l'icône installée ;
4. activer les notifications depuis les paramètres Agenda.

## Variables d'environnement

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:contact@votre-domaine.com
CRON_SECRET=un-secret-long
```

Génération rapide des clés VAPID :

```bash
node -e "const crypto=require('crypto');const e=crypto.createECDH('prime256v1');e.generateKeys();const b=b=>b.toString('base64url');console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY='+b(e.getPublicKey()));console.log('VAPID_PRIVATE_KEY='+b(e.getPrivateKey()));"
```

## Base de données

Appliquer le SQL :

```text
src/lib/supabase/agenda-pwa-notifications.sql
```

## Cron à configurer

Appeler régulièrement :

```text
GET /api/cron/agenda-notifications
Authorization: Bearer <CRON_SECRET>
```

Recommandation : toutes les minutes ou toutes les 5 minutes. Le cron vérifie le fuseau horaire de chaque utilisateur.

## Extensions possibles à connecter ensuite

- Notifications de début de pomodoro / fin de pomodoro / fin de pause.
- Relance si aucune tâche n'est commencée avant une heure donnée.
- Notification si une tâche importante n'est pas terminée à l'approche de son créneau.
- Notification si une habitude quotidienne n'est pas validée.
- Résumé hebdomadaire : score moyen, tâches faites, habitudes, meilleure série.
- Notifications projet : review client reçue, message non lu, échéance projet proche.
- Brief IA plus personnalisé : priorité du jour, risque de surcharge, proposition d'ordre des tâches.
- Bouton d'action dans la notification pour ouvrir directement le récap, l'agenda ou la tâche.
- Digest multi-appareils : envoyer seulement sur le dernier appareil actif.
- Paramètres par jour de semaine : horaires différents week-end / semaine.
- Connexion Google Calendar plus poussée : notifier avant les créneaux bloqués ou proposer des plages focus.

Ce module ne lit pas le temps d'écran iOS et ne bloque aucune app. Ces fonctions nécessiteraient une app iOS native et les APIs Screen Time d'Apple.
