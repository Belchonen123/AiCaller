import "server-only";

import { z } from "zod";

/* Do not import this on the client. Server-only. */

const RETELL_API_BASE_URL = "https://api.retellai.com";
const RETELL_TIMEOUT_MS = 30_000;

export type RetellCreatePhoneCallRequest = {
  from_number: string;
  to_number: string;
  override_agent_id?: string;
  metadata?: Record<string, unknown>;
  retell_llm_dynamic_variables?: Record<string, string>;
};

export type RetellCreatePhoneCallResponse = {
  call_id: string;
  call_status: string;
  agent_id: string;
  call_type: string;
};

export type RetellCallDetails = Record<string, unknown>;

export type RetellPhoneNumber = {
  phone_number: string;
  nickname?: string;
  agent_id?: string;
  inbound_agent_id?: string;
  outbound_agent_id?: string;
  agent_ids?: string[];
  inbound_agent_ids?: string[];
  outbound_agent_ids?: string[];
};

export type RetellAgentSummary = {
  agent_id: string;
  agent_name?: string | null;
  agentName?: string | null;
  name?: string | null;
  webhook_url?: string | null;
  voice_id?: string | null;
  voice?: string | null;
  llm_id?: string | null;
  llm?: string | null;
  model?: string | null;
};

export type RetellVoiceSummary = {
  voice_id: string;
  voice_name?: string | null;
  provider?: string | null;
  preview_audio_url?: string | null;
};

export type RetellAgentDetails = RetellAgentSummary & Record<string, unknown>;

export type RetellAgentImportPayload = {
  agent_name: string;
  voice_id: string;
  language?: string;
  response_engine: {
    type: "retell-llm" | "conversation-flow" | "single-prompt";
    llm_id?: string;
    conversation_flow_id?: string;
    prompt?: string;
  };
  webhook_url?: string;
  interruption_sensitivity?: number;
  enable_backchannel?: boolean;
  backchannel_frequency?: number;
  responsiveness?: number;
  voice_speed?: number;
  voice_temperature?: number;
  ambient_sound?: string | null;
  post_call_analysis_data?: Array<unknown>;
  post_call_analysis_model?: string;
  allow_user_dtmf?: boolean;
  voicemail_option?: { action?: { type: string; text?: string } };
  normalize_for_speech?: boolean;
  end_call_after_silence_ms?: number;
  max_call_duration_ms?: number;
  begin_message_delay_ms?: number;
  enable_transcription_formatting?: boolean;
  retell_llm?: {
    general_prompt: string;
    general_tools?: Array<unknown>;
    states?: Array<unknown>;
    starting_state?: string;
    begin_message?: string;
    model?: string;
    model_temperature?: number;
    model_high_priority?: boolean;
    tool_call_strict_mode?: boolean;
    default_dynamic_variables?: Record<string, string>;
    knowledge_base_ids?: string[];
  };
};

export type RetellAgentImportResponse = {
  agent_id: string;
  llm_id?: string;
  conversation_flow_id?: string;
  raw: unknown;
};

