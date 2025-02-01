import * as vscode from 'vscode';

export async function pickFolder(currentUri: vscode.Uri): Promise<vscode.Uri | undefined> {
  // Read all items in the current folder
  let items: [string, vscode.FileType][] = [];
  try {
    items = await vscode.workspace.fs.readDirectory(currentUri);
  } catch {
    return;
  }

  // Filter out subfolders from all items
  const subfolders = items
    .filter(([_, fileType]) => fileType === vscode.FileType.Directory)
    .map(([name]) => name);

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

