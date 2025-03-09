import * as vscode from 'vscode';

export async function pickFolder(currentUri: vscode.Uri): Promise<vscode.Uri | undefined> {
  // Read all items in the current folder
  let items: [string, vscode.FileType][] = [];
  try {
    items = await vscode.workspace.fs.readDirectory(currentUri);
  } catch {
    return;
  }

  let ignoreList: string[] = [];
  const ignoreEntry = items.find(
    ([name, fileType]) => name === '.cphignore' && (fileType & vscode.FileType.File)
  );
  if (ignoreEntry) {
    const ignoreUri = vscode.Uri.joinPath(currentUri, '.cphignore');
    try {
      const fileContent = await vscode.workspace.fs.readFile(ignoreUri);
      // Decode the file content as UTF-8
      const contentStr = new TextDecoder('utf-8').decode(fileContent);
      ignoreList = contentStr
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    } catch (err) {
      console.error("Error reading .cphignore:", err);
    }
  }

  // Filter out subfolders from all items
  const subfolders = items
    .filter(([_, fileType]) => fileType === vscode.FileType.Directory)
    .map(([name]) => name)
    .filter(name => !ignoreList.includes(name));

  // Build QuickPick items
  const pickItems = [
    { label: '.', description: 'Use current folder' },
    ...subfolders.map(name => ({ label: name })),
    { label: 'Create new folder', description: 'Make a new subfolder' }
  ];

  const choice = await vscode.window.showQuickPick(pickItems, {
    placeHolder: `Folder: ${currentUri.fsPath}`
  });
  if (!choice) return;

  // If user picks '.', return currentUri
  if (choice.label === '.') {
    return currentUri;
  }

  // If user picks 'Create new folder', prompt for name, create it, then recurse
  if (choice.label === 'Create new folder') {
    const folderName = await vscode.window.showInputBox({ prompt: 'Enter new folder name' });
    if (!folderName) return;

    const newFolderUri = vscode.Uri.joinPath(currentUri, folderName);
    try {
      await vscode.workspace.fs.createDirectory(newFolderUri);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Error creating folder: ${err.message}`);
      return;
    }
    return pickFolder(newFolderUri);
  }

  // Otherwise, user picked a subfolder
  const subfolderUri = vscode.Uri.joinPath(currentUri, choice.label);
  return pickFolder(subfolderUri);
}

export function validateFileName(fileName: string): boolean {
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

export function getHeader(url: string): string {
  const now = new Date();
  const header = `// Problem URL: ${url}\n// Start Time: ${now.toLocaleString()}\n\n`;
  return header
}

export async function checkFileDoesNotExist(fileUri: vscode.Uri, fileDisplayName: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(fileUri);
    vscode.window.showErrorMessage(`File "${fileDisplayName}" already exists.`);
    return false;
  } catch (error: any) {
    if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
      return true;
    } else {
      vscode.window.showErrorMessage(`Error checking file existence: ${error.message}`);
      return false;
    }
  }
}