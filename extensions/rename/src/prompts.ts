// (File cleaned up: all unused static prompt constants and templates removed)
// If you need prompt templates in the future, add them here.

import { PresetCategory, DEFAULT_PATTERNS, getCategoryName } from "./utils/presets";
import { DOCUMENT_FIELDS_STRUCTURE, getRequiredFields, StoredPattern } from "./types";
import { getMostUsedPatterns, getPatternsForDocumentType } from "./utils/patternStorage";

// Minimal system prompts that only define the role and core behavior
export const STANDARD_SYSTEM_PROMPT = `You are a document analysis and file naming assistant. You always respond with valid JSON.`;

export const FOLDER_SYSTEM_PROMPT = `You are a folder naming assistant. You always respond with valid JSON.`;

// Function to format an example based on pattern and values
export function formatExample(pattern: string, values: Record<string, string>): string {
  let result = pattern;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`{${key}[^}]*}`, "i"), value);
  }
  return result;
}

// Unified prompt generator that handles both auto and specific document types
export function generatePrompt(category?: PresetCategory, recentPatterns?: StoredPattern[]) {
  const isAuto = !category || category === PresetCategory.Auto;
  const isFolder = category === PresetCategory.Folder;

  // Get category names for auto mode
  const receiptName = getCategoryName(PresetCategory.Receipt).toLowerCase();
  const billName = getCategoryName(PresetCategory.Bill).toLowerCase();
  const taxDocName = getCategoryName(PresetCategory.TaxDocument).toLowerCase();
  const bankStatementName = getCategoryName(PresetCategory.BankStatement).toLowerCase();
  const folderName = getCategoryName(PresetCategory.Folder).toLowerCase();
  const genericName = "generic";

  // Get pattern and required fields for specific category
  const pattern = category ? DEFAULT_PATTERNS[category] : "";
  const requiredFields = category ? getRequiredFields(pattern) : {};

  let requiredElements = "";
  let exampleValues = {};
  let securityNote = "";

  // Set category-specific requirements and examples
  if (category) {
    switch (category) {
      case PresetCategory.Receipt:
        requiredElements = "Date and merchant are required elements.";
        exampleValues = {
          date: "2023-06-15",
          merchant: "Target",
          items: "Groceries",
          amount: "45.67",
        };
        break;
      case PresetCategory.Bill:
        requiredElements = "Date and provider are required elements.";
        securityNote = "Use only the last 4 digits of account numbers for security.";
        exampleValues = {
          date: "2025-05",
          serviceProvider: "Electric Company",
          accountNumber: "1234",
          amount: "89.99",
        };
        break;
      case PresetCategory.TaxDocument:
        requiredElements = "Form type and tax year are required elements.";
        exampleValues = {
          formType: "W-2",
          institution: "Acme Corp",
          accountHolder: "John Doe",
          date: "2023",
        };
        break;
      case PresetCategory.BankStatement:
        requiredElements = "Bank name and account type are required elements.";
        securityNote = "Use only the last 4 digits of account numbers for security.";
        exampleValues = {
          bankName: "Chase",
          accountType: "Checking",
          last4Digits: "1234",
          date: "2023-04",
        };
        break;
      case PresetCategory.Folder:
        requiredElements = "Content type and date are required elements.";
        exampleValues = { contentType: "Photos", date: "2023" };
        break;
    }
  }

  // Generate example for specific category
  let example = "";
  if (Object.keys(exampleValues).length > 0) {
    example = `\nFor example, if the pattern is "${pattern}" and you extract ${Object.entries(
      exampleValues,
    )
      .map(([key, value]) => `${key}="${value}"`)
      .join(", ")}, the filename would be "${formatExample(pattern, exampleValues)}"`;
  }

  // Add pattern history context if available
  let patternHistoryContext = "";
  if (recentPatterns && recentPatterns.length > 0) {
    const relevantPatterns = category
      ? recentPatterns.filter((p) => p.documentType === category)
      : recentPatterns;

    if (relevantPatterns.length > 0) {
      const patternList = relevantPatterns
        .slice(0, 5) // Top 5 patterns
        .map((p) => `"${p.pattern}" (used ${p.count} time${p.count > 1 ? "s" : ""})`)
        .join(", ");

      patternHistoryContext = `\n\nBased on your previous choices, you frequently use these patterns: ${patternList}. Please prioritize suggestions that follow these familiar pattern structures.`;
    }
  }

  // Build the user prompt based on mode
  let userPrompt = isAuto
    ? `You MUST:
1. Determine which category this document best fits: ${receiptName}, ${billName}, ${taxDocName}, ${bankStatementName}, ${folderName}, or ${genericName}
2. Extract key information based on the category
3. Create ten filename suggestions using the appropriate pattern for that category:
   - ${getCategoryName(PresetCategory.Receipt)}: "${DEFAULT_PATTERNS[PresetCategory.Receipt]}"
   - ${getCategoryName(PresetCategory.Bill)}: "${DEFAULT_PATTERNS[PresetCategory.Bill]}"
   - ${getCategoryName(PresetCategory.TaxDocument)}: "${DEFAULT_PATTERNS[PresetCategory.TaxDocument]}"
   - ${getCategoryName(PresetCategory.BankStatement)}: "${DEFAULT_PATTERNS[PresetCategory.BankStatement]}"
   - ${getCategoryName(PresetCategory.Folder)}: "${DEFAULT_PATTERNS[PresetCategory.Folder]}"
   - Generic: "${DEFAULT_PATTERNS[PresetCategory.Auto]}"

Rules:
- Only use the folder pattern if the document explicitly indicates it's meant to be a folder
- Replace tokens in {curly braces} with extracted values
- If uncertain, provide a mix of suggestions using different patterns, ranked by relevance
- Never guess or hallucinate information
- Never use the filename as a source of information
- Include a "debug" field explaining any missing or ambiguous fields${patternHistoryContext}

Respond with only a JSON array of strings.`
    : isFolder
      ? `Analyze this folder and extract information relevant for naming.\n\nCreate ten folder name suggestions using this pattern:\n"${pattern}"${patternHistoryContext}\n\nRespond with only a JSON array of strings.`
      : `You MUST:
1. Extract ONLY these fields from the document:
${JSON.stringify(requiredFields, null, 2)}

2. Generate 10 filename suggestions using this pattern:
"${pattern}"

3. Return a single RFC 8259–compliant JSON object with two keys: "fields" and "suggestions"

4. Follow these rules:
- Use the "Invoice Date" (e.g., 2025-05-02) as the date for naming. If not present, use the first date in the billing period (e.g., 2025-04-01)
- Ignore contract terms, unrelated years, and the filename
- Replace tokens in {curly braces} with values extracted from the document
- Never guess or hallucinate information. If a field is missing, use an empty string
- Never use the filename as a source of information
- Include a "debug" field explaining any missing or ambiguous fields
${requiredElements} ${securityNote}${example}

Return a single JSON object like this:
{
  "fields": { ...extracted fields... },
  "suggestions": [ "filename 1", "filename 2", ... ],
  "debug": "explanation of any missing or ambiguous fields"
}${patternHistoryContext}`;

  // Add category-specific instructions
  if (category === PresetCategory.TaxDocument) {
    userPrompt += `

For tax documents:
- Extract the institution name from anywhere you detect it.
- Extract the account holder's name from the address block or anywhere you detect a name
- Never invent or guess a name. If not found, set to an empty string or 'Unknown'
- Look for the tax year in the document and populate taxYear field.
- Normalize the extracted fields as follows:
    - For "institution", use these aliases:
        - If it contains a long legal name for a brokerage or financial institution, set value to a short, common name (e.g., "Example Brokerage")
        - (Add other mappings as needed)
    - For "accountHolder":
        - Only output the first and last name (omit any middle names)
        - Capitalize names properly (e.g., "JANE MARIE DOE" → "Jane Doe")

Example:
"fields": {
  "documentType": "taxDocument",
  "formType": "Form 5498",
  "institution": "Example Brokerage",
  "accountHolder": "Jane Doe",
  "date": "2025-05-09",
  "taxYear": "2024"
}`;
  }

  return {
    name: isAuto ? "Auto" : getCategoryName(category),
    systemPrompt: isFolder ? FOLDER_SYSTEM_PROMPT : STANDARD_SYSTEM_PROMPT,
    userPrompt,
    patternInstructions: true,
  };
}

