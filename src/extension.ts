import * as vscode from 'vscode';
import { exec } from 'child_process';
import { spawn } from 'child_process';

class CPHelperViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cpHelperView';
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
          webviewView.webview.postMessage({ command: 'testResult', results });
          break;
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <title>CP Helper</title>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
        <style nonce="${nonce}">
            /* Your CSS styles */
        </style>
        </head>
        <body>
        <div id="test-cases">
            <!-- Test cases will be dynamically added here -->
        </div>
        <button id="add-test-case">Add New Test Case</button>
        <button id="run-all">Run All</button>

        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();

            // Your JavaScript code to handle test cases
            document.getElementById('run-all').addEventListener('click', () => {
                vscode.postMessage({ command: 'runAllTests', testCases });
            });

            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'testResult':
                        // Update UI with test result
                        break;
                }
            });

        </script>
        </body>
        </html>
    `;
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

  console.log('CP Helper extension is now active!');

  const provider = new CPHelperViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CPHelperViewProvider.viewType, provider)
  );

  let createNewFile = vscode.commands.registerCommand('cp-helper.createNewFile', createNewFileHandler);
  let createContest = vscode.commands.registerCommand('cp-helper.createContest', createContestHandler);
  let markAsAC = vscode.commands.registerCommand('cp-helper.markAsAC', () => markProblem('AC'));
  let markAsWA = vscode.commands.registerCommand('cp-helper.markAsWA', () => markProblem('WA'));

  context.subscriptions.push(createNewFile, createContest, markAsAC, markAsWA);
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

  // Header content
  const now = new Date();
  const header = `// Problem URL: ${url}\n// Start Time: ${now.toLocaleString()}\n\n`;

  try {
    // Create the file with header
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(header, 'utf8'));
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