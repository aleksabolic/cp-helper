import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { TestCase } from '../types/testCase';
import { ConfigService } from './configService';

export async function runAllTests(testCases: TestCase[]) {
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
      const result = await runTestCase(tempExecPath, testCase.input, testCase.expectedOutput);
      testCase.status = result.status;
      testCase.actualOutput = result.output;
      if(result.error){
        testCase.error = result.error;
      }
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Compilation Error: ${err.message}`);
  } finally {
    // Clean up the temporary executable
    if (fs.existsSync(tempExecPath)) {
      fs.unlinkSync(tempExecPath);
    }
  }
}

export async function runTestCase(execPath: string, input: string, expectedOutput: string): Promise<any> {
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
    }, ConfigService.timeoutDuration); 

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

export function execPromise(command: string): Promise<void> {
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