# AgenceFlow LinkedIn DM Sync

Extension Chrome Manifest V3 pour importer manuellement les messages visibles d'une conversation LinkedIn vers AgenceFlow.

## Charger l'extension

1. Ouvrir `chrome://extensions`.
2. Activer le mode développeur.
3. Cliquer sur `Charger l'extension non empaquetée`.
4. Sélectionner `chrome-extension/linkedin-prospection-sync`.

## Configurer AgenceFlow

Dans AgenceFlow, définir côté serveur :

```env
AGENCEFLOW_EXTENSION_KEY=af_ext_votre_cle_longue
AGENCEFLOW_EXTENSION_USER_ID=uuid_utilisateur_supabase
SUPABASE_SERVICE_ROLE_KEY=...
```

Dans le popup Chrome, renseigner l'URL AgenceFlow et la même clé d'extension.

## Tester

1. Ouvrir une conversation LinkedIn DM.
2. Cliquer sur l'extension.
3. Cliquer sur `Importer la conversation`.
4. Vérifier le prospect dans `/admin/linkedin/prospection`.
5. Si AgenceFlow renvoie un message prêt, utiliser uniquement le bouton copier. L'extension ne clique pas dans LinkedIn et n'envoie jamais de message automatiquement.
