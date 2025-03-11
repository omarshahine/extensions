# Claude Context for Rename Extension

This document provides context for AI assistants working on this Raycast extension.

## Project Overview

**Rename Files with AI** is a Raycast extension that uses OpenAI's Responses API to intelligently rename files based on their content. It analyzes documents (PDFs, images, Office files, text files) and folders to generate semantically meaningful filename suggestions.

### Key Features
- AI-powered filename generation from document content
- Support for PDFs, images, Office documents (.docx, .xlsx, .pptx), and text files
- Folder content analysis
- Customizable naming patterns with token-based templates
- Pattern history learning for user preferences
- Multiple preset categories: Receipt, Bill, Tax Document, Bank Statement, Folder, Auto
- **Two-step Auto mode**: Classifies document type first, then uses appropriate pattern

## Raycast Extension Development

This extension follows the [Raycast API](https://developers.raycast.com/llms.txt) best practices:

### Manifest (`package.json`)
- Schema: `https://www.raycast.com/schemas/extension.json`
- Commands are defined in the `commands` array with `name`, `title`, `description`, and `mode`
- Preferences are defined with `type`, `required`, `default`, and `data` for dropdowns
- Dependencies use `@raycast/api` (^1.103.0) and `@raycast/utils` (^1.14.0)

### UI Components Used
- **List**: Primary UI for displaying filename suggestions (`List`, `List.Item`, `List.Section`)
- **ActionPanel**: Actions for renaming files, opening preferences
- **Form**: Used in preset management
- **Toast**: Feedback for loading states and operations via `showToast` and `showFailureToast`

### Key Raycast APIs
```typescript
import {
  ActionPanel,
  Action,
  Icon,
  List,
  showToast,
  Toast,
  getPreferenceValues,
  getSelectedFinderItems,
  environment,
  popToRoot,
  openExtensionPreferences,
  closeMainWindow,
  LocalStorage,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
```

### Preferences Access
```typescript
const preferences = getPreferenceValues<Preferences>();
// Access: preferences.apiKey, preferences.model
```

### Local Storage
Used for persisting presets and pattern usage history:
```typescript
await LocalStorage.setItem(key, JSON.stringify(data));
const stored = await LocalStorage.getItem<string>(key);
```

### Error Handling Pattern
```typescript
try {
  // operation
} catch (error) {
  await showFailureToast(error instanceof Error ? error : new Error("message"));
}
```

## OpenAI Integration

### API Version
Uses the **OpenAI Responses API** (`openai.responses.create`) instead of Chat Completions API for cleaner code and better integration.

### Models Supported
The extension uses OpenAI's latest model families:

| Model | Value | Use Case |
|-------|-------|----------|
| **GPT-5.2** | `gpt-5.2` | Most capable (default) - supports reasoning |
| **GPT-5.2 Mini** | `gpt-5.2-mini` | Faster, cheaper - supports reasoning |
| **GPT-4.1** | `gpt-4.1` | Previous generation fallback |

### Reasoning Parameter
GPT-5.x models support the `reasoning` parameter for controlling response depth:
```typescript
// Only for GPT-5.x models
reasoning: { effort: "none" }  // Fast responses for file naming
```

The extension uses `effort: "none"` since deep reasoning isn't needed for document classification and naming.

### Vision API Usage (Responses API)
For images and PDFs (converted to images), the extension uses the vision capabilities:
```typescript
const response = await openai.responses.create({
  model: model,
  instructions: systemPrompt,
  input: [
    {
      role: "user",
      content: [
        { type: "input_text", text: userPrompt },
        {
          type: "input_image",
          image_url: `data:${contentType};base64,${fileContent}`,
          detail: "auto",
        },
      ],
    },
  ],
  temperature: 0.3,
  max_output_tokens: 1500,
  // reasoning: { effort: "none" }  // Only for GPT-5.x models
});

const output = response.output_text;
```

### Text-based Analysis (Responses API)
For text content (text files, extracted Office content):
```typescript
const response = await openai.responses.create({
  model: model,
  instructions: systemPrompt,
  input: [
    {
      role: "user",
      content: [{ type: "input_text", text: userPrompt + "\n\nContent:\n" + fileContent }],
    },
  ],
  temperature: 0.3,
  max_output_tokens: 1500,
});

const output = response.output_text;
```

### Response Format
The AI returns JSON with filename suggestions:
```json
{
  "fields": { "documentType": "...", "date": "...", ... },
  "suggestions": ["filename1", "filename2", ...],
  "debug": "explanation of any issues"
}
```

### Two-Step Auto Mode Flow
When in Auto mode, the extension uses a two-step process:

1. **Step 1: Classification** - A lightweight call to classify the document type:
   - Returns one of: `receipt`, `bill`, `taxDocument`, `bankStatement`, `generic`
   
2. **Step 2: Name Generation** - Uses the classified type to select the appropriate pattern and generates filename suggestions

This ensures the correct naming pattern is used even when the user selects "Auto".

## Code Architecture

### Directory Structure
```
src/
├── rename.tsx           # Main command entry point
├── managePresets.tsx    # Preset management command
├── types.ts             # TypeScript interfaces and types
├── constants.ts         # DEBUG flag, prompt configuration
├── prompts.ts           # AI prompt generation logic
├── components/
│   ├── DocumentTypeSelector.tsx  # Category selection UI
│   ├── ErrorView.tsx             # Error display component
│   ├── PresetManager.tsx         # Preset CRUD UI
│   └── PresetSelector.tsx        # Preset picker UI
└── utils/
    ├── documentProcessing.ts    # Core AI analysis logic (two-step flow)
    ├── fileProcessing.ts        # File type handlers
    ├── logging.ts               # Debug logging utility
    ├── openai.ts                # OpenAI Responses API wrapper
    ├── patternStorage.ts        # Pattern history persistence
    ├── patternUtils.ts          # Pattern token utilities
    └── presets.ts               # Preset CRUD operations
```

### Key Types
```typescript
// User preferences from package.json
interface Preferences {
  apiKey: string;
  model: string;  // "gpt-5.2" | "gpt-5.2-mini" | "gpt-4.1"
}

// Filename suggestion
interface NameSuggestion {
  id: string;
  name: string;
  extension: string;
  originalPath: string;
  originalName: string;
  rank: number;
  pattern?: string;
  documentType?: string;
}

// Preset categories
enum PresetCategory {
  Auto = "auto",
  Receipt = "receipt",
  Bill = "bill",
  TaxDocument = "taxDocument",
  BankStatement = "bankStatement",
  Folder = "folder",
}
```

### Naming Pattern Tokens
Patterns use `{token}` syntax with optional date formats:

**Receipt**: `{Merchant} - {Date:YYYY-MM} - {Amount}`
**Bill**: `{Provider} - {Date:YYYY-MM} - {Amount}`
**Tax Document**: `{Form Name} - {Description} - {Account Holder} - {Institution} - {Tax Year}`
**Bank Statement**: `{Bank} - {Account Type} - {Date:YYYY-MM}`
**Folder**: `{Content Type} {Date:YYYY}`

### File Processing Flow
1. `getSelectedFinderItems()` → Get Finder selection
2. Detect file type by extension
3. Process content:
   - PDF → Convert to image, send to Vision API
   - Image → Base64 encode, send to Vision API
   - Office → Extract text with mammoth/xlsx, send as text
   - Text → Read content, send as text
   - Folder → Analyze contents, send summary
4. **Auto mode**: Classify document type first (Step 1)
5. Generate prompt with category-specific instructions
6. Call Responses API with appropriate pattern (Step 2)
7. Parse JSON response, create `NameSuggestion[]`
8. Display in List UI
9. On selection, rename file with `fs.rename()`

## Development Commands
```bash
npm run dev      # Start development mode
npm run build    # Build for production
npm run lint     # Run ESLint
npm run fix-lint # Fix linting issues
```

## Debugging
Set `DEBUG = true` in `src/constants.ts` to enable verbose logging via `debugLog()`.

## Dependencies
- **openai** (^6.10.0) - OpenAI API client (Responses API)
- **fs-extra** (^11.3.0) - Enhanced file system operations
- **mammoth** (^1.9.0) - Word document text extraction
- **xlsx** (^0.18.5) - Excel file processing
- **image-size** (^2.0.1) - Image dimension detection

## References
- [Raycast API Documentation](https://developers.raycast.com/)
- [Raycast Extension Best Practices](https://developers.raycast.com/information/best-practices.md)
- [Raycast List Component](https://developers.raycast.com/api-reference/user-interface/list.md)
- [Raycast Form Component](https://developers.raycast.com/api-reference/user-interface/form.md)
- [Raycast Storage API](https://developers.raycast.com/api-reference/storage.md)
- [Raycast Toast/Feedback](https://developers.raycast.com/api-reference/feedback/toast.md)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
- [OpenAI Vision Guide](https://platform.openai.com/docs/guides/vision)
- [OpenAI Models](https://platform.openai.com/docs/models)
