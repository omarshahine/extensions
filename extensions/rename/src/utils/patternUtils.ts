import { Preferences } from "../types";
import { debugLog } from "./logging";

// Define document type token definitions
export const TOKEN_DEFINITIONS = {
  receipt: {
    "{Date}": "Date of purchase",
    "{Merchant}": "Name of the merchant or store",
    "{Items}": "Main items or purpose of purchase",
    "{Amount}": "Total amount of the purchase",
  },
  bill: {
    "{Date}": "Due date or bill date",
    "{Service Provider}": "Name of the service provider or utility company",
    "{Account Number}": "Last 4 digits of the account number",
    "{Amount}": "Total amount due",
    "{Period}": "Billing period",
  },
  taxDocument: {
    "{Form Type}": "Tax form type or number (e.g., Form W-2, 1099-INT)",
    "{Institution}": "Name of the institution, employer, or source",
    "{Account Holder}": "Name of the account holder or taxpayer",
    "{Date}": "Statement date",
    "{Tax Year}": "Tax year for the form, like 2024",
    "{Description}": "Additional description or account type",
  },
  bankStatement: {
    "{Bank Name}": "Name of the financial institution",
    "{Account Type}": "Type of account (e.g., Checking, Savings)",
    "{Last 4 Digits}": "Last 4 digits of the account number",
    "{Date}": "Statement period",
  },
  folder: {
    "{Content Type}": "Type of content contained in the folder",
    "{Date}": "Year or date relevant to the folder contents",
    "{Subject}": "Subject or category of the folder",
    "{Project}": "Project name if applicable",
  },
};

// Get tokens available for a document type
export function getAvailableTokens(documentType: string): Record<string, string> {
  return TOKEN_DEFINITIONS[documentType as keyof typeof TOKEN_DEFINITIONS] || {};
}

// Define supported date formats with examples
export const DATE_FORMATS = {
  "YYYY-MM-DD": "Full date (e.g., 2023-12-31)",
  "YYYY-MM": "Year and month (e.g., 2023-12)",
  YYYY: "Year only (e.g., 2023)",
  "MM-DD": "Month and day (e.g., 12-31)",
  "MMMM YYYY": "Month name and year (e.g., December 2023)",
  "MMM YYYY": "Short month name and year (e.g., Dec 2023)",
  "MMMM DD, YYYY": "Month name, day, and year (e.g., December 31, 2023)",
  "MMM DD, YYYY": "Short month, day, and year (e.g., Dec 31, 2023)",
  "DD MMM YYYY": "Day, short month, and year (e.g., 31 Dec 2023)",
};

// Get default date format for a document type
export function getDefaultDateFormat(documentType: string): string {
  switch (documentType) {
    case "receipt":
    case "bill":
      return "YYYY-MM-DD";
    case "taxDocument":
      return "YYYY";
    case "bankStatement":
      return "YYYY-MM";
    case "folder":
      return "YYYY";
    default:
      return "YYYY-MM-DD";
  }
}

// Get default pattern for a document type
export function getDefaultPattern(documentType: string): string {
  const defaultDateFormat = getDefaultDateFormat(documentType);

  switch (documentType) {
    case "receipt":
      return `{Date:${defaultDateFormat}} - {Merchant} - {Items} - {Amount}`;
    case "bill":
      return `{Date:${defaultDateFormat}} - {Service Provider} - {Account Number} - {Amount}`;
    case "taxDocument":
      return `{Form Type} - {Institution} - {Account Holder} - {Date:${defaultDateFormat}}`;
    case "bankStatement":
      return `{Bank Name} - {Account Type} - {Last 4 Digits} - {Date:${defaultDateFormat}}`;
    case "folder":
      return `{Content Type} {Date:${defaultDateFormat}}`;
    default:
      return "";
  }
}

// Get user's preferred pattern or default
export function getPattern(preferences: Preferences, documentType: string): string {
  let pattern = "";

  switch (documentType) {
    case "receipt":
      pattern = preferences.receiptPattern || getDefaultPattern("receipt");
      break;
    case "bill":
      pattern = preferences.billPattern || getDefaultPattern("bill");
      break;
    case "taxDocument":
      pattern = preferences.taxDocumentPattern || getDefaultPattern("taxDocument");
      break;
    case "bankStatement":
      pattern = preferences.bankStatementPattern || getDefaultPattern("bankStatement");
      break;
    case "folder":
      pattern = preferences.folderPattern || getDefaultPattern("folder");
      break;
    default:
      pattern = "";
  }

  debugLog(`Pattern for ${documentType}: ${pattern}`);
  return pattern;
}

// Extract date formats from a pattern
export function extractDateFormats(pattern: string, documentType: string): Record<string, string> {
  const dateFormats: Record<string, string> = {};

  // First look for {Date:FORMAT} tokens
  const dateFormatRegex = /{Date:([^}]+)}/g;
  let match;

  while ((match = dateFormatRegex.exec(pattern)) !== null) {
    const format = match[1];
    dateFormats[match[0]] = format;
  }

  // Then check for plain {Date} token and assign default format
  if (pattern.includes("{Date}")) {
    dateFormats["{Date}"] = getDefaultDateFormat(documentType);
  }

  return dateFormats;
}

// Generate a prompt modification based on the user's pattern
export function generatePatternPrompt(preferences: Preferences, documentType: string): string {
  debugLog(`Generating pattern prompt for document type: ${documentType}`);
  const pattern = getPattern(preferences, documentType);
  const availableTokens = getAvailableTokens(documentType);
  const dateFormats = extractDateFormats(pattern, documentType);

  debugLog(`Available tokens for ${documentType}:`, JSON.stringify(availableTokens));
  debugLog(`Date formats extracted:`, JSON.stringify(dateFormats));

  let tokenExplanations = "Use the following naming pattern:";
  tokenExplanations += `\n\n${pattern}\n\n`;
  tokenExplanations += "Where:\n";

  // Add explanations for non-date tokens used in the pattern
  Object.entries(availableTokens).forEach(([token, description]) => {
    // Skip date tokens as they'll be handled separately
    if (token !== "{Date}" && pattern.includes(token)) {
      tokenExplanations += `- ${token} represents ${description}\n`;
    }
  });

  // Add explanations for date formats
  Object.entries(dateFormats).forEach(([token, format]) => {
    // Get description from DATE_FORMATS or create a generic one
    const formatDescription =
      (DATE_FORMATS as Record<string, string>)[format] || `custom date format "${format}"`;
    const baseDescription = availableTokens["{Date}"] || "date";
    tokenExplanations += `- ${token} represents ${baseDescription} in ${format} format ${formatDescription}\n`;
  });

  return tokenExplanations;
}
