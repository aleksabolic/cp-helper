import * as vscode from 'vscode';

export function handleError(error: unknown, context: string): void {
  const message = error instanceof Error ? error.message : String(error);
  vscode.window.showErrorMessage(`${context}: ${message}`);
  console.error(`[${context}]`, error);
}