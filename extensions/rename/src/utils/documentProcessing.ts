import OpenAI from "openai";
import { debugLog } from "./logging";
import { NameSuggestion } from "../types";
import { showToast, Toast } from "@raycast/api";
import { generatePromptWithHistory } from "../prompts";
import { PresetCategory, DEFAULT_PATTERNS, getCategoryName } from "./presets";
import path from "path";
import { showFailureToast } from "@raycast/utils";

/**
 * Check if the model supports the reasoning parameter
 * GPT-5.x models support reasoning, GPT-4.x does not
 */
function supportsReasoning(model: string): boolean {
  return model.startsWith("gpt-5");
}

/**
 * Check if the content type is an image type
 */
function isImageContentType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

interface DocumentFields {
  documentType?: string;
  date?: string;
  merchant?: string;
  items?: string;
  amount?: string;
  serviceProvider?: string;
  accountNumber?: string;
  formType?: string;
  institution?: string;
  accountHolder?: string;
  taxYear?: string;
  bankName?: string;
  accountType?: string;
  last4Digits?: string;
  contentType?: string;
  debug?: string;
}

// Valid document types for classification
const VALID_DOCUMENT_TYPES = [
  PresetCategory.Receipt,
  PresetCategory.Bill,
  PresetCategory.TaxDocument,
  PresetCategory.BankStatement,
  "generic",
] as const;

type ClassifiedDocumentType = (typeof VALID_DOCUMENT_TYPES)[number];

/**
 * Classify a document using the LLM to determine its type
 * This is the first step in Auto mode - classify before generating names
 */
async function classifyDocument(
  openai: OpenAI,
  fileContent: string,
  contentType: string,
  model: string,
): Promise<ClassifiedDocumentType> {
  debugLog("Step 1: Classifying document type using Responses API");

  const classificationPrompt = `Analyze this document and classify it into ONE of these categories:
- receipt: Purchase receipts, retail transactions, restaurant bills
- bill: Utility bills, service invoices, subscription charges
- taxDocument: Tax forms (W-2, 1099, etc.), tax statements, tax-related documents
- bankStatement: Bank statements, account summaries, financial statements
- generic: Any other document that doesn't fit the above categories

Respond with ONLY the category name (one word, lowercase). Do not include any explanation.`;

  try {
    // Build input content based on content type
    const isImage = isImageContentType(contentType);
    const inputContent: Array<
      | { type: "input_text"; text: string }
      | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" }
    > = [{ type: "input_text" as const, text: classificationPrompt }];

    // Only add image input for actual images
    if (isImage) {
      inputContent.push({
        type: "input_image" as const,
        image_url: `data:${contentType};base64,${fileContent}`,
        detail: "auto" as const,
      });
    } else {
      // For text content, append it to the prompt
      inputContent[0] = {
        type: "input_text" as const,
        text: `${classificationPrompt}\n\nDocument content:\n${fileContent}`,
      };
    }

    // Build request params
    const baseParams = {
      model: model,
      instructions:
        "You are a document classification assistant. Respond with only the document category.",
      input: [
        {
          role: "user" as const,
          content: inputContent,
        },
      ],
      temperature: 0.1, // Low temperature for consistent classification
      max_output_tokens: 50,
    };

    // Add reasoning parameter for models that support it (GPT-5.x)
    const response = supportsReasoning(model)
      ? await openai.responses.create({ ...baseParams, reasoning: { effort: "none" } })
      : await openai.responses.create(baseParams);

    const classification = response.output_text?.trim().toLowerCase() || "generic";
    debugLog("Document classified as:", classification);

    // Validate the classification
    if (VALID_DOCUMENT_TYPES.includes(classification as ClassifiedDocumentType)) {
      return classification as ClassifiedDocumentType;
    }

    // Try to match partial responses
    for (const validType of VALID_DOCUMENT_TYPES) {
      if (classification.includes(validType)) {
        debugLog(`Matched partial classification '${classification}' to '${validType}'`);
        return validType;
      }
    }

    debugLog(`Unknown classification '${classification}', defaulting to 'generic'`);
    return "generic";
  } catch (error) {
    debugLog("Error classifying document:", error);
    return "generic";
  }
}

/**
 * Map classified document type to PresetCategory
 */
function mapToPresetCategory(classifiedType: ClassifiedDocumentType): PresetCategory {
  switch (classifiedType) {
    case PresetCategory.Receipt:
      return PresetCategory.Receipt;
    case PresetCategory.Bill:
      return PresetCategory.Bill;
    case PresetCategory.TaxDocument:
      return PresetCategory.TaxDocument;
    case PresetCategory.BankStatement:
      return PresetCategory.BankStatement;
    default:
      return PresetCategory.Auto;
  }
}

