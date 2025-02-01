import * as vscode from 'vscode';

export class ConfigService {
  static get categories(): string[] {
    return vscode.workspace.getConfiguration('cp-helper').get('categories') || [];
  }

  static get templatePath(): string {
    return vscode.workspace.getConfiguration('cp-helper').get('templatePath') || '';
  }
  
  static get timeoutDuration(): number {
    return vscode.workspace.getConfiguration('cp-helper').get('timeout') || 2000;
  }
}