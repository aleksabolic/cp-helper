import * as vscode from 'vscode';

export async function getTemplate() {
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
