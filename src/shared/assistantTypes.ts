export type ConversationTurn = { role: "user" | "assistant"; content: string };
export type AssistantStatus = {
  provider?: "openai" | "azure" | "anthropic";
  configured: boolean;
  status: string;
  message: string;
  model: string | null;
  providerVerified: boolean;
  evidenceSources: number;
};
export type AssistantReply = {
  mode: string;
  modelStatus: string;
  failureReason?: string | null;
  providerDataSent?: boolean;
  explanation: string;
  paragraphs?: { text: string; evidenceIds: string[]; signalKeys: string[] }[];
  citations: {
    id: string;
    title: string;
    source_url: string;
    review_status: string;
  }[];
  retrieval?: { passages: { id: string; sourceId: string; text: string }[] };
  triage: { urgent: boolean };
  uncertainties?: string[];
  followUp?: string[];
  escalation: string;
  limitations: string;
};
