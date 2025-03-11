import { DOCUMENT_PROMPTS } from "./prompts";
import { SpecializedPrompts } from "./types";
import { debugLog } from "./utils/logging";

// Debug flag
export const DEBUG = true;

// Common configuration for all prompts without specifying model
// The model will be determined at runtime based on user preferences
export const PROMPT_CONFIG = {
  temperature: 0.7,
  maxTokens: 2000,
};

// Specialized prompts for different document types
export const SPECIALIZED_PROMPTS: SpecializedPrompts = Object.entries(DOCUMENT_PROMPTS).reduce(
  (acc, [key, value]) => {
    debugLog(`Processing document type: ${key}, patternInstructions: ${value.patternInstructions}`);

    return {
      ...acc,
      [key]: {
        ...value,
        ...PROMPT_CONFIG,
      },
    };
  },
  {} as SpecializedPrompts,
);

// Example custom prompts to help users
export const CUSTOM_PROMPT_EXAMPLES = {
  academic:
    "Analyze this academic document and suggest ten file names that follow academic naming conventions. Include author names, year, and subject matter. Maintain a formal, scholarly style.",

  medical:
    "Suggest ten file names for this medical document that include patient identifier (if present), date, procedure or condition, and provider information. Ensure HIPAA compliance by not using full patient names.",

  legal:
    "Analyze this legal document and create ten file names that include document type, case/matter reference, parties involved, date, and key subject. Use standard legal naming conventions.",

  photography:
    "Create ten descriptive file names for this image that capture the subject, scene, location, color scheme, and mood. Use artistic and evocative language.",
};
