import * as vscode from 'vscode';
import { exec } from 'child_process';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

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
    const htmlPath = path.join(this._extensionUri.fsPath, 'media', 'cpHelper.html');
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

  context.subscriptions.push(createNewFile, createContest, markAsAC, markAsWA);


  // Create file status bar icon 
  let myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  myStatusBarItem.text = `$(plus) Create new file`;
  myStatusBarItem.command = 'cp-helper.createNewFile';
  myStatusBarItem.show();

  context.subscriptions.push(myStatusBarItem);

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

  // Compile the program
  const tempExecPath = vscode.Uri.joinPath(workspaceFolders[0].uri, 'exec', 'temp').fsPath;
  const compileCommand = `g++ -o "${tempExecPath}" "${filePath}"`;

  try {
    await execPromise(compileCommand);

    for (const testCase of testCases) {
      const { input, expectedOutput } = testCase;
      const result = await runTestCase(tempExecPath, input, expectedOutput);
      results.push(result);
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Compilation Error: ${err.message}`);
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
    }, 2000); // Set a timeout of 2 seconds (adjust as needed)

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

async function createNewFileHandler() {
  const url = await vscode.window.showInputBox({ prompt: 'Enter problem URL' });
  if (!url) return;

  const platforms = ['Codeforces', 'CSES', 'USACO', 'Petlja', 'Others'];
  const platform = await vscode.window.showQuickPick(platforms, { placeHolder: 'Select Platform' });
  if (!platform) return;

  const fileName = await vscode.window.showInputBox({ prompt: 'Enter file name' });
  if (!fileName) return;

  // Construct the file path
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const platformFolder = vscode.Uri.joinPath(workspaceFolders[0].uri, platform);
  const fileUri = vscode.Uri.joinPath(platformFolder, `${fileName}.cpp`);

  // Check if the file already exists and return if it does 
  try {
    await vscode.workspace.fs.stat(fileUri);
    vscode.window.showErrorMessage(`File "${fileName}.cpp" already exists.`);
    return;
  } catch (error: any) {
    if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
      // File does not exist, proceed with creation
    } else {
      vscode.window.showErrorMessage(`Error checking file existence: ${error.message}`);
      return;
    }
  }
  
  // Header content
  const now = new Date();
  const header = `// Problem URL: ${url}\n// Start Time: ${now.toLocaleString()}\n\n`;

  // Path to the template folder inside your extension's directory
  const extensionPath = vscode.extensions.getExtension('retard.cp-helper')?.extensionPath;
  if (!extensionPath) {
    vscode.window.showErrorMessage('Unable to locate extension folder');
    return;
  }

  const templateUri = vscode.Uri.file(`${extensionPath}/templates/main.cpp`);

  let template = '';
  try {
    // Read the template file content
    const templateFile = await vscode.workspace.fs.readFile(templateUri);
    template = templateFile.toString();
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to load template: ${err.message}`);
    return;
  }

  try {
    // Create the file with header
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(header + template, 'utf8'));
    // Open the file
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to create file: ${err.message}`);
  }
}
  
async function createContestHandler() {
  const platforms = ['Codeforces', 'CSES', 'USACO', 'Petlja', 'Others'];
  const platform = await vscode.window.showQuickPick(platforms, { placeHolder: 'Select Platform' });
  if (!platform) return;

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

  const contestFolder = vscode.Uri.joinPath(workspaceFolders[0].uri, platform, contestName);

  try {
    // Create contest folder
    await vscode.workspace.fs.createDirectory(contestFolder);

    const now = new Date();
    const header = `// Start Time: ${now.toLocaleString()}\n\n`;

    for (let i = 0; i < taskCount; i++) {
      const taskName = String.fromCharCode(65 + i);
      const fileUri = vscode.Uri.joinPath(contestFolder, `${taskName}.cpp`);
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(header, 'utf8'));
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
