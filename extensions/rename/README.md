# Rename

Rename is a Raycast extension that uses AI to intelligently rename files based on their content. It's perfect for organizing documents, photos, and other files with descriptive, content-based names.

## Features

- Generate smart name suggestions for files based on their content
- Works with PDFs, images, text files, and Office documents
- Select files directly in Finder and access through Raycast
- Instantly rename files with a single click
- Customize naming patterns for different document types
- Automatically fetches available OpenAI models for your account
- Improved error handling with clear feedback
- Support for folder content analysis and renaming

## Requirements

- An OpenAI API key
- Files must be selected in Finder before invoking the extension

## How to Use

1. Select one or more files in Finder
2. Open Raycast (default: ⌘+Space)
3. Type "Rename" and press Enter
4. If it's your first time, enter your OpenAI API key in the preferences
5. The extension will analyze your files and provide name suggestions
6. Select a suggestion and press Enter to rename the file

## Model Selection

The extension automatically fetches all available models from your OpenAI account when you first enter your API key. It selects the best model by default (usually the most capable one), but you can change it in preferences to any model available to your account.

The extension will work with:
- GPT-4 models (gpt-4, gpt-4o, gpt-4-turbo, etc.)
- GPT-3.5 models (gpt-3.5-turbo, etc.)
- Vision-capable models for processing images and PDFs

## Customizing Naming Patterns

You can customize how files are named by editing the preferences. For each document type, you can:

1. Change the order of tokens
2. Include or exclude specific tokens
3. Customize date formats
4. Change separators between components

### Available Tokens

#### Receipts
- `{Date}` - Date of purchase
- `{Merchant}` - Name of the merchant or store
- `{Items}` - Main items or purpose of purchase
- `{Amount}` - Total amount of the purchase

#### Bills
- `{Date}` - Due date or bill date
- `{Service Provider}` - Name of the service provider or utility company
- `{Account Number}` - Last 4 digits of the account number
- `{Amount}` - Total amount due
- `{Period}` - Billing period

#### Tax Documents
- `{Form Type}` - Tax form type or number (e.g., Form W-2, 1099-INT)
- `{Institution}` - Name of the institution, employer, or source
- `{Account Holder}` - Name of the account holder or taxpayer
- `{Date}` - Statement date
- `{Tax Year}` - Tax year for the form, like 2024
- `{Description}` - Additional description or account type

#### Bank Statements
- `{Bank Name}` - Name of the financial institution
- `{Account Type}` - Type of account (e.g., Checking, Savings)
- `{Last 4 Digits}` - Last 4 digits of the account number
- `{Date}` - Statement period

#### Folders
- `{Content Type}` - Type of content contained in the folder
- `{Date}` - Year or date relevant to the folder contents
- `{Subject}` - Subject or category of the folder
- `{Project}` - Project name if applicable

### Date Format Customization

You can customize date formats using the syntax: `{Date:FORMAT}` where FORMAT is one of:

- `YYYY-MM-DD` - Full date (e.g., 2023-12-31)
- `YYYY-MM` - Year and month (e.g., 2023-12)
- `YYYY` - Year only (e.g., 2023)
- `MM-DD` - Month and day (e.g., 12-31)
- `MMMM YYYY` - Month name and year (e.g., December 2023)
- `MMM YYYY` - Short month name and year (e.g., Dec 2023)
- `MMMM DD, YYYY` - Month name, day, and year (e.g., December 31, 2023)
- `MMM DD, YYYY` - Short month, day, and year (e.g., Dec 31, 2023)
- `DD MMM YYYY` - Day, short month, and year (e.g., 31 Dec 2023)

### Examples

**Default Receipt Pattern:**
```
{Date:YYYY-MM-DD} - {Merchant} - {Items} - {Amount}
```

**Default Bill Pattern:**
```
{Date:YYYY-MM} - {Service Provider} - {Account Number} - {Amount}
```

**Default Tax Document Pattern:**
```
{Form Type} - {Institution} - {Account Holder} - {Date:YYYY}
```

**Default Bank Statement Pattern:**
```
{Bank Name} - {Account Type} - {Last 4 Digits} - {Date:YYYY-MM}
```

**Default Folder Pattern:**
```
{Content Type} {Date:YYYY}
```

## Getting an OpenAI API Key

1. Go to [OpenAI's platform website](https://platform.openai.com/signup)
2. Create an account or sign in if you already have one
3. Navigate to the [API Keys section](https://platform.openai.com/api-keys)
4. Click on "Create new secret key"
5. Give your key a name (e.g., "Raycast Rename Extension")
6. Copy the API key (Note: You won't be able to see it again after closing)

## Adding Your API Key to Raycast

1. Open Raycast preferences
2. Go to Extensions
3. Find "Rename" in your list of extensions
4. Click on the extension and paste your API key in the "OpenAI API Key" field

## Error Handling

The extension provides clear feedback when errors occur:

- API key issues
- File processing errors
- Model response errors
- File access permission errors
- Invalid file format errors

Each error is displayed with a descriptive message to help you understand and resolve the issue.

## Important Notes

- Your API key is stored securely in Raycast
- Using the OpenAI API will incur charges based on your usage
- Current OpenAI pricing (as of 2024):
  - GPT-4.1: $5.00/$15.00 per million input/output tokens
  - GPT-4.1-mini: $0.50/$1.50 per million input/output tokens
  - GPT-4.1-nano: $0.15/$0.60 per million input/output tokens
- Cost estimate for each file analysis (2000 input tokens):
  - GPT-4.1: ~$0.01 per file
  - GPT-4.1-mini: ~$0.001 per file
  - GPT-4.1-nano: ~$0.0003 per file
- For the most up-to-date pricing, check [OpenAI's pricing page](https://openai.com/api/pricing/)

## Recent Updates

- Improved error handling with clear feedback messages
- Added support for Office documents (Word, Excel, PowerPoint)
- Enhanced folder content analysis
- Optimized file processing for better performance
- Updated to use Raycast's official toast utilities
- Added support for more date formats
- Improved handling of blank or invalid files 