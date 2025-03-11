import { LocalStorage } from "@raycast/api";
import { StoredPattern, PatternUsageData } from "../types";
import { debugLog } from "./logging";

const PATTERN_STORAGE_KEY = "rename-pattern-usage";

/**
 * Get all stored pattern usage data
 */
export async function getPatternUsageData(): Promise<PatternUsageData> {
  try {
    const storedData = await LocalStorage.getItem<string>(PATTERN_STORAGE_KEY);
    if (storedData) {
      return JSON.parse(storedData);
    }
    return {};
  } catch (error) {
    debugLog("Error loading pattern usage data:", error);
    return {};
  }
}

/**
 * Store pattern usage data
 */
async function setPatternUsageData(data: PatternUsageData): Promise<void> {
  try {
    await LocalStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    debugLog("Error storing pattern usage data:", error);
  }
}

/**
 * Record usage of a pattern (increment counter or create new entry)
 */
export async function recordPatternUsage(pattern: string, documentType: string): Promise<void> {
  try {
    const currentData = await getPatternUsageData();

    if (currentData[pattern]) {
      // Increment existing pattern
      currentData[pattern].count += 1;
      currentData[pattern].lastUsed = Date.now();
    } else {
      // Create new pattern entry
      currentData[pattern] = {
        pattern,
        count: 1,
        lastUsed: Date.now(),
        documentType,
      };
    }

    await setPatternUsageData(currentData);
    debugLog(`Recorded pattern usage: ${pattern} (count: ${currentData[pattern].count})`);
  } catch (error) {
    debugLog("Error recording pattern usage:", error);
  }
}

/**
 * Get the most frequently used patterns, sorted by usage count
 */
export async function getMostUsedPatterns(limit = 10): Promise<StoredPattern[]> {
  try {
    const data = await getPatternUsageData();
    const patterns = Object.values(data);

    // Sort by count (descending), then by last used (most recent first)
    return patterns
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return b.lastUsed - a.lastUsed;
      })
      .slice(0, limit);
  } catch (error) {
    debugLog("Error getting most used patterns:", error);
    return [];
  }
}

/**
 * Get patterns for a specific document type, sorted by usage
 */
export async function getPatternsForDocumentType(
  documentType: string,
  limit = 5,
): Promise<StoredPattern[]> {
  try {
    const patterns = await getMostUsedPatterns();
    return patterns.filter((p) => p.documentType === documentType).slice(0, limit);
  } catch (error) {
    debugLog("Error getting patterns for document type:", error);
    return [];
  }
}

/**
 * Clear all stored pattern data (for debugging/reset purposes)
 */
export async function clearPatternData(): Promise<void> {
  try {
    await LocalStorage.removeItem(PATTERN_STORAGE_KEY);
    debugLog("Cleared all pattern usage data");
  } catch (error) {
    debugLog("Error clearing pattern data:", error);
  }
}

/**
 * Debug function to log all stored patterns
 */
export async function debugLogAllPatterns(): Promise<void> {
  try {
    const data = await getPatternUsageData();
    debugLog("All stored patterns:", data);

    const patterns = Object.values(data);
    if (patterns.length === 0) {
      debugLog("No patterns stored yet");
    } else {
      debugLog("Pattern summary:");
      patterns
        .sort((a, b) => b.count - a.count)
        .forEach((p) => {
          debugLog(`  - "${p.pattern}" (${p.documentType}): used ${p.count} times`);
        });
    }
  } catch (error) {
    debugLog("Error logging patterns:", error);
  }
}
