import * as vscode from 'vscode';
import {pickFolder} from '../utils/fileUtils'
import {getTemplate, getLatexTemplate} from '../utils/templateManager'
import { handleError } from '../utils/errorHandler';

export async function createNewFileHandler() {
  // Get the problem URL.
  const url = await vscode.window.showInputBox({ prompt: 'Enter problem URL' });
  if (!url) return;

  // Get the file name.
  const fileName = await vscode.window.showInputBox({ prompt: 'Enter file name' });
  if (!fileName) return;
  if (!validateFileName(fileName)) {
    vscode.window.showErrorMessage('Invalid file name');
    return;
  }

  // Ensure there is an open workspace.
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  // Let the user pick a folder recursively starting from the workspace root.
  const targetFolder = await pickFolder(workspaceFolders[0].uri);
  if (!targetFolder) return;

  // Construct the C++ file URI.
  const cppFileUri = vscode.Uri.joinPath(targetFolder, `${fileName}.cpp`);

  // Check if the C++ file already exists.
  try {
    await vscode.workspace.fs.stat(cppFileUri);
    vscode.window.showErrorMessage(`File "${fileName}.cpp" already exists.`);
    return;
  } catch (error: any) {
    if (!(error instanceof vscode.FileSystemError && error.code === 'FileNotFound')) {
      vscode.window.showErrorMessage(`Error checking file existence: ${error.message}`);
      return;
    }
  }
  
  const now = new Date();
  const header = `// Problem URL: ${url}\n// Start Time: ${now.toLocaleString()}\n\n`;
  const cppTemplate = await getTemplate();

  // Write the C++ file.
  try {
    await vscode.workspace.fs.writeFile(cppFileUri, Buffer.from(header + cppTemplate, 'utf8'));
  } catch (err: any) {
    handleError(err, "C++ File creation");
    return;
  }

  // Create the LaTeX file by calling a separate function.
  const workspaceRoot = workspaceFolders[0].uri;
  const latexFileUri = await createLatexFile(fileName, url, now, targetFolder, workspaceRoot);
  if (!latexFileUri) {
    // If LaTeX creation fails, open only the C++ file.
    const cppDoc = await vscode.workspace.openTextDocument(cppFileUri);
    await vscode.window.showTextDocument(cppDoc, { viewColumn: vscode.ViewColumn.One });
    return;
  }

  // Open both files in a split screen: left for the C++ file, right for the LaTeX file.
  try {
    const cppDoc = await vscode.workspace.openTextDocument(cppFileUri);
    const latexDoc = await vscode.workspace.openTextDocument(latexFileUri);
    await vscode.window.showTextDocument(cppDoc, { viewColumn: vscode.ViewColumn.One });
    await vscode.window.showTextDocument(latexDoc, { viewColumn: vscode.ViewColumn.Two });
  } catch (err: any) {
    handleError(err, "Opening files");
  }
}

export async function createContestHandler() {
  const url = await vscode.window.showInputBox({ prompt: 'Enter contest URL' });
  if (!url) return;

  const contestName = await vscode.window.showInputBox({ prompt: 'Enter contest name' });
  if (!contestName) return;
  if (!validateFileName(contestName)){
    vscode.window.showErrorMessage(`Invalid file name`);
  }

  const taskCountStr = await vscode.window.showInputBox({ prompt: 'Enter number of tasks' });
  if (!taskCountStr) return;
  const taskCount = parseInt(taskCountStr);
  if (isNaN(taskCount) || taskCount <= 0) {
    vscode.window.showErrorMessage('Invalid number of tasks');
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  // Let the user pick a folder recursively from the workspace root.
  const targetFolder = await pickFolder(workspaceFolders[0].uri);
  if (!targetFolder) return;

  const contestFolder = vscode.Uri.joinPath(targetFolder, contestName);

  try {
    await vscode.workspace.fs.createDirectory(contestFolder);

    const now = new Date();
    const header = `// Contest URL: ${url}\n// Start Time: ${now.toLocaleString()}\n\n`;
    const template = await getTemplate();

    for (let i = 0; i < taskCount; i++) {
      const taskName = String.fromCharCode(65 + i);
      const fileUri = vscode.Uri.joinPath(contestFolder, `${taskName}.cpp`);
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(header + template, 'utf8'));
    }

    vscode.window.showInformationMessage(`Contest "${contestName}" created with ${taskCount} tasks.`);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to create contest: ${err.message}`);
  }
}

function validateFileName(fileName: string): boolean {
  // Define invalid characters and reserved names (Windows-specific restrictions)
  const invalidChars = /[<>:"\/\\|?*\x00-\x1F]/;
  const reservedNames = [
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
  ];

  // Check if the filename is empty or too long
  if (!fileName || fileName.length > 255) {
    return false;
  }

  // Check for invalid characters
  if (invalidChars.test(fileName)) {
    return false;
  }

  // Check for reserved names (case-insensitive)
  if (reservedNames.includes(fileName.toUpperCase())) {
    return false;
  }

  return true;
}

async function createLatexFile(
  fileName: string,
  url: string,
  now: Date,
  targetFolder: vscode.Uri,
  workspaceRoot: vscode.Uri
): Promise<vscode.Uri | null> {
  // Compute the relative path of the target folder from the workspace root.
  const relativePath = vscode.workspace.asRelativePath(targetFolder);
  const pathSegments = relativePath ? relativePath.split(/[\/\\]+/) : [];
  // Build the LaTeX folder URI: workingDirectory/latex/path/to.
  const latexFolderUri = vscode.Uri.joinPath(workspaceRoot, 'latex', ...pathSegments);
  
  // Ensure the LaTeX directory exists.
  try {
    await vscode.workspace.fs.createDirectory(latexFolderUri);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Error creating LaTeX directory: ${err.message}`);
    return null;
  }

  // Construct the LaTeX file URI.
  const latexFileUri = vscode.Uri.joinPath(latexFolderUri, `${fileName}.tex`);

  // Check if the LaTeX file already exists.
  try {
    await vscode.workspace.fs.stat(latexFileUri);
    vscode.window.showErrorMessage(`LaTeX file "${fileName}.tex" already exists.`);
    return null;
  } catch (error: any) {
    if (!(error instanceof vscode.FileSystemError && error.code === 'FileNotFound')) {
      vscode.window.showErrorMessage(`Error checking LaTeX file existence: ${error.message}`);
      return null;
    }
  }

  const latexHeader = `% Problem URL: ${url}\n% Start Time: ${now.toLocaleString()}\n\n`;
  const latexTemplate = await getLatexTemplate();

  // Write the LaTeX file.
  try {
    await vscode.workspace.fs.writeFile(latexFileUri, Buffer.from(latexHeader + latexTemplate, 'utf8'));
    return latexFileUri;
  } catch (err: any) {
    handleError(err, "LaTeX file creation");
    return null;
  }
}