import type { RenamePreset } from "./utils/presets";

export type { RenamePreset };

// Interface for user preferences
export interface Preferences {
  apiKey: string;
  model: string;
  receiptPattern?: string;
  billPattern?: string;
  taxDocumentPattern?: string;
  bankStatementPattern?: string;
  folderPattern?: string;
  [key: string]: string | undefined;
}

// Interface for OpenAI analysis requests
export interface OpenAIAnalysisRequest {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  fileContent: string;
  contentType: string;
  detail?: "high" | "low" | "auto";
  documentType?: string;
  patternInstructions?: boolean;
}

// JSON structure for document field extraction
export const DOCUMENT_FIELDS_STRUCTURE = {
  documentType: "string", // One of: receipt, bill, tax document, bank statement
  date: "string", // YYYY-MM-DD format, primary document date
  invoiceDate: "string", // YYYY-MM-DD format if found
  billingPeriod: "string", // date range if found
  provider: "string", // company or service provider name
  amount: "string", // total amount if found
  accountNumber: "string", // account number if found
  invoiceNumber: "string", // invoice or reference number if found
  merchantName: "string", // merchant name for receipts
  items: "string", // main items or purpose
  formType: "string", // tax form type if found
  taxYear: "string", // tax year if found
  institution: "string", // institution name if found
  bankName: "string", // bank name if found
  accountType: "string", // account type if found
  accountHolder: "string", // Full name of the account holder or participant
  debug: "string", // Explanation for missing or ambiguous fields
};

// Interface for extracted document fields
export interface ExtractedDocumentFields {
  documentType?: string;
  date?: string;
  invoiceDate?: string;
  billingPeriod?: string;
  provider?: string;
  amount?: string;
  accountNumber?: string;
  invoiceNumber?: string;
  merchantName?: string;
  items?: string;
  formType?: string;
  taxYear?: string;
  institution?: string;
  bankName?: string;
  accountType?: string;
  accountHolder?: string;
  debug?: string;
}

// Function to get required fields based on pattern tokens
export function getRequiredFields(pattern: string): Partial<typeof DOCUMENT_FIELDS_STRUCTURE> {
  const requiredFields: Partial<typeof DOCUMENT_FIELDS_STRUCTURE> = {
    documentType: "string", // Always required
  };

  // Extract tokens from pattern (e.g., {date}, {merchant}, etc.)
  const tokens = pattern.match(/\{([^}]+)\}/g) || [];

  // Map tokens to their corresponding fields
  tokens.forEach((token) => {
    const field = token.slice(1, -1).toLowerCase(); // Remove { and }
    switch (field) {
      case "date":
      case "year":
      case "date:yyyy":
        requiredFields.date = "string";
        requiredFields.taxYear = "string"; // For tax documents, year is also tax year
        break;
      case "merchant":
        requiredFields.merchantName = "string";
        break;
      case "provider":
        requiredFields.provider = "string";
        break;
      case "amount":
        requiredFields.amount = "string";
        break;
      case "account":
        requiredFields.accountNumber = "string";
        break;
      case "invoice":
        requiredFields.invoiceNumber = "string";
        break;
      case "items":
        requiredFields.items = "string";
        break;
      case "form":
      case "formname":
      case "form name":
        requiredFields.formType = "string";
        break;
      case "taxyear":
        requiredFields.taxYear = "string";
        break;
      case "institution":
        requiredFields.institution = "string";
        break;
      case "bank":
        requiredFields.bankName = "string";
        break;
      case "accounttype":
        requiredFields.accountType = "string";
        break;
      case "holder":
      case "accountholder":
      case "account holder":
        requiredFields.accountHolder = "string";
        break;
      case "description":
        // For tax documents, description might need institution and account holder
        requiredFields.institution = "string";
        requiredFields.accountHolder = "string";
        break;
    }
  });

  return requiredFields;
}

export interface NameSuggestion {
  id: string;
  name: string;
  extension: string;
  originalPath: string;
  originalName: string;
  rank: number;
  pattern?: string; // The pattern used to generate this suggestion
  documentType?: string; // The document type for this suggestion
}

export interface RenamePrompt {
  name: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature: number;
  maxTokens: number;
  patternInstructions?: boolean;
}

export interface SpecializedPrompts {
  [key: string]: {
    name: string;
    systemPrompt: string;
    userPrompt: string;
    model?: string;
    temperature: number;
    maxTokens: number;
    patternInstructions?: boolean;
  };
}

// Pattern storage interfaces
export interface StoredPattern {
  pattern: string;
  count: number;
  lastUsed: number; // timestamp
  documentType: string;
}

export interface PatternUsageData {
  [key: string]: StoredPattern; // key is the pattern string
}
