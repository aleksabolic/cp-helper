import * as vscode from 'vscode';

export async function markProblem(result: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const document = editor.document;
  const now = new Date();
  const finishLine = `// Finish Time: ${now.toLocaleString()} ${result}`;

  const edit = new vscode.WorkspaceEdit();
  const firstLine = document.lineAt(0);

  // Check if Finish Time already exists
  const finishTimeRegex = /^\/\/ Finish Time:.*$/;
  let insertPosition: vscode.Position;
  if (finishTimeRegex.test(firstLine.text)) {
    // Replace existing Finish Time
    insertPosition = new vscode.Position(0, 0);
    edit.replace(document.uri, firstLine.range, finishLine);
  } else {
    // Insert after Start Time
    insertPosition = new vscode.Position(1, 0);
    edit.insert(document.uri, insertPosition, finishLine + '\n');
  }

  await vscode.workspace.applyEdit(edit);
  await document.save();
}

export async function copyNoHeaders() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const document = editor.document;
  const text = document.getText();

  // Split the text into lines
  const lines = text.split(/\r?\n/);
  let startLine = 0;

  // find first #
  for(startLine; startLine<lines.length; startLine++){
    if(lines[startLine].trim().startsWith('#')){break;} 
  }
  
  // Get the code without headers
  const codeWithoutHeaders = lines.slice(startLine).join('\n');

  // Copy the code to the clipboard
  await vscode.env.clipboard.writeText(codeWithoutHeaders);
  vscode.window.showInformationMessage('Code without headers copied to clipboard.');
}