import * as vscode from 'vscode';
import {pickFolder} from '../utils/fileUtils'
import {getTemplate} from '../utils/templateManager'

export async function createNewFileHandler() {
  const url = await vscode.window.showInputBox({ prompt: 'Enter problem URL' });
  if (!url) return;

  const fileName = await vscode.window.showInputBox({ prompt: 'Enter file name' });
  if (!fileName) return;

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  // Let the user pick any folder recursively starting from the workspace root.
  const targetFolder = await pickFolder(workspaceFolders[0].uri);
  if (!targetFolder) return;

  const fileUri = vscode.Uri.joinPath(targetFolder, `${fileName}.cpp`);

  try {
    await vscode.workspace.fs.stat(fileUri);
    vscode.window.showErrorMessage(`File "${fileName}.cpp" already exists.`);
    return;
  } catch (error: any) {
    if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
      // File does not exist, proceed.
    } else {
      vscode.window.showErrorMessage(`Error checking file existence: ${error.message}`);
      return;
    }
  }
  
  const now = new Date();
  const header = `// Problem URL: ${url}\n// Start Time: ${now.toLocaleString()}\n\n`;
  const template = await getTemplate();

  try {
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(header + template, 'utf8'));
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to create file: ${err.message}`);
  }
}

export async function createContestHandler() {
  const url = await vscode.window.showInputBox({ prompt: 'Enter contest URL' });
  if (!url) return;

  const contestName = await vscode.window.showInputBox({ prompt: 'Enter contest name' });
  if (!contestName) return;

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