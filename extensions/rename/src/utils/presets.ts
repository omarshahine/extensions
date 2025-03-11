import { LocalStorage, Icon } from "@raycast/api";
import crypto from "crypto";

// Define preset category types
// TODO: Let the user define their own categories
export enum PresetCategory {
  Auto = "auto",
  Receipt = "receipt",
  Bill = "bill",
  TaxDocument = "taxDocument",
  BankStatement = "bankStatement",
  Folder = "folder",
}

// Define the preset interface
export interface RenamePreset {
  id: string;
  name: string;
  category: PresetCategory;
  pattern: string;
  icon?: string; // Icon string from Raycast.Icon
  description?: string;
  isDefault?: boolean;
}

// Default patterns for each category
export const DEFAULT_PATTERNS: Record<PresetCategory, string> = {
  [PresetCategory.Auto]: "{Description}",
  [PresetCategory.Receipt]: "{Merchant} - {Date:YYYY-MM} - {Amount}",
  [PresetCategory.Bill]: "{Provider} - {Date:YYYY-MM} - {Amount}",
  [PresetCategory.TaxDocument]:
    "{Form Name} - {Description} - {Account Holder} - {Institution} - {Tax Year}",
  [PresetCategory.BankStatement]: "{Bank} - {Account Type} - {Date:YYYY-MM}",
  [PresetCategory.Folder]: "{Content Type} {Date:YYYY}",
} as const;

// Storage keys for presets
const STORAGE_KEY_PRESETS = "rename_presets";

// Get all presets from local storage
export async function getPresets(category?: PresetCategory): Promise<RenamePreset[]> {
  const storedPresets = await LocalStorage.getItem<string>(STORAGE_KEY_PRESETS);
  if (!storedPresets) {
    // Initialize with default presets if none exist
    const defaultPresets = getDefaultPresets();
    await savePresets(defaultPresets);
    return category
      ? defaultPresets.filter((preset) => preset.category === category)
      : defaultPresets;
  }

  try {
    const allPresets = JSON.parse(storedPresets);

    // Fix any presets with empty patterns
    const repaired = repairPresetsWithEmptyPatterns(allPresets);
    if (repaired) {
      await savePresets(allPresets);
    }

    return category
      ? allPresets.filter((preset: RenamePreset) => preset.category === category)
      : allPresets;
  } catch (error) {
    console.error("Error parsing presets:", error);
    const defaultPresets = getDefaultPresets();
    return category
      ? defaultPresets.filter((preset) => preset.category === category)
      : defaultPresets;
  }
}

// Get presets for a specific category
export async function getPresetsByCategory(category: PresetCategory): Promise<RenamePreset[]> {
  const allPresets = await getPresets();
  return allPresets.filter((preset) => preset.category === category);
}

// Save a new preset
export async function savePreset(
  presetOrCategory: PresetCategory | RenamePreset,
  presetData?: RenamePreset,
): Promise<void> {
  const presets = await getPresets();

  // Handle both function signatures
  const preset = presetData || (presetOrCategory as RenamePreset);

  const existingIndex = presets.findIndex((p) => p.id === preset.id);

  if (existingIndex >= 0) {
    // Update existing preset
    presets[existingIndex] = preset;
  } else {
    // Add new preset with ID if it doesn't have one
    const newPreset = { ...preset, id: preset.id || crypto.randomUUID() };
    presets.push(newPreset);
  }

  await savePresets(presets);
}

// Delete a preset
export async function deletePreset(
  categoryOrId: PresetCategory | string,
  presetId?: string,
): Promise<void> {
  const presets = await getPresets();

  // Handle both function signatures
  const id = presetId || (categoryOrId as string);

  const updatedPresets = presets.filter((preset) => preset.id !== id);
  await savePresets(updatedPresets);
}

// Save all presets to local storage
export async function savePresets(presets: RenamePreset[]): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
}

