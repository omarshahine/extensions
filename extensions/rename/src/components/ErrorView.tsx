import React from "react";
import { Detail, ActionPanel, Action, open, openExtensionPreferences, Icon } from "@raycast/api";
import { debugLog } from "../utils/logging";
import { showToast } from "@raycast/api";

interface ErrorViewProps {
  error: string;
}

const ErrorView: React.FC<ErrorViewProps> = ({ error }) => {
  debugLog("Showing error detail:", error);

  const isApiKeyError = error.includes("API key");
  const isNoFilesError = error.includes("No files selected in Finder");
  const isFinderNotActiveError = error.includes("Finder isn't the frontmost application");

  // Choose appropriate content based on error type
  const title = isApiKeyError
    ? "OpenAI API Key Required"
    : isNoFilesError
      ? "No Files Selected"
      : isFinderNotActiveError
        ? "Finder Not Active"
        : "Error";

  const icon = isApiKeyError ? "🔑" : isNoFilesError ? "📁" : isFinderNotActiveError ? "⚠️" : "⚠️";

  let content = "";

  if (isApiKeyError) {
    content = `
To use this extension, you need an OpenAI API key:

1. **Get an API key**: Visit [OpenAI's API Keys page](https://platform.openai.com/api-keys)
2. **Create** a new secret key (name it "Raycast Rename")
3. **Copy** the key immediately (you won't see it again)
4. **Paste** it in your Raycast preferences for this extension

Click the "Open Extension Preferences" button below to configure your API key.`;
  } else if (isNoFilesError) {
    content = `
No files are currently selected in Finder. This extension needs selected files to suggest new names.

## How to select files:

1. **Go to Finder**
2. **Navigate** to the folder containing your files
3. **Select** one or more files by clicking on them
   - For multiple files, hold Cmd (⌘) while clicking
   - For adjacent files, select the first file then hold Shift and click the last file
4. **Keep the files selected** and return to Raycast
5. **Run the Rename extension** again

### Tips:
- Make sure Finder is the active application when you select files
- You can select different file types (documents, images, PDFs, etc.)
- The extension works best with text documents, PDFs, and images`;
  } else if (isFinderNotActiveError) {
    content = `
Finder must be the active application when you run this extension.

## Quick Fix:

1. **Click the "Open Finder" button** below
2. **Select the files** you want to rename
3. **Keep the files selected** and run this extension again

## Detailed Steps:

1. **Open Finder** (click the button below or press ⌘+Space and type "Finder")
2. **Navigate** to the folder containing your files
3. **Select** the file(s) you want to rename
4. **Keep Finder active** (don't click anywhere else)
5. **Press ⌘+Space** to open Raycast
6. **Type "Rename"** and press Enter

### Common Issues:
- If you click anywhere else after selecting files, Finder becomes inactive
- If you open Raycast before selecting files, Finder becomes inactive
- If you have multiple windows open, make sure Finder is in front

### Tips:
- Use keyboard shortcuts to stay efficient:
  - ⌘+Space to open Raycast
  - ⌘+Click to select multiple files
  - Shift+Click to select a range of files
- Keep Finder as the active application until you run the extension`;
  } else {
    content = error + "\n\nPlease try again with a different file.";
  }

  return (
    <Detail
      markdown={`# ${icon} ${title}\n\n${content}`}
      actions={
        <ActionPanel>
          {isApiKeyError && (
            <Action
              title="Open Openai Api Keys Page"
              onAction={() => open("https://platform.openai.com/api-keys")}
            />
          )}
          {(isNoFilesError || isFinderNotActiveError) && (
            <Action
              title="Open Finder"
              icon={Icon.Finder}
              onAction={() => open("file:///System/Library/CoreServices/Finder.app")}
            />
          )}
          <Action title="Open Extension Preferences" onAction={openExtensionPreferences} />
          <Action
            title="Copy to Clipboard"
            icon={Icon.Clipboard}
            onAction={() => {
              showToast({ title: "Copied to Clipboard", message: error });
            }}
          />
        </ActionPanel>
      }
    />
  );
};

export default ErrorView;
