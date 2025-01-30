const vscode = acquireVsCodeApi();
let testCaseCount = 0;

function autoResize(textarea, maxHeight) {
    textarea.style.height = "";
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px";
}

document.getElementById('add-test-case').addEventListener('click', () => {
    addTestCase();
});

document.getElementById('run-all').addEventListener('click', () => {
    const testCases = document.querySelectorAll('.test-case');
    const testCasesOut = [];

    testCases.forEach(testCase => {
        // Select the input and expected output fields
        const inputField = testCase.querySelector('textarea[id^="input-"]');
        const outputField = testCase.querySelector('textarea[id^="output-"]');

        // Ensure both fields exist before adding
        if (inputField && outputField) {
            const obj = {
                input: inputField.value.trim(),
                expectedOutput: outputField.value.trim()
            }
            testCasesOut.push(obj);
        }
    });

    // Send the collected data to VS Code
    vscode.postMessage({
        command: 'runAllTests',
        testCases: testCasesOut
    });

    updateState();
});

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'testResult':
            handleTestResults(message.results)
            break;
        case 'singleResult':
            handleSingleResult(message.result, message.index);
            break;       
    }
});

function addTestCase() {
    testCaseCount++;
    const testCasesContainer = document.getElementById('test-cases');
    
    const testCaseDiv = document.createElement('div');
    testCaseDiv.classList.add('test-case');
    testCaseDiv.id = `test-case-${testCaseCount}`;
    
    const testCaseTitle = document.createElement('p');
    testCaseTitle.textContent = `#${testCaseCount} Test Case`;
    testCaseTitle.style.fontWeight = 'bold';
    testCaseDiv.appendChild(testCaseTitle);
    
    // Create Input Textarea
    const inputLabel = document.createElement('label');
    inputLabel.textContent = 'Input:';
    inputLabel.htmlFor = `input-${testCaseCount}`;
    testCaseDiv.appendChild(inputLabel);
    
    const inputBox = document.createElement('textarea');
    inputBox.id = `input-${testCaseCount}`;
    inputBox.rows = 4; 
    inputBox.style.width = '100%'; 
    testCaseDiv.appendChild(inputBox);

    // Auto-resize on input
    const maxHeight = 200; // in px
    inputBox.addEventListener('input', () => autoResize(inputBox, maxHeight));

    // Auto-save the input box content
    inputBox.addEventListener('input', updateState);
    
    // Create Expected Output Textarea
    const outputLabel = document.createElement('label');
    outputLabel.textContent = 'Expected Output:';
    outputLabel.htmlFor = `output-${testCaseCount}`;
    testCaseDiv.appendChild(outputLabel);
    
    const outputBox = document.createElement('textarea');
    outputBox.id = `output-${testCaseCount}`;
    outputBox.rows = 4; 
    outputBox.style.width = '100%'; 
    testCaseDiv.appendChild(outputBox);

    // Auto-resize on input
    outputBox.addEventListener('input', () => autoResize(outputBox, maxHeight));

    // Auto-save the input box content
    outputBox.addEventListener('input', updateState);
    
    // Create Delete Button 
    const deleteButton = document.createElement('button');
    deleteButton.classList.add('btn', 'btn-delete');
    deleteButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="icon-delete" viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
            <path d="M5.5 5.5A.5.5 0 0 1 6 5h4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5v-7zM4.118 4 4 4.059V4.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V4.059L11.882 4H4.118zM14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1z"/>
        </svg>
        Delete
    `;
    deleteButton.addEventListener('click', () => {
        testCasesContainer.removeChild(testCaseDiv);
        updateState();
    });
    testCaseDiv.appendChild(deleteButton);
    
    // Create Submit Button with Checkmark Icon
    const submitButton = document.createElement('button');
    submitButton.classList.add('btn', 'btn-submit');
    submitButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="icon-submit" viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
            <path fill-rule="evenodd" d="M16 2.748l-3.39 4.94L8 10.5 3.39 11.688 1.5 12.5 3.89 9.606l1.608-2.34L16 2.748z"/>
        </svg>
        Submit
    `;
    let tempCount = testCaseCount;
    submitButton.addEventListener('click', () => {
        vscode.postMessage({
            command: 'submitTestCase',
            index: tempCount,
            testCase: {
                input: inputBox.value,
                expectedOutput: outputBox.value,
            }
        });
        updateState();
    });
    testCaseDiv.appendChild(submitButton);
    
    testCasesContainer.appendChild(testCaseDiv);
    
    updateState();
}

