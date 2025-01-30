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
        <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="16" height="16" viewBox="0 0 48 48">
        <path d="M 24 4 C 20.491685 4 17.570396 6.6214322 17.080078 10 L 10.238281 10 A 1.50015 1.50015 0 0 0 9.9804688 9.9785156 A 1.50015 1.50015 0 0 0 9.7578125 10 L 6.5 10 A 1.50015 1.50015 0 1 0 6.5 13 L 8.6386719 13 L 11.15625 39.029297 C 11.427329 41.835926 13.811782 44 16.630859 44 L 31.367188 44 C 34.186411 44 36.570826 41.836168 36.841797 39.029297 L 39.361328 13 L 41.5 13 A 1.50015 1.50015 0 1 0 41.5 10 L 38.244141 10 A 1.50015 1.50015 0 0 0 37.763672 10 L 30.919922 10 C 30.429604 6.6214322 27.508315 4 24 4 z M 24 7 C 25.879156 7 27.420767 8.2681608 27.861328 10 L 20.138672 10 C 20.579233 8.2681608 22.120844 7 24 7 z M 11.650391 13 L 36.347656 13 L 33.855469 38.740234 C 33.730439 40.035363 32.667963 41 31.367188 41 L 16.630859 41 C 15.331937 41 14.267499 40.033606 14.142578 38.740234 L 11.650391 13 z M 20.476562 17.978516 A 1.50015 1.50015 0 0 0 19 19.5 L 19 34.5 A 1.50015 1.50015 0 1 0 22 34.5 L 22 19.5 A 1.50015 1.50015 0 0 0 20.476562 17.978516 z M 27.476562 17.978516 A 1.50015 1.50015 0 0 0 26 19.5 L 26 34.5 A 1.50015 1.50015 0 1 0 29 34.5 L 29 19.5 A 1.50015 1.50015 0 0 0 27.476562 17.978516 z"></path>
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
        <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="16" height="16" viewBox="0 0 30 30">
        <path d="M 15 3 C 12.031398 3 9.3028202 4.0834384 7.2070312 5.875 A 1.0001 1.0001 0 1 0 8.5058594 7.3945312 C 10.25407 5.9000929 12.516602 5 15 5 C 20.19656 5 24.450989 8.9379267 24.951172 14 L 22 14 L 26 20 L 30 14 L 26.949219 14 C 26.437925 7.8516588 21.277839 3 15 3 z M 4 10 L 0 16 L 3.0507812 16 C 3.562075 22.148341 8.7221607 27 15 27 C 17.968602 27 20.69718 25.916562 22.792969 24.125 A 1.0001 1.0001 0 1 0 21.494141 22.605469 C 19.74593 24.099907 17.483398 25 15 25 C 9.80344 25 5.5490109 21.062074 5.0488281 16 L 8 16 L 4 10 z"></path>
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
