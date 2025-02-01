import * as vscode from 'vscode';

export async function addCategoriesHandler() {
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

export function insertCategoriesIntoHeader(editor: vscode.TextEditor, categories: string[]) {
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