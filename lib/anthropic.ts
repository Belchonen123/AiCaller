import Anthropic from "@anthropic-ai/sdk";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export const anthropic = new Anthropic({
  apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
});
