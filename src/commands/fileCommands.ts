import * as vscode from 'vscode';
import {pickFolder, validateFileName, getHeader, checkFileDoesNotExist} from '../utils/fileUtils'
import {getTemplate, getLatexTemplate} from '../utils/templateManager'
import { handleError } from '../utils/errorHandler';
import { ConfigService } from '../utils/configService';


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
  if (!(await checkFileDoesNotExist(cppFileUri, `${fileName}.cpp`))) return;
  
  const header = getHeader(url);
  const cppTemplate = await getTemplate();

  // Write the C++ file.
  try {
    await vscode.workspace.fs.writeFile(cppFileUri, Buffer.from(header + cppTemplate, 'utf8'));
  } catch (err: any) {
    handleError(err, "C++ File creation");
    return;
  }

  // Open the C++ file.
  const cppDoc = await vscode.workspace.openTextDocument(cppFileUri);
  await vscode.window.showTextDocument(cppDoc);
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

    const header = getHeader(url);
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