function handleSingleResult(result, index){
    const testCase = document.getElementById(`test-case-${index}`);

    testCase.classList.remove('passed', 'failed');

    const status = result.status;

    if (status == "AC") {
        testCase.classList.add('passed');
    } else {
        testCase.classList.add('failed');
    }

    // Optionally, display a result message within the test case
    displayTestResult(testCase, status, result.output);
    updateState();
}

function handleTestResults(results) {
    const testCases = document.querySelectorAll('.test-case');

    if (!Array.isArray(results)) {
        console.error('Invalid results format: Expected an array.');
        return;
    }

    if (results.length !== testCases.length) {
        console.warn('Number of results does not match number of test cases.');
    }

    testCases.forEach((testCase, index) => {
        // Remove existing status classes
        testCase.classList.remove('passed', 'failed');

        const result = results[index];
        const status = result.status;

        if (status == "AC") {
            testCase.classList.add('passed');
        } else {
            testCase.classList.add('failed');
        }
        displayTestResult(testCase, status, result.output);
    });

    updateState();
}

function displayTestResult(testCase, status, output) {
    // Remove any existing result message
    let resultMsg = testCase.querySelector('.result-message');
    if (resultMsg) {
        resultMsg.remove();
    }

    // Create a new result message element
    resultMsg = document.createElement('p');
    resultMsg.classList.add('result-message');
    resultMsg.textContent = status == "AC" ? '✅ Passed' : `❌ ${status}`;
    resultMsg.style.fontWeight = 'bold';
    resultMsg.style.marginTop = '10px';

    testCase.appendChild(resultMsg);

    // Remove any existing output message
    let outputMsg = testCase.querySelector('.output-message');
    if (outputMsg) {
        outputMsg.remove();
    }

    // Create a new output message element
    outputMsg = document.createElement('div');
    outputMsg.classList.add('output-message');
    outputMsg.style.marginTop = '5px';

    const outputLabel = document.createElement('p');
    outputLabel.textContent = 'Actual Output:';
    outputLabel.style.fontWeight = 'bold';

    const outputContent = document.createElement('pre');
    outputContent.textContent = output || 'No output';

    outputMsg.appendChild(outputLabel);
    outputMsg.appendChild(outputContent);

    testCase.appendChild(outputMsg);
    updateState();
}

function updateState() {
    const testCases = [];

    document.querySelectorAll('.test-case').forEach(testCase => {
        const input = testCase.querySelector('textarea[id^="input-"]').value.trim();
        const expectedOutput = testCase.querySelector('textarea[id^="output-"]').value.trim();
        const status = testCase.classList.contains('passed') ? "AC" : testCase.classList.contains('failed') ? "Failed" : "neutral";

        const outputMessage = testCase.querySelector('.output-message pre');
        const actualOutput = outputMessage ? outputMessage.textContent : '';

        testCases.push({ input, expectedOutput, status, actualOutput });
    });

    vscode.setState({ testCases });
}

window.addEventListener('DOMContentLoaded', () => {
    const state = vscode.getState();
    if (state && state.testCases) {
        state.testCases.forEach(testCase => addTestCaseWithData(testCase));
    }
});

function addTestCaseWithData(data) {
    addTestCase();
    const lastTestCase = document.querySelector(`.test-case:last-child`);

    const inputBox = lastTestCase.querySelector('textarea[id^="input-"]');
    const outputBox = lastTestCase.querySelector('textarea[id^="output-"]');

    inputBox.value = data.input;
    outputBox.value = data.expectedOutput;

    // Restore the status
    if (data.status === 'AC') {
        lastTestCase.classList.add('passed');
    } else if(data.status === 'Failed') {
        lastTestCase.classList.add('failed');
    }

    if (data.actualOutput) {
        displayTestResult(lastTestCase, data.status, data.actualOutput);
    }
}