// Get default preset for a category based on user preferences
export function getDefaultPresetForCategory(category: PresetCategory): RenamePreset {
  const defaultPresets = getDefaultPresets();

  // Find and return the default preset for the requested category
  const existingPreset = defaultPresets.find(
    (preset) => preset.category === category && preset.isDefault,
  );

  if (existingPreset) {
    return existingPreset;
  }

  // Create a new preset with default pattern if no default preset exists
  return {
    id: crypto.randomUUID(),
    name: `Default ${getCategoryName(category)}`,
    category,
    pattern: DEFAULT_PATTERNS[category],
    icon: getCategoryIcon(category),
    description: `Default pattern for ${getCategoryName(category).toLowerCase()}`,
    isDefault: true,
  };
}

// Helper function to get category name
export function getCategoryName(category: PresetCategory): string {
  switch (category) {
    case PresetCategory.Auto:
      return "Auto";
    case PresetCategory.Receipt:
      return "Receipt";
    case PresetCategory.Bill:
      return "Bill";
    case PresetCategory.TaxDocument:
      return "Tax Document";
    case PresetCategory.BankStatement:
      return "Bank Statement";
    case PresetCategory.Folder:
      return "Folder";
    default:
      return "Unknown";
  }
}

// Helper function to get category icon
export function getCategoryIcon(category: PresetCategory): string {
  switch (category) {
    case PresetCategory.Auto:
      return Icon.Wand.toString();
    case PresetCategory.Receipt:
      return Icon.Receipt.toString();
    case PresetCategory.Bill:
      return Icon.BankNote.toString();
    case PresetCategory.TaxDocument:
      return Icon.Document.toString();
    case PresetCategory.BankStatement:
      return Icon.CreditCard.toString();
    case PresetCategory.Folder:
      return Icon.Folder.toString();
    default:
      return Icon.Document.toString();
  }
}

// Get default presets
function getDefaultPresets(): RenamePreset[] {
  return [
    {
      id: "auto-standard",
      name: "Standard Auto",
      category: PresetCategory.Auto,
      pattern: DEFAULT_PATTERNS[PresetCategory.Auto],
      icon: Icon.Wand.toString(),
      description: "Automatic general purpose naming",
      isDefault: true,
    },
    {
      id: crypto.randomUUID(),
      name: "Standard Receipt",
      category: PresetCategory.Receipt,
      pattern: DEFAULT_PATTERNS[PresetCategory.Receipt],
      icon: Icon.Receipt.toString(),
      description: "Standard format for receipts with date and vendor",
      isDefault: true,
    },
    {
      id: crypto.randomUUID(),
      name: "Standard Bill",
      category: PresetCategory.Bill,
      pattern: DEFAULT_PATTERNS[PresetCategory.Bill],
      icon: Icon.BankNote.toString(),
      description: "Standard format for bills with date and vendor",
      isDefault: true,
    },
    {
      id: crypto.randomUUID(),
      name: "Standard Tax Document",
      category: PresetCategory.TaxDocument,
      pattern: DEFAULT_PATTERNS[PresetCategory.TaxDocument],
      icon: Icon.Document.toString(),
      description: "Standard format for tax documents with year and type",
      isDefault: true,
    },
    {
      id: crypto.randomUUID(),
      name: "Standard Bank Statement",
      category: PresetCategory.BankStatement,
      pattern: DEFAULT_PATTERNS[PresetCategory.BankStatement],
      icon: Icon.CreditCard.toString(),
      description: "Standard format for bank statements with date and account",
      isDefault: true,
    },
    {
      id: crypto.randomUUID(),
      name: "Standard Folder",
      category: PresetCategory.Folder,
      pattern: DEFAULT_PATTERNS[PresetCategory.Folder],
      icon: Icon.Folder.toString(),
      description: "Standard format for organizing folders",
      isDefault: true,
    },
  ];
}

// Function to repair any presets with empty patterns
function repairPresetsWithEmptyPatterns(presets: RenamePreset[]): boolean {
  let madeChanges = false;

  // Check each preset and fix if needed
  for (const preset of presets) {
    if (!preset.pattern || preset.pattern.trim() === "") {
      preset.pattern = DEFAULT_PATTERNS[preset.category];
      madeChanges = true;
    }
  }

  return madeChanges;
}
