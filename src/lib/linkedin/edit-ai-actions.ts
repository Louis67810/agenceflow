export type LinkedInEditActionCategory =
  | "Base"
  | "Attention technique"
  | "Rythme et structure"
  | "Engagement"
  | "Emotion";

export interface LinkedInEditAction {
  id: string;
  label: string;
  prompt: string;
  category: LinkedInEditActionCategory;
}

export const DEFAULT_LINKEDIN_EDIT_ACTION_GENERAL_PROMPT = `Principe :
L'utilisateur selectionne une partie precise du texte, puis clique sur une action.
L'IA doit modifier uniquement la partie selectionnee selon l'action choisie.

Regles generales pour toutes les actions :
- Ne modifier que le texte selectionne.
- Ne pas reecrire tout le post.
- Ne pas inventer de nouveau contexte.
- Ne pas ajouter de nouvelles informations non presentes dans la selection.
- Ne pas changer le sujet.
- Ne pas changer l'intention principale.
- Ne pas ajouter d'exemples fictifs.
- Ne pas rallonger inutilement sauf si l'action le demande.
- Ne pas ajouter de hashtags.
- Ne pas ajouter d'emojis sauf si l'action le demande explicitement.
- Garder un style LinkedIn naturel, clair et humain.
- Retourner uniquement le texte modifie, sans explication.
- Ne jamais ecrire "voici une version" ou "bien sur".
- Conserver la langue du texte selectionne.
- Si le texte selectionne est tres court, rester court.
- Si l'action ne peut pas etre appliquee proprement, faire la meilleure version possible sans inventer.

Exemples de forme uniquement :
- Hook : "La plupart des sites ne manquent pas de design. Ils manquent de clarte."
- Open loop : "J'ai change une seule chose dans mes pages. Et ca a tout rendu plus clair."
- Cadence courte :
Une page confuse coute cher.

Les visiteurs arrivent.
Ils hesitent.
Ils repartent.
- Question ouverte : "Selon vous, le plus dur en freelance, c'est de fixer ses prix ou de les assumer ?"
- Liste rythmee :
Un bon post a besoin de 3 choses :

-> un hook clair
-> une structure fluide
-> un CTA simple

Note technique :
L'IA recoit l'action choisie, le texte selectionne et eventuellement le contexte du post complet.
Meme si le contexte complet est fourni, la sortie doit remplacer uniquement le texte selectionne.
La reponse doit toujours etre du texte brut directement inserable dans l'editeur.
Aucune explication. Aucun commentaire. Aucun markdown sauf si l'action demande une structure avec lignes, liste ou symboles.`;