const retellAgentImportPayloadSchema = z
  .object({
    agent_name: z.string().min(1),
    voice_id: z.string().min(1),
    language: z.string().optional(),
    response_engine: z
      .object({
        type: z.enum(["retell-llm", "conversation-flow", "single-prompt"]),
        llm_id: z.string().optional(),
        conversation_flow_id: z.string().optional(),
        prompt: z.string().optional(),
      })
      .passthrough(),
    webhook_url: z.string().optional(),
    interruption_sensitivity: z.number().optional(),
    enable_backchannel: z.boolean().optional(),
    backchannel_frequency: z.number().optional(),
    responsiveness: z.number().optional(),
    voice_speed: z.number().optional(),
    voice_temperature: z.number().optional(),
    ambient_sound: z.string().nullable().optional(),
    post_call_analysis_data: z.array(z.unknown()).optional(),
    post_call_analysis_model: z.string().optional(),
    allow_user_dtmf: z.boolean().optional(),
    voicemail_option: z
      .object({
        action: z
          .object({
            type: z.string(),
            text: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    normalize_for_speech: z.boolean().optional(),
    end_call_after_silence_ms: z.number().optional(),
    max_call_duration_ms: z.number().optional(),
    begin_message_delay_ms: z.number().optional(),
    enable_transcription_formatting: z.boolean().optional(),
    retell_llm: z
      .object({
        general_prompt: z.string(),
        general_tools: z.array(z.unknown()).optional(),
        states: z.array(z.unknown()).optional(),
        starting_state: z.string().optional(),
        begin_message: z.string().optional(),
        model: z.string().optional(),
        model_temperature: z.number().optional(),
        model_high_priority: z.boolean().optional(),
        tool_call_strict_mode: z.boolean().optional(),
        default_dynamic_variables: z.record(z.string(), z.string()).optional(),
        knowledge_base_ids: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const retellAgentImportPatchSchema = retellAgentImportPayloadSchema.partial();

export class RetellApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, params: { status: number; body: unknown }) {
    super(message);
    this.name = "RetellApiError";
    this.status = params.status;
    this.body = params.body;
    Object.setPrototypeOf(this, RetellApiError.prototype);
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function requestRetell<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RETELL_TIMEOUT_MS);

  try {
    const response = await fetch(`${RETELL_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${getRequiredEnv("RETELL_API_KEY")}`,
        ...init?.headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const body = await parseResponseBody(response);

    if (!response.ok) {
      throw new RetellApiError(`Retell API request failed with status ${response.status}`, {
        status: response.status,
        body,
      });
    }

    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

function getStringField(body: unknown, field: string, depth = 0): string | undefined {
  if (!body || typeof body !== "object" || depth > 4) {
    return undefined;
  }

  if (Array.isArray(body)) {
    for (const item of body) {
      const match = getStringField(item, field, depth + 1);
      if (match) {
        return match;
      }
    }

    return undefined;
  }

  const record = body as Record<string, unknown>;
  const value = record[field];
  if (typeof value === "string") {
    return value;
  }

  for (const item of Object.values(record)) {
    const match = getStringField(item, field, depth + 1);
    if (match) {
      return match;
    }
  }

  return undefined;
}

export function validateRetellPayload(payload: unknown): RetellAgentImportPayload {
  return retellAgentImportPayloadSchema.parse(payload) as RetellAgentImportPayload;
}

export async function createPhoneCall(
  req: RetellCreatePhoneCallRequest
): Promise<RetellCreatePhoneCallResponse> {
  return requestRetell<RetellCreatePhoneCallResponse>("/v2/create-phone-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });
}

export async function getCall(callId: string): Promise<RetellCallDetails> {
  return requestRetell<RetellCallDetails>(`/v2/get-call/${encodeURIComponent(callId)}`);
}

export async function deleteCall(callId: string): Promise<void> {
  await requestRetell<unknown>(`/v2/delete-call/${encodeURIComponent(callId)}`, {
    method: "DELETE",
  });
}

export async function getAgent(agentId: string): Promise<RetellAgentDetails> {
  return requestRetell<RetellAgentDetails>(`/get-agent/${encodeURIComponent(agentId)}`);
}

export async function listPhoneNumbers(): Promise<RetellPhoneNumber[]> {
  const body = await requestRetell<RetellPhoneNumber[] | { phone_numbers?: RetellPhoneNumber[] }>(
    "/list-phone-numbers"
  );

  if (Array.isArray(body)) {
    return body;
  }

  return body.phone_numbers ?? [];
}

export async function listAgents(): Promise<RetellAgentSummary[]> {
  const body = await requestRetell<
    RetellAgentSummary[] | { agents?: RetellAgentSummary[] }
  >("/list-agents");

  const agents = Array.isArray(body) ? body : body.agents ?? [];
  const seen = new Set<string>();

  return agents.filter((agent) => {
    if (seen.has(agent.agent_id)) {
      return false;
    }

    seen.add(agent.agent_id);
    return true;
  });
}

export async function listVoices(): Promise<RetellVoiceSummary[]> {
  const body = await requestRetell<
    RetellVoiceSummary[] | { voices?: RetellVoiceSummary[] }
  >("/list-voices");

  if (Array.isArray(body)) {
    return body;
  }

  return body.voices ?? [];
}

export async function importAgent(
  payload: RetellAgentImportPayload
): Promise<RetellAgentImportResponse> {
  const validatedPayload = validateRetellPayload(payload);
  const body = await requestRetell<unknown>("/import-agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(validatedPayload),
  });
  const agentId = getStringField(body, "agent_id");

  if (!agentId) {
    throw new RetellApiError("Retell import-agent response did not include agent_id", {
      status: 502,
      body,
    });
  }

  return {
    agent_id: agentId,
    llm_id: getStringField(body, "llm_id"),
    conversation_flow_id: getStringField(body, "conversation_flow_id"),
    raw: body,
  };
}

export async function exportAgent(agentId: string): Promise<RetellAgentImportPayload> {
  const body = await requestRetell<unknown>(`/export-agent/${encodeURIComponent(agentId)}`);

  return validateRetellPayload(body);
}

export async function updateAgent(
  agentId: string,
  patch: Partial<RetellAgentImportPayload>
): Promise<{ agent_id: string }> {
  const validatedPatch = retellAgentImportPatchSchema.parse(patch);
  const body = await requestRetell<unknown>(`/update-agent/${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(validatedPatch),
  });

  return {
    agent_id: getStringField(body, "agent_id") ?? agentId,
  };
}

export async function deleteAgent(agentId: string): Promise<void> {
  await requestRetell<unknown>(`/delete-agent/${encodeURIComponent(agentId)}`, {
    method: "DELETE",
  });
}
