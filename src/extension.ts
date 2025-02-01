import * as vscode from 'vscode';
import { exec } from 'child_process';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

class CPHelperViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cp-helper.cpHelperView';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.command) {
        case 'runAllTests':
          const results = await runAllTests(message.testCases);
          webviewView.webview.postMessage({ command: 'testResult', results: results });
          break;
        case 'submitTestCase':
          const result = await runAllTests([message.testCase]);
          webviewView.webview.postMessage({ command: 'singleResult', result: result[0], index: message.index });
          break;
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    // Path to the HTML file
    const htmlPath = path.join(this._extensionUri.fsPath, 'media', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts.js'));

    // Replace the NONCE_PLACEHOLDER with the actual nonce
    html = html.replace(/NONCE_PLACEHOLDER/g, nonce)
               .replace('styles.css', styleUri.toString())
               .replace('scripts.js', scriptUri.toString());

    return html;
  }
}  

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function activate(context: vscode.ExtensionContext) {

  const provider = new CPHelperViewProvider(context.extensionUri);  
  context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(CPHelperViewProvider.viewType, provider)
  );

  let createNewFile = vscode.commands.registerCommand('cp-helper.createNewFile', createNewFileHandler);
  let createContest = vscode.commands.registerCommand('cp-helper.createContest', createContestHandler);
  let markAsAC = vscode.commands.registerCommand('cp-helper.markAsAC', () => markProblem('AC'));
  let markAsWA = vscode.commands.registerCommand('cp-helper.markAsWA', () => markProblem('WA'));
  let copyCode = vscode.commands.registerCommand('cp-helper.copyCode', copyNoHeaders);

  context.subscriptions.push(createNewFile, createContest, markAsAC, markAsWA, copyCode);


  // Create file and contest status bar icon 
  let myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  myStatusBarItem.text = `$(new-file) Create new file`;
  myStatusBarItem.tooltip = 'Create a new file with the template';
  myStatusBarItem.command = 'cp-helper.createNewFile';
  myStatusBarItem.show();

  const createContestButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);  
  createContestButton.text = '$(new-folder) Create Contest';
  createContestButton.tooltip = 'Create a new contest folder with multiple files';
  createContestButton.command = 'cp-helper.createContest';
  createContestButton.show();

  context.subscriptions.push(myStatusBarItem, createContestButton);

  // Add categories command
  const addCategoriesCommand = vscode.commands.registerCommand('cp-helper.addCategories', async () => {
    await addCategoriesHandler();
  });

  context.subscriptions.push(addCategoriesCommand);
}

async function runAllTests(testCases: any[]): Promise<any[]> {
  const results = [];

  // Check if workspaceFolders is defined
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return [];
  }

  // Get the current file path
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return [];
  }
  const filePath = editor.document.uri.fsPath;

  // Generate a temporary executable path in the system's temp directory
  const tempExecPath = path.join(os.tmpdir(), `temp_exec_${Date.now()}`);

  const compileCommand = `g++ -o "${tempExecPath}" "${filePath}"`;

  try {
    // Compile the program
    await execPromise(compileCommand);

    for (const testCase of testCases) {
      const { input, expectedOutput } = testCase;
      const result = await runTestCase(tempExecPath, input, expectedOutput);
      results.push(result);
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Compilation Error: ${err.message}`);
  } finally {
    // Clean up the temporary executable
    if (fs.existsSync(tempExecPath)) {
      fs.unlinkSync(tempExecPath);
    }
  }

  return results;
}

function execPromise(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, (error: any, stdout: string, stderr: string) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function runTestCase(execPath: string, input: string, expectedOutput: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = spawn(execPath);

    let output = '';
    child.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    let errorOutput = '';
    child.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    let isTimeout = false;
    const timeout = setTimeout(() => {
      isTimeout = true;
      child.kill();
    }, 2000); // Set a timeout of 2 seconds 

    child.stdin.write(input);
    child.stdin.end();

    child.on('close', (code: number) => {
      clearTimeout(timeout);

      if (isTimeout) {
        resolve({ status: 'TLE', output: '' });
      } else if (code !== 0) {
        resolve({ status: 'RTE', output: errorOutput });
      } else {
        const status = output.trim() === expectedOutput.trim() ? 'AC' : 'WA';
        resolve({ status, output });
      }
    });

    child.on('error', (err: any) => {
      resolve({ status: 'RTE', output: '', error: err.message });
    });
  });
}

async function getTemplate() {
  const config = vscode.workspace.getConfiguration('cp-helper');
  const customTemplatePath = config.get<string>('templatePath');

  let templatePath = customTemplatePath;

  // Fallback to the extension's template if the custom path is not set or invalid
  if (!templatePath) {
    const extensionPath = vscode.extensions.getExtension('cp-helper.cp-helper')?.extensionPath;
    if (!extensionPath) {
      vscode.window.showErrorMessage('Unable to locate extension folder');
      return;
    }
    templatePath = `${extensionPath}/templates/main.cpp`;
  }

  const templateUri = vscode.Uri.file(templatePath);

  let template = '';
  try {
    const templateFile = await vscode.workspace.fs.readFile(templateUri);
    template = templateFile.toString();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to load template: ${err.message}`);
    return;
  }

  return template;
}

async function pickFolder(currentUri: vscode.Uri): Promise<vscode.Uri | undefined> {
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

async function createNewFileHandler() {
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

async function createContestHandler() {
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

async function markProblem(result: string) {
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

async function addCategoriesHandler() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found.');
    return;
  }

  const config = vscode.workspace.getConfiguration('cp-helper');
  const categoriesList: string[] = config.get('categories', []);

  if (categoriesList.length === 0) {
    vscode.window.showErrorMessage('No categories available. Please configure the categories list.');
    return;
  }

  const selectedCategories = await vscode.window.showQuickPick(categoriesList, {
    canPickMany: true,
    placeHolder: 'Select categories for the problem',
  });

  if (!selectedCategories || selectedCategories.length === 0) {
    vscode.window.showInformationMessage('No categories selected.');
    return;
  }

  // Insert categories into the file header
  insertCategoriesIntoHeader(editor, selectedCategories);
}

function insertCategoriesIntoHeader(editor: vscode.TextEditor, categories: string[]) {
  const document = editor.document;

  const categoriesLine = `// Categories: ${categories.join(', ')}\n`;

  const text = document.getText();
  const lines = text.split(/\r?\n/);

  let insertPosition = new vscode.Position(0, 0);
  let headerEndLine = -1;

  // Look for existing header comments
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('//')) {
      if (line.startsWith('// Categories:')) {
        // Replace existing categories line
        const range = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i + 1, 0));
        editor.edit(editBuilder => {
          editBuilder.replace(range, categoriesLine);
        });
        vscode.window.showInformationMessage('Categories updated in the header.');
        return;
      }
    } else if (line === '') {
      // Skip empty lines
      continue;
    } else {
      // End of header comments
      headerEndLine = i;
      break;
    }
  }

  if (headerEndLine === -1) {
    // No existing header found, insert at the top
    headerEndLine = 0;
  }

  insertPosition = new vscode.Position(headerEndLine, 0);

  editor.edit(editBuilder => {
    editBuilder.insert(insertPosition, categoriesLine);
  }).then(success => {
    if (success) {
      vscode.window.showInformationMessage('Categories added to the header.');
    } else {
      vscode.window.showErrorMessage('Failed to insert categories into the header.');
    }
  });
}

async function copyNoHeaders() {
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