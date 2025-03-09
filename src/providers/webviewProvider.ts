import {runAllTests} from '../utils/testRunner'
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class CPHelperViewProvider implements vscode.WebviewViewProvider {
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
      if(message.command == 'runTests'){
        await runAllTests(message.testCases);
        webviewView.webview.postMessage({ command: 'testResult', results: message.testCases });
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Use a nonce to whitelist which scripts can be run
    const nonce = this.getNonce();

    // Path to the HTML file
    const htmlPath = path.join(this._extensionUri.fsPath, 'media', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'main.js'));

    // Replace the NONCE_PLACEHOLDER with the actual nonce
    html = html.replace(/NONCE_PLACEHOLDER/g, nonce)
               .replace('styles.css', styleUri.toString())
               .replace('scripts.js', scriptUri.toString());

    return html;
  }

  private getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
} 