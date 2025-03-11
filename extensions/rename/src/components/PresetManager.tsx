import React, { useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Form,
  Icon,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import {
  PresetCategory,
  RenamePreset,
  getPresetsByCategory,
  savePreset,
  deletePreset,
  getCategoryName,
  getCategoryIcon,
  DEFAULT_PATTERNS,
} from "../utils/presets";
import crypto from "crypto";
import { debugLog } from "../utils/logging";

interface PresetManagerProps {
  category: PresetCategory;
  onPresetSelect?: (preset: RenamePreset) => void;
  showSelectAction?: boolean;
  onGoBack?: () => void;
}

export function PresetManager({
  category,
  onPresetSelect,
  showSelectAction = false,
  onGoBack,
}: PresetManagerProps) {
  const [presets, setPresets] = useState<RenamePreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pop } = useNavigation();

  useEffect(() => {
    async function loadPresets() {
      setIsLoading(true);
      try {
        const loadedPresets = await getPresetsByCategory(category);
        setPresets(loadedPresets);
      } catch (error) {
        debugLog("Error loading presets:", error);
        await showFailureToast(new Error("Failed to load presets"));
      } finally {
        setIsLoading(false);
      }
    }

    loadPresets();
  }, [category]);

  async function handleDeletePreset(presetId: string) {
    const confirmed = await confirmAlert({
      title: "Delete Preset",
      message: "Are you sure you want to delete this preset? This action cannot be undone.",
      primaryAction: {
        title: "Delete",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (confirmed) {
      try {
        await deletePreset(presetId);
        setPresets(presets.filter((preset) => preset.id !== presetId));
        showToast({
          style: Toast.Style.Success,
          title: "Preset deleted",
        });
      } catch (error) {
        debugLog("Error deleting preset:", error);
        await showFailureToast(new Error("Failed to delete preset"));
      }
    }
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search presets..."
      navigationTitle={`${getCategoryName(category)} Presets`}
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Navigation">
            <Action
              title="Back to Categories"
              icon={Icon.ArrowLeft}
              onAction={() => {
                if (onGoBack) {
                  onGoBack();
                } else {
                  pop();
                }
              }}
              shortcut={{ modifiers: ["cmd"], key: "[" }}
            />
          </ActionPanel.Section>

          <ActionPanel.Section title="Preset Actions">
            <Action.Push
              title="Create New Preset"
              icon={Icon.Plus}
              target={
                <EditPresetForm
                  preset={{
                    id: "",
                    name: "",
                    pattern: DEFAULT_PATTERNS[category],
                    category,
                    icon: getCategoryIcon(category),
                  }}
                  isNew={true}
                  setPresets={setPresets}
                />
              }
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    >
      <List.Section title={`${getCategoryName(category)} Presets`}>
        {presets.map((preset) => (
          <List.Item
            key={preset.id}
            title={preset.name}
            subtitle={preset.pattern}
            icon={preset.icon || getCategoryIcon(category)}
            // accessories={[
            //   {
            //     text: preset.description,
            //     tooltip: preset.description,
            //   },
            // ]}
            actions={
              <ActionPanel>
                {showSelectAction && (
                  <Action
                    title="Select Preset"
                    icon={Icon.CheckCircle}
                    onAction={() => onPresetSelect?.(preset)}
                  />
                )}
                <Action.Push
                  title="Edit Preset"
                  icon={Icon.Pencil}
                  target={<EditPresetForm preset={preset} setPresets={setPresets} />}
                />
                <Action
                  title="Delete Preset"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={() => handleDeletePreset(preset.id)}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      {presets.length === 0 && !isLoading && (
        <List.EmptyView
          title="No presets found"
          description="Create your first preset to get started."
          icon={Icon.Document}
          actions={
            <ActionPanel>
              <Action.Push
                title="Create Preset"
                icon={Icon.Plus}
                target={
                  <EditPresetForm
                    preset={{
                      id: "",
                      name: "",
                      pattern: DEFAULT_PATTERNS[category],
                      category,
                      icon: getCategoryIcon(category),
                    }}
                    isNew={true}
                    setPresets={setPresets}
                  />
                }
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}

interface EditPresetFormProps {
  preset: RenamePreset;
  isNew?: boolean;
  setPresets: React.Dispatch<React.SetStateAction<RenamePreset[]>>;
}

function EditPresetForm({ preset, isNew = false, setPresets }: EditPresetFormProps) {
  const [nameError, setNameError] = useState<string | undefined>();
  const [patternError, setPatternError] = useState<string | undefined>();

  async function handleSubmit(values: { name: string; pattern: string; description: string }) {
    // Validate
    if (!values.name) {
      setNameError("Name is required");
      return;
    }
    if (!values.pattern) {
      setPatternError("Pattern is required");
      return;
    }

    // Create or update preset
    const updatedPreset: RenamePreset = {
      id: preset.id || crypto.randomUUID(),
      name: values.name,
      pattern: values.pattern,
      category: preset.category,
      icon: preset.icon,
      description: values.description,
    };

    try {
      await savePreset(updatedPreset);

      // Update local state
      setPresets((currentPresets) => {
        if (isNew) {
          return [...currentPresets, updatedPreset];
        } else {
          return currentPresets.map((p) => (p.id === updatedPreset.id ? updatedPreset : p));
        }
      });

      showToast({
        style: Toast.Style.Success,
        title: isNew ? "Preset created" : "Preset updated",
      });
    } catch (error) {
      debugLog("Error saving presets:", error);
      await showFailureToast(new Error("Failed to save presets"));
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isNew ? "Create Preset" : "Update Preset"}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        placeholder="Enter preset name"
        defaultValue={preset.name}
        error={nameError}
        onChange={() => setNameError(undefined)}
      />
      <Form.TextField
        id="pattern"
        title="Pattern"
        placeholder={`e.g. ${DEFAULT_PATTERNS[preset.category]}`}
        defaultValue={preset.pattern}
        error={patternError}
        onChange={() => setPatternError(undefined)}
        info={`Use placeholders from ${getCategoryName(preset.category)} patterns like ${DEFAULT_PATTERNS[preset.category]}`}
      />
      <Form.TextField
        id="description"
        title="Description"
        placeholder="Enter a description for this preset"
        defaultValue={preset.description}
      />

      <Form.Separator />

      <Form.Description
        title="Available Rename Tokens"
        text={`{Date:FORMAT} - Document date (FORMAT options: YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY)
{Year} - Year (YYYY)
{Month} - Month name or number
{Day} - Day of month

Renaming Tokens:
{Merchant} - Store or merchant name
{Provider} - Service provider name
{Amount} - Transaction amount
{Account} - Account number or name
{Category} - Document category
{Description} - Document description
{Form} - Form number (e.g., W-2, 1099)
{Bank} - Bank name
{AccountType} - Type of account
{PaymentMethod} - Method of payment
{DueDate:FORMAT} - Payment due date
{Notes} - Additional notes
{Number} - Sequential number
        `}
      />
      <Form.Description
        title="Pattern Format Help"
        text="Available placeholders depend on the document type. Common examples include {Date:FORMAT}, {Vendor}, {Amount}, {Account}, etc."
      />
    </Form>
  );
}
