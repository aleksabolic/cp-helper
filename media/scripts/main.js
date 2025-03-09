const vscode = acquireVsCodeApi();
let testCaseCount = 0;
let TEST_CASES = [];


function addTestCase(data) {
    const testCasesContainer = document.getElementById('test-cases');
    
    const testCaseDiv = document.createElement('div');
    testCaseDiv.classList.add('test-case');
    testCaseDiv.id = `test-case-${data.id}`;
    
    // Title
    const testCaseTitle = document.createElement('p');
    testCaseTitle.textContent = `#${data.id} Test Case`;
    testCaseTitle.style.fontWeight = 'bold';
    testCaseDiv.appendChild(testCaseTitle);
    
    // Input Textarea
    const inputLabel = document.createElement('label');
    inputLabel.textContent = 'Input:';
    inputLabel.htmlFor = `input-${data.id}`;
    testCaseDiv.appendChild(inputLabel);
    
    const inputBox = document.createElement('textarea');
    inputBox.id = `input-${data.id}`;
    inputBox.rows = 4; 
    inputBox.style.width = '100%'; 
    inputBox.value = data.input;
    testCaseDiv.appendChild(inputBox);

    // Auto-resize on input
    const maxHeight = 200; // in px
    inputBox.addEventListener('input', () => autoResize(inputBox, maxHeight));

    // Auto-save the input box content
    inputBox.addEventListener('input', function(e){
        data.input = e.target.value; // this works because obj are passed by ref
        updateState();
    });
    
    // Expected Output Textarea
    const outputLabel = document.createElement('label');
    outputLabel.textContent = 'Expected Output:';
    outputLabel.htmlFor = `output-${data.id}`;
    testCaseDiv.appendChild(outputLabel);
    
    const outputBox = document.createElement('textarea');
    outputBox.id = `output-${data.id}`;
    outputBox.rows = 4; 
    outputBox.style.width = '100%'; 
    outputBox.value = data.expectedOutput;
    testCaseDiv.appendChild(outputBox);

    // Auto-resize on input
    outputBox.addEventListener('input', () => autoResize(outputBox, maxHeight));

    // Auto-save the input box content
    outputBox.addEventListener('input', function(e){
        data.expectedOutput = e.target.value;
        updateState();
    });
    
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
        TEST_CASES = TEST_CASES.filter(tc => tc.id !== data.id);
        // TODO: figure out delete logic
        updateState();
    });
    
    // Submit Button
    const submitButton = document.createElement('button');
    submitButton.classList.add('btn', 'btn-submit');
    submitButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="16" height="16" viewBox="0 0 30 30">
        <path d="M 15 3 C 12.031398 3 9.3028202 4.0834384 7.2070312 5.875 A 1.0001 1.0001 0 1 0 8.5058594 7.3945312 C 10.25407 5.9000929 12.516602 5 15 5 C 20.19656 5 24.450989 8.9379267 24.951172 14 L 22 14 L 26 20 L 30 14 L 26.949219 14 C 26.437925 7.8516588 21.277839 3 15 3 z M 4 10 L 0 16 L 3.0507812 16 C 3.562075 22.148341 8.7221607 27 15 27 C 17.968602 27 20.69718 25.916562 22.792969 24.125 A 1.0001 1.0001 0 1 0 21.494141 22.605469 C 19.74593 24.099907 17.483398 25 15 25 C 9.80344 25 5.5490109 21.062074 5.0488281 16 L 8 16 L 4 10 z"></path>
        </svg>
        Submit
    `;
    submitButton.addEventListener('click', () => {
        spinner.style.visibility = 'visible';

        vscode.postMessage({
            command: 'runTests',
            testCases: [data]
        });
    });

    // Spinner
    const spinner = document.createElement('div');
    spinner.classList.add('spinner');

    // *Button container is used to put submit and delete button in the same row as spinner*
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.alignItems = 'center';
    buttonContainer.style.gap = '2px'; 
    
    buttonContainer.appendChild(deleteButton);
    buttonContainer.appendChild(submitButton);
    buttonContainer.appendChild(spinner);
    testCaseDiv.appendChild(buttonContainer);

    // Test results 
    const testResults = document.createElement('div');
    testResults.classList.add('testResults');
    if(!data.status){
        testResults.style.display = 'none';
    } else if (data.status == "AC") {
        testCaseDiv.classList.add('passed');
    } else {
        testCaseDiv.classList.add('failed');
    }
    
    const resultMsg = document.createElement('p');
    resultMsg.classList.add('result-message');
    resultMsg.textContent = data.status == "AC" ? '✅ Passed' : `❌ ${data.status}`;
    testResults.appendChild(resultMsg);

    const outputMsg = document.createElement('div');
    outputMsg.classList.add('output-message');
    outputMsg.style.marginTop = '5px';

    const actualOutputLabel = document.createElement('p');
    actualOutputLabel.textContent = 'Actual Output:';
    actualOutputLabel.style.fontWeight = 'bold';
    
    const outputContent = document.createElement('pre');
    outputContent.classList.add('actual-output');
    outputContent.textContent = data.actualOutput || 'No output';

    outputMsg.appendChild(actualOutputLabel);
    outputMsg.appendChild(outputContent);
    testResults.appendChild(outputMsg);
    testCaseDiv.appendChild(testResults);

    testCasesContainer.appendChild(testCaseDiv);
}

function autoResize(textarea, maxHeight) {
    textarea.style.height = "";
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px";
}

document.getElementById('add-test-case').addEventListener('click', () => {
    const newTestCase = {
        id: ++testCaseCount,
        input: '',
        expectedOutput: '',
        status: '',
        actualOutput: '',
        error: '',
    };
    TEST_CASES.push(newTestCase);
    addTestCase(newTestCase);
    updateState();
});

document.getElementById('run-all').addEventListener('click', () => {
    // Enable spinner 
    const testCases = document.querySelectorAll('.test-case');
    testCases.forEach(testCase => {
        let spinner = testCase.querySelector('.spinner');
        spinner.style.visibility = 'visible';
    });

    vscode.postMessage({
        command: 'runTests',
        testCases: TEST_CASES
    });

});

window.addEventListener('message', event => {
    const message = event.data;
    if(message.command == 'testResult'){
        handleTestResults(message.results);    
    }
});

function handleTestResults(results) {
    // Copy message.results to TEST_CASES because isn't passed by ref.
    results.forEach(result => {
        TEST_CASES.forEach(testCase => {
            if(testCase.id == result.id){
                testCase.status = result.status;
                testCase.actualOutput = result.actualOutput;
                testCase.error = result.error;

                const testCaseHtml = document.getElementById(`test-case-${testCase.id}`);

                testCaseHtml.querySelector('.spinner').style.visibility = 'hidden'; 

                // Remove existing status classes
                testCaseHtml.classList.remove('passed', 'failed');
                if (testCase.status == "AC") {
                    testCaseHtml.classList.add('passed');
                } else {
                    testCaseHtml.classList.add('failed');
                }

                // Show test results
                const testResults = testCaseHtml.querySelector('.testResults');
                testResults.style.display = 'inline';
                const resultMsg = testResults.querySelector(".result-message");
                resultMsg.textContent = testCase.status == "AC" ? '✅ Passed' : `❌ ${testCase.status}`;
                const outputMsg  = testResults.querySelector('.output-message');
                const outputContent = outputMsg.querySelector('.actual-output');
                outputContent.textContent = testCase.actualOutput || 'No output';
            }
        })
    });

    updateState();
}

function updateState() {
    vscode.setState({ TEST_CASES });
}

window.addEventListener('DOMContentLoaded', () => {
    const state = vscode.getState();
    if (state && state.TEST_CASES) {
        TEST_CASES = state.TEST_CASES;
        TEST_CASES.forEach(testCase => {
            testCase.id = ++testCaseCount;
            addTestCase(testCase)
        });
    }
});