export async function analyzeDocumentAndSuggestNames(
  openai: OpenAI,
  filePath: string,
  fileContent: string,
  contentType: string,
  documentType: string,
  model: string,
): Promise<{ fields: DocumentFields; suggestions: NameSuggestion[]; pattern: string }> {
  try {
    debugLog("Analyzing document and generating filename suggestions");

    let targetDocumentType = documentType;
    let pattern = "";

    // Two-step flow for Auto mode
    if (documentType === "auto" || documentType === PresetCategory.Auto) {
      // Step 1: Classify the document
      await showToast({
        style: Toast.Style.Animated,
        title: "Auto Mode",
        message: "Classifying document type...",
      });

      const classifiedType = await classifyDocument(openai, fileContent, contentType, model);
      targetDocumentType = mapToPresetCategory(classifiedType);
      const categoryDisplayName = getCategoryName(targetDocumentType as PresetCategory);

      debugLog(
        `Auto mode: classified as '${classifiedType}', using category '${targetDocumentType}'`,
      );

      // Show what type was detected
      await showToast({
        style: Toast.Style.Animated,
        title: `Detected: ${categoryDisplayName}`,
        message: "Generating suggestions...",
      });
    }

    // Get the pattern for the target document type
    pattern =
      DEFAULT_PATTERNS[targetDocumentType as PresetCategory] ||
      DEFAULT_PATTERNS[PresetCategory.Auto];

    // Use the unified generatePrompt function with pattern history
    const promptConfig = await generatePromptWithHistory(targetDocumentType as PresetCategory);
    const systemPrompt = promptConfig.systemPrompt;
    const userPrompt = promptConfig.userPrompt;

    debugLog("Step 2: Generating filename suggestions", {
      model,
      contentType,
      targetDocumentType,
      pattern,
    });

    debugLog("OpenAI prompt for analysis:", {
      targetDocumentType,
      systemPrompt,
      userPrompt,
    });

    // Get display name for the document type
    const documentTypeDisplayName = getCategoryName(targetDocumentType as PresetCategory);

    // Show loading toast with document type
    await showToast({
      style: Toast.Style.Animated,
      title: `Analyzing ${documentTypeDisplayName}`,
      message: "Generating filename suggestions...",
    });

    // Step 2: Generate filename suggestions using Responses API
    // Build input content based on content type
    const isImage = isImageContentType(contentType);
    const suggestionInputContent: Array<
      | { type: "input_text"; text: string }
      | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" }
    > = [{ type: "input_text" as const, text: userPrompt }];

    // Only add image input for actual images
    if (isImage) {
      suggestionInputContent.push({
        type: "input_image" as const,
        image_url: `data:${contentType};base64,${fileContent}`,
        detail: "auto" as const,
      });
    } else {
      // For text content, append it to the prompt
      suggestionInputContent[0] = {
        type: "input_text" as const,
        text: `${userPrompt}\n\nDocument content:\n${fileContent}`,
      };
    }

    const suggestionBaseParams = {
      model: model,
      instructions: systemPrompt,
      input: [
        {
          role: "user" as const,
          content: suggestionInputContent,
        },
      ],
      temperature: 0.3,
      max_output_tokens: 1500,
    };

    // Add reasoning parameter for models that support it (GPT-5.x)
    const response = supportsReasoning(model)
      ? await openai.responses.create({ ...suggestionBaseParams, reasoning: { effort: "none" } })
      : await openai.responses.create(suggestionBaseParams);

    const output = response.output_text;
    debugLog("Filename suggestions response:", output);

    if (!output) {
      await showFailureToast(new Error("No response from model"));
      return { fields: {}, suggestions: [], pattern };
    }

    try {
      const parsed = JSON.parse(output);
      let suggestions: string[] = [];
      let fields: DocumentFields = {};

      if (Array.isArray(parsed)) {
        // Model returned just the suggestions array
        suggestions = parsed.filter(
          (s: unknown): s is string => typeof s === "string" && s.length > 0,
        );
      } else if (parsed && Array.isArray(parsed.suggestions)) {
        // Model returned the expected object
        suggestions = parsed.suggestions.filter(
          (s: unknown): s is string => typeof s === "string" && s.length > 0,
        );
        fields = parsed.fields || {};
      }

      if (suggestions.length === 0) {
        debugLog("No valid suggestions found in response");
        await showFailureToast(new Error("No valid suggestions generated"));
        return { fields: {}, suggestions: [], pattern };
      }

      const fileExtension = path.extname(filePath);
      const nameSuggestions = suggestions.map((name: string, index: number) => ({
        id: `${Date.now()}-${index}`,
        name,
        extension: fileExtension,
        originalPath: filePath,
        originalName: "",
        rank: index + 1,
        pattern: pattern,
        documentType: targetDocumentType,
      }));

      // Show success toast with document type
      await showToast({
        style: Toast.Style.Success,
        title: `${documentTypeDisplayName} Analyzed`,
        message: `${nameSuggestions.length} suggestions generated`,
      });

      return { fields, suggestions: nameSuggestions, pattern };
    } catch (error) {
      debugLog("Error parsing analysis response:", error);
      await showFailureToast(new Error("Invalid response format"));
      return { fields: {}, suggestions: [], pattern };
    }
  } catch (error) {
    if (error instanceof Error) {
      await showFailureToast(error);
    } else {
      await showFailureToast(new Error("Could not analyze document"));
    }
    return { fields: {}, suggestions: [], pattern: "" };
  }
}
