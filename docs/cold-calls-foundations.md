# Appel à froid — fondations et connexions futures

## Mise en route

1. Exécuter `src/lib/supabase/cold-calls.sql` dans Supabase SQL Editor.
2. Ouvrir `/admin/cold-calls`.
3. Importer un CSV avec idéalement les colonnes : `prenom`, `nom`, `entreprise`, `telephone`, `email`, `description`, `secteur`, `site`, `audit`.
4. Créer plusieurs accroches et utiliser les variables `{{prenom}}`, `{{nom}}`, `{{entreprise}}`, `{{secteur}}`.

Les leads, statuts, accroches et tentatives d'appel sont synchronisés dans Supabase et donc disponibles sur mobile et ordinateur.

## Architecture prévue

- `cold_call_leads` : profil, business, site, audit, étape et prochain appel.
- `cold_call_scripts` : variantes d'accroches et résultats agrégés.
- `cold_call_attempts` : résultat, durée, résumé, transcription, audio, coaching et identifiant téléphonique externe.

## Connexions possibles

### Trouver et enrichir beaucoup de leads
- Google Places API / Google Maps : entreprises locales, catégories, téléphone et site.
- Apollo, Cognism ou Kaspr : bases B2B et contacts.
- Dropcontact, Hunter ou FullEnrich : enrichissement et vérification.
- LinkedIn Sales Navigator : ciblage, avec un fournisseur autorisé pour l'export/enrichissement.

### Téléphonie et enregistrement
- Aircall, Ringover, Twilio Voice, JustCall ou CloudTalk.
- Un webhook téléphonique crée/met à jour `cold_call_attempts` à chaque début/fin d'appel.
- Sur mobile, l'approche la plus complète est d'appeler via l'application mobile du fournisseur téléphonique, reliée à AgenceFlow par API/webhooks.

### Transcription et coaching en direct
- Audio streaming du fournisseur téléphonique vers Deepgram, AssemblyAI ou un pipeline Whisper.
- Transcription partielle en temps réel envoyée à un coach IA qui retourne rapidement : objection détectée, prochaine question, preuve à utiliser et conseil de ton.
- Après l'appel : résumé, score, erreurs, moments clés et prochaines actions enregistrés sur le lead.

### Synchronisations utiles
- Google Calendar : rappels et rendez-vous pris.
- HubSpot/Pipedrive : synchronisation CRM bidirectionnelle.
- Slack/notifications PWA : rappels de relance et notification de rendez-vous.
- OpenAI/Anthropic : personnalisation des accroches et analyse post-appel.

## Conformité

Avant d'enregistrer ou transcrire des appels, vérifier les obligations locales d'information/consentement, la durée de conservation, le droit d'opposition et la conformité RGPD/ePrivacy.
