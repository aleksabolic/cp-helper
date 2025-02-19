import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigService } from '../utils/configService';
import { getLatexTemplate } from '../utils/templateManager';


export async function openLatexFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found.");
    return;
  }

  const activeFileUri = editor.document.uri;
  if (!activeFileUri.fsPath.endsWith(".cpp")) {
    vscode.window.showErrorMessage("The active file is not a C++ file.");
    return;
  }

  // Get the workspace folder for the active file.
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeFileUri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("The active file is not in a workspace.");
    return;
  }
  const workspaceRoot = workspaceFolder.uri;

  // Compute the relative path from the workspace root to the active file's folder.
  const activeFileFolder = path.dirname(activeFileUri.fsPath);
  const relativePath = vscode.workspace.asRelativePath(vscode.Uri.file(activeFileFolder));
  // Get the base file name (without extension).
  const baseName = path.basename(activeFileUri.fsPath, ".cpp");

  // Use new folder destination: workspaceRoot/latex/<relativePath>/<baseName>/<baseName>.tex
  const latexFolderUri = vscode.Uri.joinPath(
    workspaceRoot,
    "latex",
    ...relativePath.split(/[\/\\]+/),
    baseName
  );
  const latexFileUri = vscode.Uri.joinPath(latexFolderUri, `${baseName}.tex`);

  // Check if the LaTeX file exists.
  try {
    await vscode.workspace.fs.stat(latexFileUri);
    // File exists: open it.
    const texDoc = await vscode.workspace.openTextDocument(latexFileUri);
    await vscode.window.showTextDocument(texDoc, { viewColumn: vscode.ViewColumn.Two});
  } catch (err) {
    // File doesn't exist.
    await vscode.workspace.fs.createDirectory(latexFolderUri);

    const latexTemplate = await getLatexTemplate(); 
    await vscode.workspace.fs.writeFile(latexFileUri, Buffer.from(latexTemplate, "utf8"));

    const texDoc = await vscode.workspace.openTextDocument(latexFileUri);
    await vscode.window.showTextDocument(texDoc, { viewColumn: vscode.ViewColumn.Two});
  }
}
