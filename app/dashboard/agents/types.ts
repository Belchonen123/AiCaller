export type AgentTemplateRow = {
  id: string;
  tenant_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  purpose: string | null;
  tags: string[] | null;
  version: number;
  retell_payload: unknown;
  default_voice: string | null;
  default_llm_model: string | null;
  required_variables: string[] | null;
  default_variables: Record<string, unknown> | null;
  imported_agent_ids: string[] | null;
  is_system: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type RetellAgentSummary = {
  agent_id: string;
  agent_name?: string | null;
  voice_id?: string | null;
};

export type RetellVoiceSummary = {
  voice_id: string;
  voice_name?: string | null;
  provider?: string | null;
  preview_audio_url?: string | null;
};

export type ImportTemplateResult = {
  agent_id: string;
  llm_id?: string;
  conversation_flow_id?: string;
  variables?: Record<string, string>;
};
