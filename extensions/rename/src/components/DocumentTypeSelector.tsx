import React, { useMemo, useState } from "react";
import { List, ActionPanel, Action, Icon } from "@raycast/api";
import { SPECIALIZED_PROMPTS } from "../constants";
import { debugLog } from "../utils/logging";
import { PresetCategory, RenamePreset } from "../utils/presets";

// Import the PresetSelector to avoid circular dependencies
import PresetSelector from "./PresetSelector";

export interface DocumentTypeProps {
  onSelectDocumentType: (documentType: string, preset?: RenamePreset) => void;
  fileExtension?: string;
  isFolder?: boolean;
}

const DocumentTypeSelector: React.FC<DocumentTypeProps> = ({
  onSelectDocumentType,
  fileExtension,
  isFolder = false,
}) => {
  // Add state for search text
  const [searchText, setSearchText] = useState("");

  // For debugging - log available document types
  useMemo(() => {
    debugLog("Available document types:", Object.keys(SPECIALIZED_PROMPTS).join(", "));
    debugLog(
      "Document type names:",
      Object.entries(SPECIALIZED_PROMPTS)
        .map(([key, value]) => `${key}: ${value.name}`)
        .join(", "),
    );
  }, []);

  // If it's a folder, only show the folder option
  if (isFolder) {
    const folderPrompt = SPECIALIZED_PROMPTS.folder;
    return (
      <List
        navigationTitle="Select Renaming Category"
        searchBarPlaceholder="Search folder templates..."
        onSearchTextChange={setSearchText}
        searchText={searchText}
      >
        <List.Item
          key="folder"
          icon={Icon.Folder}
          title={folderPrompt.name}
          subtitle="Analyzes folder contents to suggest descriptive names based on contained files and structure"
          accessories={[{ icon: Icon.Star }]}
          actions={
            <ActionPanel>
              <Action
                title={`Select ${folderPrompt.name}`}
                onAction={() => {
                  debugLog(`Selecting document type: folder`);
                  onSelectDocumentType("folder");
                }}
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  // Document types with their icons and descriptions
  const documentTypesWithIcons = [
    {
      id: PresetCategory.Auto,
      title: "Auto",
      icon: Icon.Wand,
      description: "Let AI decide the best naming format based on content",
    },
    {
      id: PresetCategory.Receipt,
      title: "Receipt",
      icon: Icon.Receipt,
      description: "Statements for purchases like groceries, meals, or shopping",
    },
    {
      id: PresetCategory.Bill,
      title: "Bill",
      icon: Icon.BankNote,
      description: "Bills like utility bills, internet, or phone bills",
    },
    {
      id: PresetCategory.TaxDocument,
      title: "Tax Document",
      icon: Icon.Document,
      description: "Tax documents like W-2, 1099, or tax returns",
    },
    {
      id: PresetCategory.BankStatement,
      title: "Bank Statement",
      icon: Icon.CreditCard,
      description: "Bank or credit card statements",
    },
    {
      id: PresetCategory.Folder,
      title: "Folder",
      icon: Icon.Folder,
      description: "Folder with various contents",
    },
  ];

  // Find the best document type based on file extension
  const getBestSuggestion = (): string => {
    // For folders, suggest the folder type
    if (isFolder) {
      return PresetCategory.Folder;
    }

    // For files, suggest based on extension
    const lowerExt = fileExtension?.toLowerCase() || "";

    // PDF files could be any type, so suggest Auto
    if (lowerExt === ".pdf") {
      return PresetCategory.Auto;
    }

    // Images are likely receipts
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(lowerExt)) {
      return PresetCategory.Receipt;
    }

    // Excel files are often financial statements
    if ([".xlsx", ".xls", ".csv"].includes(lowerExt)) {
      return PresetCategory.BankStatement;
    }

    // For all other files or unknown extensions, suggest Auto
    return PresetCategory.Auto;
  };

  const suggestedType = getBestSuggestion();

  // Action component
  const actionForDocumentType = (type: { id: PresetCategory; title: string }) => {
    // Map PresetCategory enum values to SPECIALIZED_PROMPTS keys
    const documentType = type.id;

    return (
      <ActionPanel>
        <Action
          title={`Select ${type.title}`}
          onAction={() => {
            debugLog(`Selecting document type: ${documentType} (${type.title})`);
            onSelectDocumentType(documentType);
          }}
        />
        <Action.Push
          title={`Browse ${type.title} Presets`}
          icon={Icon.List}
          target={
            <PresetSelector
              category={type.id}
              onSelectPreset={(preset) => onSelectDocumentType(documentType, preset)}
            />
          }
        />
      </ActionPanel>
    );
  };

  return (
    <List
      navigationTitle="Select Template for Renaming"
      searchBarPlaceholder="Search templates..."
      onSearchTextChange={setSearchText}
      searchText={searchText}
    >
      <List.Section title="What type of document is this?">
        {documentTypesWithIcons
          // If it's a folder, only show the folder type
          .filter((type) => !isFolder || type.id === PresetCategory.Folder)
          .map((type) => (
            <List.Item
              key={type.id}
              title={type.title}
              subtitle={type.description}
              icon={type.icon}
              accessories={[
                {
                  text: suggestedType === type.id ? "Suggested" : "",
                  icon: suggestedType === type.id ? Icon.Star : undefined,
                },
              ]}
              actions={actionForDocumentType(type)}
            />
          ))}
      </List.Section>
    </List>
  );
};

export default DocumentTypeSelector;
