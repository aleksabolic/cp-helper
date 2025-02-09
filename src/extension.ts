import * as vscode from 'vscode';
import { CPHelperViewProvider } from './providers/webviewProvider';
import * as commands from './commands';
import { STATUS_BAR_ITEMS, COMMAND_PREFIX } from './constants';


export function activate(context: vscode.ExtensionContext) {

  const provider = new CPHelperViewProvider(context.extensionUri);  
  context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(CPHelperViewProvider.viewType, provider)
  );

  // Register Commands
  const registeredCommands = [
    { name: 'createNewFile', handler: commands.createNewFileHandler },
    { name: 'createContest', handler: commands.createContestHandler },
    { name: 'markAsAC', handler: () => commands.markProblem('AC') },
    { name: 'markAsWA', handler: () => commands.markProblem('WA') },
    { name: 'copyCode', handler: commands.copyNoHeaders },
    { name: 'addCategories', handler: commands.addCategoriesHandler },
    { name: 'openLatexFile', handler: commands.openLatexFile }
  ];

  registeredCommands.forEach(({ name, handler }) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(`${COMMAND_PREFIX}${name}`, handler)
    );
  });

  setupStatusBar(context);
}

function setupStatusBar(context: vscode.ExtensionContext) {
  const statusBarItems = [
    vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100),
    vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99)
  ];

  statusBarItems[0] = Object.assign(statusBarItems[0], STATUS_BAR_ITEMS.CREATE_FILE);
  statusBarItems[1] = Object.assign(statusBarItems[1], STATUS_BAR_ITEMS.CREATE_CONTEST);

  statusBarItems.forEach(item => {
    item.show();
    context.subscriptions.push(item);
  });
}
















