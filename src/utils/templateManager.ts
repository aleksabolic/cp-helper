import * as vscode from 'vscode';
import { ConfigService } from './configService';
import { handleError } from './errorHandler';

export async function getTemplate() {
  let templatePath = ConfigService.templatePath;

  // Fallback to the extension's template if the custom path is not set or invalid
  if (!templatePath) {
    return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main()\n{\n   return 0;\n}';
  }

  try {
    let templateUri = vscode.Uri.file(templatePath);
    const templateFile = await vscode.workspace.fs.readFile(templateUri);
    return templateFile.toString();
  } catch (err: any) {
    handleError(err, "Template");
    return '';
  }
}

export async function getLatexTemplate(){
  let templatePath = ConfigService.latexTemplatePath;

  if (!templatePath) {
    return "\\documentclass{article}\n\\begin{document}\nYour content here.\n\\end{document}";
  }

  try {
    let templateUri = vscode.Uri.file(templatePath);
    const templateFile = await vscode.workspace.fs.readFile(templateUri);
    return templateFile.toString();
  } catch (err: any) {
    handleError(err, "Latex template");
    return '';
  }
}
