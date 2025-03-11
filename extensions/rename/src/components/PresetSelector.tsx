import React from "react";
import { PresetCategory, RenamePreset } from "../utils/presets";
import { PresetManager } from "./PresetManager";

/**
 * Component to select a preset from a category
 * This is a wrapper around PresetManager to maintain backward compatibility
 */
export default function PresetSelector({
  category,
  onSelectPreset,
}: {
  category: PresetCategory;
  onSelectPreset: (preset: RenamePreset) => void;
}) {
  return (
    <PresetManager category={category} onPresetSelect={onSelectPreset} showSelectAction={true} />
  );
}
