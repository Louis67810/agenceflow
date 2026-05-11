export interface LinkedInExtensionProspect {
  name: string;
  profileUrl?: string;
  avatarUrl?: string;
  headline?: string;
}

export interface LinkedInExtensionThread {
  linkedinThreadKey?: string;
  pageUrl: string;
}

export interface LinkedInExtensionImage {
  url?: string;
  alt?: string;
}

export interface LinkedInExtensionMessage {
  externalId: string;
  sender: "me" | "them";
  senderName?: string;
  text: string;
  sentAt?: string;
  links?: string[];
  images?: LinkedInExtensionImage[];
  rawHash: string;
}

export interface LinkedInImportConversationBody {
  source: "linkedin_chrome_extension";
  importedAt: string;
  selectedProspectId?: string;
  prospect: LinkedInExtensionProspect;
  thread: LinkedInExtensionThread;
  messages: LinkedInExtensionMessage[];
}

export interface PendingLinkedInMessage {
  id: string;
  text: string;
}
