import OpenAI from "openai";
import { getPreferenceValues } from "@raycast/api";
import { NameSuggestion, Preferences } from "../types";
import { debugLog } from "./logging";
import path from "path";
import crypto from "crypto";
import { RequestConfig } from "./fileProcessing";
import { showToast, Toast } from "@raycast/api";

/**
 * Check if the model supports the reasoning parameter
 * GPT-5.2 models support reasoning, GPT-4.1 does not
 */
function supportsReasoning(model: string): boolean {
  return model.startsWith("gpt-5");
}

/**
 * Call the OpenAI API with the given content and prompt using the Responses API
 */
export async function callOpenAIAPI(openai: OpenAI, config: RequestConfig): Promise<string | null> {
  try {
    const preferences = getPreferenceValues<Preferences>();
    const patternKey = `${config.documentType}Pattern`;

    // Get pattern from preferences or use the preset pattern if provided
    let pattern = "";
    if (config.patternFormat) {
      pattern = config.patternFormat;
    } else if (preferences[patternKey as keyof Preferences]) {
      pattern = preferences[patternKey as keyof Preferences] as string;
    }

    // Create user prompt
    let userPrompt = config.userPrompt;

    // Add pattern format instructions if needed
    if (config.patternInstructions && pattern) {
      userPrompt += `\n\nUse this EXACT naming pattern: ${pattern}`;
    }

    // Show toast for OpenAI request
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Analyzing Document",
      message: "Sending to OpenAI...",
    });

    // Check if we're handling an image
    const isImage = config.contentType.startsWith("image/") && config.fileContent;

    let response: string | null;
    if (isImage) {
      response = await handleImageRequest(openai, config, userPrompt);
    } else {
      response = await handleTextRequest(openai, config, userPrompt);
    }

    // Update toast on success
    toast.style = Toast.Style.Success;
    toast.title = "Analysis Complete";
    toast.message = "Generated filename suggestions";

    return response;
  } catch (error) {
    debugLog("Error calling OpenAI API:", error);
    throw error;
  }
}

/**
 * Handle image-based requests using Responses API with vision
 */
async function handleImageRequest(
  openai: OpenAI,
  config: RequestConfig,
  userPrompt: string,
): Promise<string | null> {
  debugLog("Using Responses API vision format for image analysis");
  debugLog("Sending image request to OpenAI with model:", config.model);

  const useReasoning = supportsReasoning(config.model);
  debugLog("OpenAI Responses API request:", {
    model: config.model,
    temperature: config.temperature,
    max_output_tokens: config.maxTokens,
    instructions: config.systemPrompt,
    userPrompt: userPrompt,
    hasImage: true,
    reasoning: useReasoning ? "none" : "not supported",
  });

  // Build request params
  const imageBaseParams = {
    model: config.model,
    instructions: config.systemPrompt,
    input: [
      {
        role: "user" as const,
        content: [
          { type: "input_text" as const, text: userPrompt },
          {
            type: "input_image" as const,
            image_url: `data:${config.contentType};base64,${config.fileContent}`,
            detail: "auto" as const,
          },
        ],
      },
    ],
    temperature: config.temperature,
    max_output_tokens: config.maxTokens,
  };

  // Add reasoning parameter for models that support it
  const response = useReasoning
    ? await openai.responses.create({ ...imageBaseParams, reasoning: { effort: "none" } })
    : await openai.responses.create(imageBaseParams);

  const output = response.output_text;
  debugLog("OpenAI Responses API response for image:", output);
  return output || null;
}

/**
 * Handle text-based requests using Responses API
 */
async function handleTextRequest(
  openai: OpenAI,
  config: RequestConfig,
  userPrompt: string,
): Promise<string | null> {
  debugLog("Using Responses API text format for analysis");
  debugLog("Sending text request to OpenAI with model:", config.model);

  // For text content, append to the prompt
  let fullPrompt = userPrompt;
  if (config.fileContent) {
    fullPrompt += `\n\nContent:\n${config.fileContent}`;
  }

  const useReasoningText = supportsReasoning(config.model);
  debugLog("OpenAI Responses API request:", {
    model: config.model,
    temperature: config.temperature,
    max_output_tokens: config.maxTokens,
    instructions: config.systemPrompt,
    userPrompt: fullPrompt.substring(0, 200) + "...",
    hasImage: false,
    reasoning: useReasoningText ? "none" : "not supported",
  });

  // Build request params
  const textBaseParams = {
    model: config.model,
    instructions: config.systemPrompt,
    input: [
      {
        role: "user" as const,
        content: [{ type: "input_text" as const, text: fullPrompt }],
      },
    ],
    temperature: config.temperature,
    max_output_tokens: config.maxTokens,
  };

  // Add reasoning parameter for models that support it
  const response = useReasoningText
    ? await openai.responses.create({ ...textBaseParams, reasoning: { effort: "none" } })
    : await openai.responses.create(textBaseParams);

  const output = response.output_text;
  debugLog("OpenAI Responses API response for text:", output);
  return output || null;
}

/**
 * Process the API response and generate name suggestions
 */
export async function processApiResponse(
  response: string,
  originalPath: string,
  extension: string,
): Promise<NameSuggestion[]> {
  if (!response) {
    debugLog("Empty response from API");
    return [];
  }

  try {
    debugLog("Processing API response:", response);
    const data = JSON.parse(response.trim());

    // Validate response structure
    if (!data.suggestions || !Array.isArray(data.suggestions)) {
      debugLog("Invalid response structure - missing suggestions array");
      return [];
    }

    // Clean up and filter suggestions
    const names = data.suggestions
      .map((name: string) => {
        // Remove any quotes around the name
        let cleanName = name.replace(/^["']|["']$/g, "");

        // Remove any file extension that matches our target extension
        if (extension && cleanName.endsWith(extension)) {
          cleanName = cleanName.slice(0, -extension.length);
        }

        // Remove numbering or bullets at the start
        cleanName = cleanName.replace(/^\d+\.\s*|\*\s+|-\s+/, "");

        return cleanName.trim();
      })
      .filter((name: string) => name.length > 0)
      .filter((name: string, index: number, self: string[]) => self.indexOf(name) === index); // Remove duplicates

    debugLog("Final processed names:", names);

    // Convert to NameSuggestion objects
    const originalName = path.basename(originalPath, extension);
    return names.map((name: string, index: number) => ({
      id: crypto.randomUUID(),
      name,
      originalPath,
      extension,
      originalName,
      rank: index + 1,
    }));
  } catch (error) {
    debugLog("Error processing API response:", error);
    return [];
  }
}

/**
 * Get default filename
 */
export function getDefaultFileName(itemPath: string): string {
  const filename = path.basename(itemPath);
  return filename || "unnamed-file";
}
