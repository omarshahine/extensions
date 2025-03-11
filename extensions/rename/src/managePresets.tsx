import React, { useState } from "react";
import {
  ActionPanel,
  Action,
  List,
  Icon,
  showToast,
  Toast,
  confirmAlert,
  Alert,
  showInFinder,
  Form,
  popToRoot,
} from "@raycast/api";
import { PresetCategory, getPresets, savePresets } from "./utils/presets";
import { PresetManager } from "./components/PresetManager";
import fs from "fs-extra";
import path from "path";
import { homedir } from "os";
import { showFailureToast } from "@raycast/utils";

// Define a type for category selection that includes utility options
type CategorySelection = PresetCategory | "export" | "import" | null;

// Utility function to handle file path normalization
function normalizeFilePath(filePath: string, ensureJsonExtension = true): string {
  // If user provided just a filename without path, save to Documents folder
  if (!path.isAbsolute(filePath)) {
    if (!filePath.includes(path.sep)) {
      // Just a filename, save to Documents
      filePath = path.join(homedir(), "Documents", filePath);
    } else {
      // Relative path, make it absolute from home directory
      filePath = path.join(homedir(), filePath);
    }
  }

  // Add .json extension if not provided and requested
  if (ensureJsonExtension && !filePath.toLowerCase().endsWith(".json")) {
    filePath += ".json";
  }

  return filePath;
}

// Component for selecting export location
function ExportForm({ onExport }: { onExport: (filePath: string) => void }) {
  const defaultPath = path.join(homedir(), "Documents", "rename-presets.json");

  async function handleSubmit(values: { filePath: string }) {
    const filePath = normalizeFilePath(values.filePath);
    onExport(filePath);
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Export" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="filePath"
        title="File Path"
        placeholder="Enter path where to save presets"
        defaultValue={defaultPath}
        info="You can specify a full path or just a filename to save in your Documents folder"
      />
    </Form>
  );
}

// Component for selecting import location
function ImportForm({ onImport }: { onImport: (filePath: string) => void }) {
  const defaultPath = path.join(homedir(), "Documents", "rename-presets.json");

  async function handleSubmit(values: { filePath: string }) {
    const filePath = normalizeFilePath(values.filePath);
    onImport(filePath);
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Import" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="filePath"
        title="File Path"
        placeholder="Enter path to presets file"
        defaultValue={defaultPath}
        info="You can specify a full path or just a filename in your Documents folder"
      />
    </Form>
  );
}

export default function ManagePresets() {
  const [selectedCategory, setSelectedCategory] = useState<CategorySelection>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Function to export all presets to a JSON file
  async function handleExport(filePath: string) {
    try {
      setIsLoading(true);

      // Get all presets from storage
      const allPresets = await getPresets();

      // Ensure directory exists
      await fs.ensureDir(path.dirname(filePath));

      // Write presets to the file
      await fs.writeJSON(filePath, allPresets, { spaces: 2 });

      await showToast({
        style: Toast.Style.Success,
        title: "Presets Exported",
        message: `${allPresets.length} presets saved to ${filePath}`,
        primaryAction: {
          title: "Show in Finder",
          onAction: () => showInFinder(filePath),
        },
      });

      popToRoot();
    } catch (error) {
      await showFailureToast(
        new Error(error instanceof Error ? error.message : "Unknown error occurred"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Function to import presets from a JSON file
  async function handleImport(filePath: string) {
    try {
      setIsLoading(true);

      // Check if the file exists
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read and parse the selected file
      const fileData = await fs.readJSON(filePath);

      // Validate the imported data
      if (!Array.isArray(fileData)) {
        throw new Error("Invalid preset file format. Expected an array of presets.");
      }

      // Check if each preset has the required fields
      const invalidPresets = fileData.filter(
        (preset) => !preset.id || !preset.name || !preset.category || !preset.pattern,
      );

      if (invalidPresets.length > 0) {
        throw new Error(`Found ${invalidPresets.length} invalid presets in the file.`);
      }

      // Confirm import with user
      const confirmed = await confirmAlert({
        title: "Import Presets",
        message: `Import ${fileData.length} presets? This will merge with your existing presets.`,
        primaryAction: {
          title: "Import",
          style: Alert.ActionStyle.Default,
        },
      });

      if (!confirmed) {
        setIsLoading(false);
        popToRoot();
        return;
      }

      // Get existing presets
      const existingPresets = await getPresets();

      // Create a map of existing preset IDs for fast lookup
      const existingPresetIds = new Set(existingPresets.map((preset) => preset.id));

      // Filter out duplicates and add new presets
      const newPresets = fileData.filter((preset) => !existingPresetIds.has(preset.id));
      const mergedPresets = [...existingPresets, ...newPresets];

      // Save merged presets
      await savePresets(mergedPresets);

      await showToast({
        style: Toast.Style.Success,
        title: "Presets Imported",
        message: `Added ${newPresets.length} new presets from ${path.basename(filePath)}`,
      });

      popToRoot();
    } catch (error) {
      await showFailureToast(
        new Error(error instanceof Error ? error.message : "Unknown error occurred"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  // If showing export form
  if (selectedCategory === "export") {
    return <ExportForm onExport={handleExport} />;
  }

  // If showing import form
  if (selectedCategory === "import") {
    return <ImportForm onImport={handleImport} />;
  }

  // If a category is selected, render the PresetManager for that category
  if (selectedCategory && !["export", "import"].includes(selectedCategory)) {
    return (
      <PresetManager
        category={selectedCategory as PresetCategory}
        onGoBack={() => setSelectedCategory(null)}
      />
    );
  }

  // Otherwise, show the list of categories to select from
  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search preset categories...">
      <List.Section title="Preset Categories">
        <List.Item
          title="Receipt Presets"
          icon={Icon.Receipt}
          actions={
            <ActionPanel>
              <Action.Push
                title="Manage Receipt Presets"
                target={<PresetManager category={PresetCategory.Receipt} />}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Bill Presets"
          icon={Icon.BankNote}
          actions={
            <ActionPanel>
              <Action.Push
                title="Manage Bill Presets"
                target={<PresetManager category={PresetCategory.Bill} />}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Tax Document Presets"
          icon={Icon.Document}
          actions={
            <ActionPanel>
              <Action.Push
                title="Manage Tax Document Presets"
                target={<PresetManager category={PresetCategory.TaxDocument} />}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Bank Statement Presets"
          icon={Icon.CreditCard}
          actions={
            <ActionPanel>
              <Action.Push
                title="Manage Bank Statement Presets"
                target={<PresetManager category={PresetCategory.BankStatement} />}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Folder Presets"
          icon={Icon.Folder}
          actions={
            <ActionPanel>
              <Action.Push
                title="Manage Folder Presets"
                target={<PresetManager category={PresetCategory.Folder} />}
              />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Utilities">
        <List.Item
          title="Export All Presets"
          icon={Icon.Download}
          actions={
            <ActionPanel>
              <Action
                title="Export Presets to JSON"
                icon={Icon.Download}
                onAction={() => setSelectedCategory("export")}
              />
              <Action
                title="Import Presets from JSON"
                icon={Icon.Upload}
                onAction={() => setSelectedCategory("import")}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Import Presets"
          icon={Icon.Upload}
          actions={
            <ActionPanel>
              <Action
                title="Import Presets from JSON"
                icon={Icon.Upload}
                onAction={() => setSelectedCategory("import")}
              />
              <Action
                title="Export Presets to JSON"
                icon={Icon.Download}
                onAction={() => setSelectedCategory("export")}
              />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}
