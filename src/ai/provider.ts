import { createOpenAI } from "@ai-sdk/openai";
import type { RuntimeConfig } from "../types.js";

export function getLanguageModel(config: RuntimeConfig) {
  const provider = createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
    name: "custom",
  });

  return provider(config.aiModel);
}