// Async version that includes pattern history
export async function generatePromptWithHistory(category?: PresetCategory) {
  try {
    const recentPatterns = category
      ? await getPatternsForDocumentType(category, 5)
      : await getMostUsedPatterns(10);

    return generatePrompt(category, recentPatterns);
  } catch (error) {
    // Fallback to regular prompt if pattern history fails
    return generatePrompt(category);
  }
}

// Update DOCUMENT_PROMPTS to use the unified generatePrompt function
export const DOCUMENT_PROMPTS = {
  auto: generatePrompt(),
  autoRename: {
    name: "Auto Rename",
    systemPrompt: STANDARD_SYSTEM_PROMPT,
    userPrompt: `You MUST:
1. Extract key information from this document
2. Return a single RFC 8259–compliant JSON object with this EXACT structure:
${JSON.stringify(DOCUMENT_FIELDS_STRUCTURE, null, 2)}

Rules:
- Only include fields you're confident about
- Pay special attention to dates and their formats
- Never guess or hallucinate information
- Never use the filename as a source of information
- Include a "debug" field explaining any missing or ambiguous fields`,
    patternInstructions: true,
  },
  folder: generatePrompt(PresetCategory.Folder),
  receipt: generatePrompt(PresetCategory.Receipt),
  bill: generatePrompt(PresetCategory.Bill),
  taxDocument: generatePrompt(PresetCategory.TaxDocument),
  bankStatement: generatePrompt(PresetCategory.BankStatement),
};

// Default prompt configuration without model specification
// The actual model will be determined at runtime from user preferences
export const PROMPT_CONFIG = {
  temperature: 0.3, // Lower temperature for more deterministic responses
  maxTokens: 500,
};
