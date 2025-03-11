import React from "react";
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
import { useState, useEffect, useMemo } from "react";
import OpenAI from "openai";
import fs from "fs-extra";
import path from "path";

// Import types and constants
import { NameSuggestion, Preferences, RenamePreset, OpenAIAnalysisRequest } from "./types";
import { DEBUG, SPECIALIZED_PROMPTS } from "./constants";
import { PROMPT_CONFIG } from "./prompts";
import { getDefaultPresetForCategory, PresetCategory } from "./utils/presets";

// Import utilities
import { debugLog } from "./utils/logging";
import {
  processPdfFile,
  processImageFile,
  processTextFile,
  processOfficeFile,
  processFolderContents,
} from "./utils/fileProcessing";
import { analyzeDocumentAndSuggestNames } from "./utils/documentProcessing";
import { recordPatternUsage, debugLogAllPatterns, clearPatternData } from "./utils/patternStorage";

// Import components
import ErrorView from "./components/ErrorView";
import DocumentTypeSelector from "./components/DocumentTypeSelector";

interface FinderItem {
  path: string;
  name: string;
}

// ==========================================
// Main Component
// ==========================================

export default function Command() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<NameSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<FinderItem[]>([]);
  const [isFolder, setIsFolder] = useState<boolean>(false);
  const [searchText, setSearchText] = useState("");
  const preferences = getPreferenceValues<Preferences>();

  // Filter suggestions based on search text - moved up before any conditional returns
  const filteredSuggestions = useMemo(() => {
    if (!searchText) return suggestions;
    return suggestions.filter(
      (suggestion) =>
        suggestion.name && suggestion.name.toLowerCase().includes(searchText.toLowerCase()),
    );
  }, [suggestions, searchText]);

  // Display environment info for debugging
  useEffect(() => {
    if (DEBUG) {
      debugLog("Environment:", {
        raycastVersion: environment.raycastVersion,
        macOSVersion: environment.launchType,
        isDev: environment.isDevelopment,
      });
    }
  }, []);

  // Check for API key and get selected files on initial load
  useEffect(() => {
    async function initialize() {
      try {
        debugLog("Starting initialization");

        // Check if API key exists in preferences
        let apiKey = preferences.apiKey;

        // If no API key in preferences, check local storage
        if (!apiKey) {
          apiKey = (await LocalStorage.getItem<string>("openai_api_key")) || "";
        }

        if (!apiKey) {
          debugLog("No API key found in preferences or local storage");
          setError(
            "OpenAI API key required. You need to provide an API key to use this extension.",
          );
          setIsLoading(false);
          return;
        }

        debugLog("API key found:", apiKey.substring(0, 4) + "...");

        // Get selected files
        try {
          const items = await getSelectedFinderItems();

          if (items.length === 0) {
            setError("Please select one or more files in Finder before running this command.");
            setIsLoading(false);
            return;
          }

          // Limit to only one item selected
          if (items.length > 1) {
            setError("Please select only one file or folder in Finder at a time.");
            setIsLoading(false);
            return;
          }

          debugLog("Selected items count:", items.length);
          const finderItems = items.map((item) => ({
            path: item.path,
            name: path.basename(item.path),
          }));
          setSelectedItems(finderItems);

          // Check if any selected item is a folder
          let hasFolder = false;
          for (const item of finderItems) {
            try {
              const stats = await fs.stat(item.path);
              if (stats.isDirectory()) {
                hasFolder = true;
                break;
              }
            } catch (statError) {
              debugLog("Error checking if item is a folder:", statError);
            }
          }
          setIsFolder(hasFolder);

          setIsLoading(false);
        } catch (selectionError) {
          debugLog("Error getting selected items:", selectionError);
          const errorMessage =
            selectionError instanceof Error ? selectionError.message : "Unknown error";

          // Make error message more user-friendly
          if (errorMessage.includes("Finder isn't the frontmost application")) {
            setError("Please select one or more files in Finder before running this command.");
          } else {
            setError(`Error getting selected files: ${errorMessage}`);
          }
          setIsLoading(false);
        }
      } catch (error) {
        debugLog("Initialization error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        setError(`Initialization error: ${errorMessage}`);
        setIsLoading(false);
      }
    }

    // Wrap the initialization in a try-catch to catch any unexpected errors
    try {
      initialize();
    } catch (unhandledError) {
      debugLog("Unhandled error during initialization:", unhandledError);
      setError(
        `Unhandled error: ${unhandledError instanceof Error ? unhandledError.message : "Unknown error"}`,
      );
      setIsLoading(false);
    }
  }, []);

  // Handle document type selection and fetch suggestions
  const handleDocumentTypeSelection = async (documentType: string, preset?: RenamePreset) => {
    setSelectedDocumentType(documentType);
    debugLog(`Selected document type: ${documentType}`);
    await fetchNameSuggestions(documentType, preset);
  };

  async function fetchNameSuggestions(documentType: string, preset?: RenamePreset) {
    try {
      setIsProcessing(true);
      debugLog(`Starting fetchNameSuggestions with document type: ${documentType}`);

      // Map PresetCategory enum to corresponding prompt key if needed
      const promptKey = documentType;

      // Get the appropriate prompt config based on document type
      if (!SPECIALIZED_PROMPTS[promptKey]) {
        const errorMessage = `No prompt configuration found for document type: ${promptKey}`;
        debugLog(`ERROR: ${errorMessage}`);
        await showFailureToast(new Error(errorMessage));
        return;
      }

      const promptConfig = SPECIALIZED_PROMPTS[promptKey];

      // Get the API key from preferences or LocalStorage
      let apiKey = preferences.apiKey;
      if (!apiKey) {
        apiKey = (await LocalStorage.getItem<string>("openai_api_key")) || "";
        if (!apiKey) {
          await showFailureToast(new Error("Please set your OpenAI API key in preferences"));
          return;
        }
      }

      // Get the model from preferences
      const modelToUse = preferences.model || "gpt-5.2";
      debugLog("Using model:", modelToUse);

      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey: apiKey,
      });

      const newSuggestions: NameSuggestion[] = [];

      // Process each selected item
      for (const item of selectedItems) {
        const itemPath = item.path;
        let isFolder = false;

        try {
          const stat = await fs.stat(itemPath);
          isFolder = stat.isDirectory();
        } catch (error) {
          debugLog("Error checking if item is a folder:", error);
          // Assume it's a file if we can't check
          isFolder = false;
        }

        // Get file extension for files, empty for folders
        const fileExtension = isFolder ? "" : path.extname(itemPath);
        debugLog("File info:", {
          extension: fileExtension,
          nameWithoutExt: path.basename(itemPath, fileExtension),
        });

        // Create the request configuration
        const requestConfig: OpenAIAnalysisRequest = {
          systemPrompt: promptConfig.systemPrompt,
          userPrompt: promptConfig.userPrompt,
          model: modelToUse,
          temperature: promptConfig.temperature || PROMPT_CONFIG.temperature,
          maxTokens: promptConfig.maxTokens || PROMPT_CONFIG.maxTokens,
          fileContent: "",
          contentType: "text/plain",
          documentType: documentType,
          patternInstructions: promptConfig.patternInstructions,
        };

        // Define pattern from preset if provided
        const pattern = preset ? preset.pattern : "";

        // Process the file content for the request
        let processingSuccessful = false;

        try {
          // If we have a pattern from a preset, add it to the request config
          if (pattern) {
            requestConfig.patternInstructions = true;
          }

          // Handle different file types
          let fileContent = "";
          let contentType = "text/plain";

          if (fileExtension.toLowerCase() === ".pdf") {
            debugLog("Processing PDF file");
            processingSuccessful = await processPdfFile(itemPath, requestConfig);
            fileContent = requestConfig.fileContent;
            contentType = requestConfig.contentType;
          } else if (
            [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(fileExtension.toLowerCase())
          ) {
            debugLog("Processing image file");
            processingSuccessful = await processImageFile(itemPath, requestConfig);
            fileContent = requestConfig.fileContent;
            contentType = requestConfig.contentType;
          } else if ([".docx", ".xlsx", ".pptx"].includes(fileExtension.toLowerCase())) {
            debugLog("Processing Office file");
            processingSuccessful = await processOfficeFile(itemPath, requestConfig);
            fileContent = requestConfig.fileContent;
            contentType = requestConfig.contentType;
          } else if (isFolder) {
            debugLog("Processing folder");
            processingSuccessful = await processFolderContents(itemPath, requestConfig);
            fileContent = requestConfig.fileContent;
            contentType = requestConfig.contentType;
          } else {
            debugLog("Processing text file");
            processingSuccessful = await processTextFile(itemPath, requestConfig);
            fileContent = requestConfig.fileContent;
            contentType = requestConfig.contentType;
          }

          if (!processingSuccessful) {
            debugLog("Failed to process file");
            continue; // Skip this file and continue with the next one
          }

          // Replace the two-step extraction + naming logic with:
          const response = await analyzeDocumentAndSuggestNames(
            openai,
            itemPath,
            fileContent,
            contentType,
            documentType, // or "auto" if using auto
            modelToUse,
          );

          const extractedFields = response.fields;
          const apiSuggestions = response.suggestions;

          // If documentType is auto and the extraction identified a document type, use it
          let targetDocType = documentType;
          if (documentType === "auto" && extractedFields.documentType) {
            targetDocType = extractedFields.documentType;
            debugLog(`Auto-detected document type: ${targetDocType}`);
          }

          // Get the pattern for this document type
          let namePattern = pattern;
          if (!namePattern) {
            // If no preset pattern, use default from the appropriate document type
            const docTypePreset = await getDefaultPresetForCategory(
              targetDocType as PresetCategory,
            );
            namePattern = docTypePreset.pattern;
          }

          // Add suggestions to the list
          if (apiSuggestions && apiSuggestions.length > 0) {
            newSuggestions.push(...apiSuggestions);
          } else {
            debugLog("No suggestions generated for this item");
          }
        } catch (error) {
          debugLog("Error processing item:", error);
          await showFailureToast(
            new Error(
              `Failed to process ${path.basename(itemPath)}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            ),
          );
        }
      }

      // Update state with the new suggestions
      if (newSuggestions.length > 0) {
        debugLog(`Got ${newSuggestions.length} suggestions`);
        setSuggestions(newSuggestions);
      } else {
        setError("No name suggestions could be generated. Please try a different document type.");
      }
    } catch (error) {
      debugLog("Error in fetchNameSuggestions:", error);
      setError(
        `An error occurred while generating name suggestions: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function renameFile(item: NameSuggestion) {
    try {
      debugLog("Renaming item:", item);

      // Determine if this is a folder (no extension)
      const isFolder = item.extension === "";
      const itemType = isFolder ? "Folder" : "File";

      const directory = path.dirname(item.originalPath);
      const newPath = path.join(directory, `${item.name}${item.extension}`);

      // Check if destination already exists
      if (await fs.pathExists(newPath)) {
        debugLog("Destination already exists");
        throw new Error(`${itemType} already exists: ${item.name}${item.extension}`);
      }

      await fs.rename(item.originalPath, newPath);
      debugLog(`${itemType} renamed successfully`);

      // Record pattern usage for learning user preferences
      if (item.pattern && item.documentType) {
        await recordPatternUsage(item.pattern, item.documentType);
        debugLog(`Recorded pattern usage: ${item.pattern} for ${item.documentType}`);

        // Debug: log all stored patterns after recording
        await debugLogAllPatterns();
      }

      await showToast({
        style: Toast.Style.Success,
        title: `${itemType} renamed`,
        message: `Renamed to: ${item.name}${item.extension}`,
      });

      // Pop to root and close main window after successful rename
      debugLog("Popping to root and closing main window");
      await popToRoot();
      await closeMainWindow();
    } catch (e) {
      debugLog("Rename error:", e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred";
      await showFailureToast(new Error(errorMessage));
    }
  }

  // Function to handle clearing pattern history
  async function handleClearPatternHistory() {
    try {
      await clearPatternData();
      await showToast({
        style: Toast.Style.Success,
        title: "Pattern History Cleared",
        message: "All learned filename patterns have been reset",
      });
      debugLog("Pattern history cleared by user");
    } catch (error) {
      debugLog("Error clearing pattern history:", error);
      await showFailureToast(new Error("Failed to clear pattern history"));
    }
  }

  // Render error view
  if (error) {
    return <ErrorView error={error} />;
  }

  // If we have selected items but no document type selected yet, show document type selector
  if (selectedItems.length > 0 && !selectedDocumentType) {
    // Get the file extension of the first selected item to suggest appropriate document type
    const fileExtension = path.extname(selectedItems[0]?.path || "").toLowerCase();
    return (
      <DocumentTypeSelector
        onSelectDocumentType={handleDocumentTypeSelection}
        fileExtension={fileExtension}
        isFolder={isFolder}
      />
    );
  }

  // Render suggestion list
  debugLog("Rendering List with suggestions:", suggestions.length);

  return (
    <List
      isLoading={isLoading || isProcessing}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search suggestions..."
    >
      {isFolder
        ? selectedItems.map((item, index) => {
            const folderSuggestions = filteredSuggestions.filter(
              (suggestion) => suggestion.originalPath === item.path,
            );

            if (folderSuggestions.length === 0) return null;

            return (
              <List.Section title={`Folder: ${path.basename(item.path)}`} key={`folder-${index}`}>
                {folderSuggestions.map((suggestion) => (
                  <List.Item
                    key={`${suggestion.id}-${suggestion.name}`}
                    icon={Icon.Folder}
                    title={suggestion.name}
                    subtitle="Suggested folder name"
                    actions={
                      <ActionPanel>
                        <Action
                          title="Rename Folder"
                          icon={Icon.Pencil}
                          onAction={() => renameFile(suggestion)}
                        />
                        <Action
                          title="Open Extension Preferences"
                          icon={Icon.Gear}
                          onAction={openExtensionPreferences}
                        />
                        <Action
                          title="Clear Pattern History"
                          icon={Icon.Trash}
                          style={Action.Style.Destructive}
                          onAction={handleClearPatternHistory}
                          shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }}
                        />
                      </ActionPanel>
                    }
                  />
                ))}
              </List.Section>
            );
          })
        : filteredSuggestions.map((item) => (
            <List.Item
              key={`${item.id}-${item.name}`}
              icon={Icon.Document}
              title={item.name}
              accessories={[{ text: item.extension }]}
              actions={
                <ActionPanel>
                  <Action
                    title="Rename File"
                    icon={Icon.Pencil}
                    onAction={() => renameFile(item)}
                  />
                  <Action
                    title="Open Extension Preferences"
                    icon={Icon.Gear}
                    onAction={openExtensionPreferences}
                  />
                  <Action
                    title="Clear Pattern History"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={handleClearPatternHistory}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }}
                  />
                </ActionPanel>
              }
            />
          ))}
    </List>
  );
}
