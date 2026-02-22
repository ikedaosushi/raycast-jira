import { getPreferenceValues } from "@raycast/api";
import OpenAI from "openai";

interface Preferences {
  openaiApiKey: string;
}

interface GeneratedTicket {
  summary: string;
  description: string;
}

export async function generateTicketContent(roughInput: string): Promise<GeneratedTicket> {
  const { openaiApiKey } = getPreferenceValues<Preferences>();
  const client = new OpenAI({ apiKey: openaiApiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that creates Jira ticket content from rough user input.
Given the user's rough description, generate:
- summary: A concise one-line title for the Jira ticket (max 100 chars)
- description: A clear, structured description suitable for a Jira ticket

Respond in the same language as the input.
Respond ONLY with valid JSON in this format: {"summary": "...", "description": "..."}`,
      },
      {
        role: "user",
        content: roughInput,
      },
    ],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  const parsed = JSON.parse(content) as GeneratedTicket;
  if (!parsed.summary || !parsed.description) {
    throw new Error("OpenAI response missing summary or description");
  }

  return parsed;
}
