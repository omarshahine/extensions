import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { showToast, Toast } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import sizeOf from "image-size";
import { debugLog } from "./logging";
import { OpenAIAnalysisRequest } from "../types";

const execAsync = promisify(exec);

// Custom error class for file processing
class FileProcessingError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "FileProcessingError";
  }
}

// Helper function to show error toast
async function showErrorToast(error: unknown, context: string) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  debugLog(`Error in ${context}:`, error);
  await showFailureToast(new Error(`${context}: ${errorMessage}`));
}

// Function to check if the file is a PDF
export function isPdf(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".pdf";
}

/**
 * Checks if an image is mostly blank by analyzing its pixel data
 * Returns true if the image is blank or mostly white
 */
async function isImageBlank(imagePath: string): Promise<boolean> {
  try {
    const buffer = await fs.readFile(imagePath);
    const dimensions = sizeOf(buffer);
    if (!dimensions || !dimensions.width || !dimensions.height) {
      return true;
    }

    // If the image is too small, it might be blank
    if (dimensions.width < 100 || dimensions.height < 100) {
      return true;
    }

    // Use sips to get image statistics
    const sipsCommand = `sips -g all "${imagePath}"`;
    const result = await execAsync(sipsCommand);

    // Check if the image is mostly white
    const stats = result.stdout;
    if (
      stats.includes("pixelFormat: 1") || // Grayscale
      stats.includes("pixelFormat: 2")
    ) {
      // RGB
      // If the image is mostly white, it's considered blank
      const whiteThreshold = 0.95; // 95% white pixels
      const whitePixels = stats.match(/white: (\d+)/);
      if (
        whitePixels &&
        parseInt(whitePixels[1]) > whiteThreshold * dimensions.width * dimensions.height
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    debugLog("Error checking if image is blank:", error);
    return true;
  }
}

export async function processPdfFile(
  filePath: string,
  requestConfig: OpenAIAnalysisRequest,
): Promise<boolean> {
  debugLog("Processing PDF file:", filePath);

  // Check if file exists and is readable
  await fs.access(filePath, fs.constants.R_OK).catch(() => {
    throw new FileProcessingError("File not found or not readable", "FILE_ACCESS");
  });

  // Create a temporary directory for our work
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-"));
  const tempPngPath1 = path.join(tempDir, "page1.png");
  const tempPngPath2 = path.join(tempDir, "page2.png");

  try {
    // Convert first page to PNG with white background
    const sipsCommand1 = `sips -s format png -s dpiHeight 300 -s dpiWidth 300 --resampleHeight 2048 "${filePath}" --out "${tempPngPath1}" --padColor FFFFFF`;
    debugLog("Running sips command for page 1:", sipsCommand1);
    await execAsync(sipsCommand1);

    // Check if first page is blank
    const isFirstPageBlank = await isImageBlank(tempPngPath1);

    if (isFirstPageBlank) {
      // If first page is blank, try to get page 2
      const sipsCommand2 = `sips -s format png -s dpiHeight 300 -s dpiWidth 300 --resampleHeight 2048 "${filePath}" --out "${tempPngPath2}" --page 2 --padColor FFFFFF`;
      debugLog("Running sips command for page 2:", sipsCommand2);
      await execAsync(sipsCommand2);

      // Check if second page exists and is not blank
      const isSecondPageBlank = await isImageBlank(tempPngPath2);

      if (!isSecondPageBlank) {
        // Use second page if first is blank and second is not
        const buffer = await fs.readFile(tempPngPath2);
        requestConfig.fileContent = buffer.toString("base64");
      } else {
        // If both pages are blank, use the first page anyway
        const buffer = await fs.readFile(tempPngPath1);
        requestConfig.fileContent = buffer.toString("base64");
      }
    } else {
      // Use first page if it's not blank
      const buffer = await fs.readFile(tempPngPath1);
      requestConfig.fileContent = buffer.toString("base64");
    }

    requestConfig.contentType = "image/png";
    return true;
  } catch (error) {
    debugLog("Error processing PDF:", error);
    await showFailureToast(
      new Error(
        "PDF Processing Error: " + (error instanceof Error ? error.message : "Unknown error"),
      ),
    );
    return false;
  } finally {
    // Clean up temporary files
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function processImageFile(
  filePath: string,
  requestConfig: OpenAIAnalysisRequest,
): Promise<boolean> {
  try {
    const imageBuffer = await fs.readFile(filePath);
    const base64Image = imageBuffer.toString("base64");
    requestConfig.fileContent = base64Image;
    requestConfig.contentType = "image/jpeg";
    return true;
  } catch (error) {
    debugLog("Error processing image file:", error);
    await showFailureToast(
      new Error(
        "Image Processing Error: " + (error instanceof Error ? error.message : "Unknown error"),
      ),
    );
    return false;
  }
}

export async function processTextFile(
  filePath: string,
  requestConfig: OpenAIAnalysisRequest,
): Promise<boolean> {
  let toast: Toast | undefined;
  try {
    // Check if file exists and is readable
    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch (error) {
      throw new FileProcessingError("File not found or not readable", "FILE_ACCESS");
    }

    toast = await showToast({
      style: Toast.Style.Animated,
      title: "Processing Text",
      message: "Reading file...",
    });

    const content = await fs.readFile(filePath, "utf-8");
    requestConfig.fileContent = content;
    requestConfig.contentType = "text/plain";

    // Update toast to success
    if (toast) {
      toast.style = Toast.Style.Success;
      toast.title = "Text Ready";
      toast.message = "Prepared for analysis";
    }

    return true;
  } catch (error) {
    debugLog("Error processing text:", error);
    if (toast) {
      toast.style = Toast.Style.Failure;
      toast.title = "Text Processing Error";
      toast.message = error instanceof Error ? error.message : "Unknown error occurred";
    } else {
      await showErrorToast(
        error instanceof Error ? error : new Error("Unknown error"),
        "processing text",
      );
    }
    return false;
  }
}

export async function processOfficeFile(
  filePath: string,
  requestConfig: OpenAIAnalysisRequest,
): Promise<boolean> {
  let toast: Toast | undefined;
  try {
    // Check if file exists and is readable
    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch (error) {
      throw new FileProcessingError("File not found or not readable", "FILE_ACCESS");
    }

    toast = await showToast({
      style: Toast.Style.Animated,
      title: "Processing Office File",
      message: "Converting to text...",
    });

    // For now, we'll just read the file as text
    // In a real implementation, you'd want to use a library like mammoth for Word docs
    const content = await fs.readFile(filePath, "utf-8");
    requestConfig.fileContent = content;
    requestConfig.contentType = "text/plain";

    // Update toast to success
    if (toast) {
      toast.style = Toast.Style.Success;
      toast.title = "Office File Ready";
      toast.message = "Prepared for analysis";
    }

    return true;
  } catch (error) {
    debugLog("Error processing office file:", error);
    await showFailureToast(
      new Error(
        "Office File Processing Error: " +
          (error instanceof Error ? error.message : "Unknown error"),
      ),
    );
    return false;
  }
}

// Add this interface near the top of the file (with the other interfaces)
interface FileInfo {
  file: string;
  fullPath: string;
  isDirectory: boolean;
  size: number;
  extension: string;
}

export async function processFolderContents(
  folderPath: string,
  requestConfig: OpenAIAnalysisRequest,
): Promise<boolean> {
  let toast: Toast | undefined;
  try {
    // Check if folder exists and is readable
    try {
      await fs.access(folderPath, fs.constants.R_OK);
    } catch (error) {
      throw new FileProcessingError("Folder not found or not readable", "FOLDER_ACCESS");
    }

    toast = await showToast({
      style: Toast.Style.Animated,
      title: "Processing Folder",
      message: "Scanning contents...",
    });

    const files = await fs.readdir(folderPath);
    const fileInfos: string[] = [];

    // Add basic folder information
    fileInfos.push(`Folder: ${path.basename(folderPath)}`);
    fileInfos.push(`Total files: ${files.length}`);
    fileInfos.push("\nFiles:");

    // Get file details for sorting
    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(folderPath, file);
        try {
          const stats = await fs.stat(fullPath);
          return {
            file,
            fullPath,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            extension: path.extname(file).toLowerCase(),
          };
        } catch (error) {
          debugLog(`Error reading file ${file}:`, error);
          return null;
        }
      }),
    );

    // Filter out nulls and sort alphabetically
    const sortedFiles = fileDetails
      .filter((item): item is FileInfo => item !== null)
      .sort((a, b) => a.file.localeCompare(b.file));

    // List files with basic information
    for (const fileInfo of sortedFiles) {
      if (fileInfo.isDirectory) {
        fileInfos.push(`Directory: ${fileInfo.file}/`);
      } else {
        fileInfos.push(`File: ${fileInfo.file} (${Math.round(fileInfo.size / 1024)}KB)`);
      }
    }

    if (sortedFiles.length === 0) {
      throw new FileProcessingError("No readable files found in folder", "NO_FILES");
    }

    requestConfig.fileContent = fileInfos.join("\n");
    requestConfig.contentType = "text/plain";

    // Update toast to success
    if (toast) {
      toast.style = Toast.Style.Success;
      toast.title = "Folder Processed";
      toast.message = "Folder structure analyzed for naming suggestions";
    }

    return true;
  } catch (error) {
    debugLog("Error processing folder:", error);
    if (toast) {
      toast.style = Toast.Style.Failure;
      toast.title = "Folder Processing Error";
      toast.message = error instanceof Error ? error.message : "Unknown error occurred";
    } else {
      await showErrorToast(
        error instanceof Error ? error : new Error("Unknown error"),
        "processing folder",
      );
    }
    return false;
  }
}

// Define the structure of the request config
export interface RequestConfig {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  fileContent: string;
  contentType: string;
  documentType: string;
  patternInstructions?: boolean;
  patternFormat?: string; // Add pattern from preset
}