export const DEFAULT_LINKEDIN_EDIT_ACTIONS: LinkedInEditAction[] = [
  {
    id: "faire_variation",
    label: "Faire une variation",
    category: "Base",
    prompt: "Reecris uniquement le texte selectionne en faisant une variation naturelle. Garde le meme sens, la meme intention et le meme niveau d'information. Change seulement la formulation pour la rendre plus fluide ou plus impactante. Ne rajoute aucun contexte. Texte selectionne : {{selectedText}}",
  },
  {
    id: "retirer_emojis",
    label: "Retirer les emojis",
    category: "Base",
    prompt: "Retire uniquement les emojis du texte selectionne. Ne change pas les mots, ne reformule pas les phrases et ne modifie pas la ponctuation sauf si necessaire apres suppression des emojis. Retourne seulement le texte sans emojis. Texte selectionne : {{selectedText}}",
  },
  {
    id: "corriger_fautes",
    label: "Corriger les fautes d'orthographe",
    category: "Base",
    prompt: "Corrige uniquement les fautes d'orthographe, de grammaire, de conjugaison et de ponctuation dans le texte selectionne. Ne change pas le style, ne reformule pas inutilement et ne modifie pas le sens. Texte selectionne : {{selectedText}}",
  },
  {
    id: "developper",
    label: "Developper",
    category: "Base",
    prompt: "Developpe legerement le texte selectionne en gardant exactement la meme idee. Ajoute seulement des precisions logiques deja implicites dans le texte. N'invente pas de nouveaux exemples, chiffres, resultats ou contexte. Texte selectionne : {{selectedText}}",
  },
  {
    id: "condenser",
    label: "Condenser",
    category: "Base",
    prompt: "Raccourcis le texte selectionne en gardant l'idee principale, le ton et l'intention. Supprime les repetitions, les mots inutiles et les formulations trop longues. Ne supprime pas les informations essentielles. Texte selectionne : {{selectedText}}",
  },
  {
    id: "attention_technique",
    label: "Attention technique",
    category: "Attention technique",
    prompt: "Reecris le texte selectionne pour attirer davantage l'attention des les premiers mots. Garde le meme sujet et le meme sens, mais rends la formulation plus directe, plus nette et plus engageante. N'ajoute pas de nouveau contexte. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_hook",
    label: "Transformer en hook",
    category: "Attention technique",
    prompt: "Transforme le texte selectionne en hook LinkedIn court et impactant. Le hook doit donner envie de lire la suite, sans tout expliquer. Garde le meme sujet et la meme idee. Ne rajoute pas d'information inventee. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_open_loop",
    label: "Transformer en open loop",
    category: "Attention technique",
    prompt: "Transforme le texte selectionne en open loop. Cree une phrase qui ouvre une boucle mentale et donne envie de connaitre la suite. Garde le meme sujet et ne revele pas tout immediatement. N'invente pas de contexte. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_micro_open_loop",
    label: "Transformer en micro open loop",
    category: "Attention technique",
    prompt: "Transforme le texte selectionne en micro open loop tres court. La phrase doit creer une petite attente ou une tension immediate, sans changer le sens. Reste simple et direct. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_pattern_interrupt",
    label: "Transformer en pattern interrupt",
    category: "Attention technique",
    prompt: "Transforme le texte selectionne en pattern interrupt. La phrase doit casser le rythme attendu, surprendre legerement ou faire s'arreter le lecteur. Garde la meme idee et ne rajoute aucun contexte invente. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_curiosity_gap",
    label: "Transformer en curiosity gap",
    category: "Attention technique",
    prompt: "Transforme le texte selectionne en curiosity gap. Fais comprendre qu'il manque une information importante ou interessante, sans tout reveler. Garde le meme sujet et la meme intention. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_accroche_contrarienne",
    label: "Transformer en accroche contrarienne",
    category: "Attention technique",
    prompt: "Transforme le texte selectionne en accroche contrarienne. Reformule l'idee pour aller contre une croyance classique ou une evidence apparente. Ne change pas le fond et n'invente pas d'argument supplementaire. Texte selectionne : {{selectedText}}",
  },
  {
    id: "rythme_structure",
    label: "Rythme et structure",
    category: "Rythme et structure",
    prompt: "Ameliore le rythme et la structure du texte selectionne. Aere le texte, coupe les phrases trop longues et rends la lecture plus fluide. Ne change pas le sens, ne rajoute pas d'information et ne supprime pas les elements importants. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_liste_rytmee",
    label: "Transformer en liste rythmee",
    category: "Rythme et structure",
    prompt: "Transforme le texte selectionne en liste rythmee, claire et facile a lire. Garde uniquement les idees presentes dans le texte. Ne rajoute pas de nouveaux points. Utilise des lignes courtes. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_structure_escalier",
    label: "Transformer en structure escalier",
    category: "Rythme et structure",
    prompt: "Transforme le texte selectionne en structure escalier. La premiere ligne doit etre la plus longue, puis chaque ligne suivante doit etre moins longue que la precedente, pour creer une forme visuelle d'escalier. Garde le meme sens, conserve uniquement les idees presentes dans la selection et ne rajoute pas de contexte. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_symbole_visuel",
    label: "Transformer en symbole visuel",
    category: "Rythme et structure",
    prompt: "Reorganise le texte selectionne avec des symboles visuels simples pour rendre la lecture plus claire. Tu peux utiliser des fleches, coches ou croix si cela aide. Ne change pas le sens et n'ajoute pas de nouvelles idees. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_cadence_courte",
    label: "Transformer en cadence courte",
    category: "Rythme et structure",
    prompt: "Reecris le texte selectionne avec une cadence plus courte. Coupe les phrases longues, garde un rythme rapide et naturel. Ne change pas le sens et ne rajoute aucune information. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_question_ouverte",
    label: "Transformer en question ouverte",
    category: "Engagement",
    prompt: "Transforme le texte selectionne en question ouverte qui invite a repondre ou a partager un avis. Garde le meme sujet. La question doit etre simple, naturelle et adaptee a LinkedIn. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_polarisation",
    label: "Transformer en polarisation",
    category: "Engagement",
    prompt: "Transforme le texte selectionne en formulation plus polarisante. Fais ressortir deux visions opposees ou une position plus tranchee, sans devenir agressif et sans inventer de nouveaux arguments. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_citation_memorable",
    label: "Transformer en citation memorable",
    category: "Engagement",
    prompt: "Transforme le texte selectionne en citation courte, memorable et partageable. Garde l'idee principale, mais rends-la plus nette, plus concise et plus marquante. Ne rajoute aucun contexte. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_insight_personnel",
    label: "Transformer en insight personnel",
    category: "Engagement",
    prompt: "Transforme le texte selectionne en insight personnel. Reformule comme une prise de recul ou une lecon apprise, sans inventer d'experience ou de contexte personnel absent du texte. Garde le meme fond. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_lead_magnet",
    label: "Transformer en lead magnet",
    category: "Engagement",
    prompt: "Transforme le texte selectionne en mini-CTA de lead magnet. Fais comprendre qu'une ressource peut aider a aller plus loin et invite a commenter un mot-cle simple. N'invente pas le contenu exact de la ressource si ce n'est pas present. Reste court. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_erreur_volontaire",
    label: "Transformer en erreur volontaire",
    category: "Engagement",
    prompt: "Transforme le texte selectionne en formulation qui met volontairement en avant une erreur frequente ou une mauvaise approche. Le but est de creer une tension du type \"voici ce qu'il ne faut pas faire\". Ne change pas le sujet et n'invente pas de nouveaux exemples. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_repetition_dynamique",
    label: "Transformer en repetition dynamique",
    category: "Emotion",
    prompt: "Reecris le texte selectionne en utilisant une repetition dynamique pour renforcer l'idee. La repetition doit rendre le texte plus rythme et memorable, sans alourdir ni changer le sens. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_vulnerabilite",
    label: "Transformer en vulnerabilite",
    category: "Emotion",
    prompt: "Reecris le texte selectionne avec une touche plus vulnerable et humaine. Garde la meme idee, mais rends la formulation plus sincere, plus personnelle ou plus honnete. N'invente pas d'histoire, d'echec ou de contexte absent du texte. Texte selectionne : {{selectedText}}",
  },
  {
    id: "transformer_contraste_emotionnel",
    label: "Transformer en contraste emotionnel",
    category: "Emotion",
    prompt: "Transforme le texte selectionne en contraste emotionnel. Fais ressortir une opposition entre deux etats, par exemple avant/apres, peur/confiance, doute/clarte ou frustration/soulagement. Garde le meme sujet et ne rajoute pas de contexte invente. Texte selectionne : {{selectedText}}",
  },
];

export function normalizeLinkedInEditActions(actions?: LinkedInEditAction[] | null): LinkedInEditAction[] {
  const savedById = new Map(
    (Array.isArray(actions) ? actions : [])
      .filter((action): action is LinkedInEditAction => Boolean(action?.id && action?.label && action?.prompt))
      .map((action) => [action.id, action])
  );

  return DEFAULT_LINKEDIN_EDIT_ACTIONS.map((defaultAction) => {
    const saved = savedById.get(defaultAction.id);
    return {
      ...defaultAction,
      ...(saved ?? {}),
      category: saved?.category ?? defaultAction.category,
    };
  });
}

export function fillLinkedInEditActionPrompt(prompt: string, selectedText: string) {
  return prompt.replace(/\{\{selectedText\}\}/g, selectedText);
}
