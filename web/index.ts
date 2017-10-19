import { connect } from 'socket.io-client';
import Socket = SocketIOClient.Socket;
import {
    SetupData, ConnectData, UpdateData,
    StateData, UpdateDataJob, UpdateJobData, SetJobImageData, SaveImageData
} from '../common/web-messages';
import { NodeState } from '../common/node-state';
import { JobState } from '../common/job-state';
import { WebState } from '../common/web-state';
import {Rect} from "../common/Rect";

interface PreviewBox {
    $mainElt: HTMLElement,
    $progressElt: HTMLElement,
    $displayElt: HTMLElement,
    $showImage?: HTMLImageElement,
    rect: Rect
}

// grab all elements that we need
const $setupPane = document.getElementById('setupPane') as HTMLElement;
const $renderPane = document.getElementById('renderPane') as HTMLElement;

// setup pane
const $sceneTextInput = document.getElementById('sceneText') as HTMLTextAreaElement;

const $imageQuality = document.getElementById('imageQuality') as HTMLInputElement;
const $imageWidthInput = document.getElementById('imageWidth') as HTMLInputElement;
const $imageHeightInput = document.getElementById('imageHeight') as HTMLInputElement;
const $jobRowsInput = document.getElementById('jobRows') as HTMLInputElement;
const $jobColumnsInput = document.getElementById('jobColumns') as HTMLInputElement;

const $connectedClients = document.getElementById('connectedClients') as HTMLElement;
const $addClientInput = document.getElementById('addClient') as HTMLInputElement;

const $setupContinueBtn = document.getElementById('setupContinue') as HTMLLinkElement;

// render pane
const $jobNum = document.getElementById('jobNum') as HTMLElement;
const $clientNum = document.getElementById('clientNum') as HTMLElement;
const $sizeNum = document.getElementById('sizeNum') as HTMLElement;

const $renderPreview = document.getElementById('renderPreview') as HTMLElement;

const $clientStatus = document.getElementById('clientStatus') as HTMLElement;
const $renderStart = document.getElementById('renderStart') as HTMLLinkElement;
const $renderCancel = document.getElementById('renderCancel') as HTMLLinkElement;
const $renderSave = document.getElementById('renderSave') as HTMLLinkElement;
const $renderReturn = document.getElementById('renderReturn') as HTMLLinkElement;

const socket: Socket = connect();
const displayBoxes: PreviewBox[] = [];
let clientCount: number = 0;

let imageData: SetupData | undefined;
let currentState = WebState.SETUP;
let needsUiRebuild = true;

socket.on('connected', () => {
    $addClientInput.style.display = '';
    $setupContinueBtn.style.display = '';
});

socket.on('add', (data: ConnectData) => {
    const newElt = document.createElement('p');
    newElt.textContent = data.ip;
    $connectedClients.insertBefore(newElt, $addClientInput);
    clientCount++;
});

socket.on('state', (data: StateData) => {
    if (data.state === currentState) return;

    switch (currentState) {
        case WebState.SETUP:
            $setupPane.style.display = 'none';
            break;
        case WebState.WAITING:
            $renderPane.style.display = 'none';
            break;
        case WebState.RENDER:
            $renderPane.style.display = 'none';
            $renderCancel.style.display = 'none';
            break;
        case WebState.FINISHED:
            $renderSave.style.display = 'none';
            $renderReturn.style.display = 'none';
            break;
    }

    switch (data.state) {
        case WebState.SETUP:
            clearPreviewUi();
            $setupPane.style.display = '';
            break;
        case WebState.WAITING:
            if (data.data) {
                buildPreviewUi(data.data);
            }
            $renderPane.style.display = '';
            $renderStart.style.display = '';
            break;
        case WebState.RENDER:
            if (data.data) {
                buildPreviewUi(data.data);
            }
            $renderPane.style.display = '';
            $renderStart.style.display = 'none';
            $renderCancel.style.display = '';
            break;
        case WebState.FINISHED:
            $renderPane.style.display = '';
            $renderSave.style.display = '';
            $renderReturn.style.display = '';
            break;
    }

    currentState = data.state;
});

socket.on('update', updatePreviewUi);

socket.on('jobUpdate', (data: UpdateJobData) => {
    updateIndividualJob(data.index, data.data);
});

socket.on('jobImage', (data: SetJobImageData) => {
    const displayBox = displayBoxes[data.index];
    const buffer = new Buffer(data.data);

    displayBox.$mainElt.removeChild(displayBox.$displayElt);
    displayBox.$mainElt.removeChild(displayBox.$progressElt);

    const image = document.createElement('img') as HTMLImageElement;
    image.src = "data:image/png;base64," + buffer.toString('base64');
    displayBox.$mainElt.appendChild(image);
    displayBox.$showImage = image;
});

$addClientInput.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;

    const connectData: ConnectData = {
        ip: $addClientInput.value
    };
    socket.emit('add', connectData);
    $addClientInput.value = "";
});

$setupContinueBtn.addEventListener('click', () => {
    imageData = {
        quality: parseInt($imageQuality.value, 10),
        povSource: $sceneTextInput.value,
        imageWidth: parseInt($imageWidthInput.value, 10),
        imageHeight: parseInt($imageHeightInput.value, 10),
        jobRows: parseInt($jobRowsInput.value, 10),
        jobColumns: parseInt($jobColumnsInput.value, 10)
    };

    buildPreviewUi(imageData);
    socket.emit('setup', imageData);
});

$renderStart.addEventListener('click', () => {
    socket.emit('start');
});

$renderCancel.addEventListener('click', () => {
    socket.emit('cancel');
});

$renderSave.addEventListener('click', () => {
    if (!imageData) return;

    const renderCanvas = document.createElement('canvas');
    const renderCtx = renderCanvas.getContext('2d') as CanvasRenderingContext2D;
    renderCanvas.width = imageData.imageWidth;
    renderCanvas.height = imageData.imageHeight;

    for (const box of displayBoxes) {
        if (!box.$showImage) continue;

        renderCtx.drawImage(box.$showImage, box.rect.x, box.rect.y, box.rect.width, box.rect.height);
    }

    document.location.href = renderCanvas.toDataURL('image/png');
});

$renderReturn.addEventListener('click', () => {
    socket.emit('return');
});

function clearPreviewUi() {
    needsUiRebuild = true;

    while ($renderPreview.firstChild) {
        $renderPreview.removeChild($renderPreview.firstChild);
    }
}

function buildPreviewUi(setupData: SetupData) {
    if (!needsUiRebuild) return;
    needsUiRebuild = false;

    const boxWidth = setupData.imageWidth / setupData.jobColumns;
    const boxHeight = setupData.imageHeight / setupData.jobRows;

    $jobNum.textContent = setupData.jobColumns * setupData.jobRows + ' jobs';
    $clientNum.textContent = clientCount + ' clients';
    $sizeNum.textContent = boxWidth + 'x' + boxHeight + ' pixels';

    const previewTargetWidth = 1000;
    const scaleFactor = previewTargetWidth / setupData.imageWidth;
    const displayWidth = boxWidth * scaleFactor;
    const displayHeight = boxHeight * scaleFactor;

    for (let y = 0; y < setupData.jobRows; y++) {
        const $row = document.createElement('div');
        $row.classList.add('preview-row');
        $renderPreview.appendChild($row);

        for (let x = 0; x < setupData.jobColumns; x++) {
            const $cell = document.createElement('div');
            $cell.classList.add('render-cell');
            $cell.style.width = displayWidth + 'px';
            $cell.style.height = displayHeight + 'px';
            $row.appendChild($cell);

            const $progressBar = document.createElement('div');
            $progressBar.classList.add('render-progress-bar');
            $progressBar.style.width = '0%';
            $cell.appendChild($progressBar);

            const $display = document.createElement('span');
            $cell.appendChild($display);

            displayBoxes.push({
                $mainElt: $cell,
                $progressElt: $progressBar,
                $displayElt: $display,
                rect: new Rect(x * boxWidth, y * boxHeight, boxWidth, boxHeight)
            });
        }
    }
}

function updatePreviewUi(data: UpdateData) {
    // update client strings
    let clientString = "";
    for (const client of data.clients) {
        clientString += client.ip + " - ";
        switch (client.state) {
            case NodeState.IDLE:
                clientString += 'idle';
                break;
            case NodeState.WAITING:
                clientString += 'waiting';
                break;
            case NodeState.RUNNING:
                clientString += '(' + client.currentX + ', ' + client.currentY + ') at ' + (client.progress * 100).toFixed(2) + '%';
                break;
            case NodeState.INVALID:
                clientString += 'error';
                break;
        }
        clientString += "\n";
    }
    $clientStatus.textContent = clientString;

    // update cells
    if (data.jobs) {
        for (let i = 0; i < data.jobs.length; i++) {
            updateIndividualJob(i, data.jobs[i]);
        }
    }
}

function updateIndividualJob(index: number, jobData: UpdateDataJob) {
    const displayBox = displayBoxes[index];

    switch (jobData.state) {
        case JobState.WAITING:
            displayBox.$displayElt.textContent = "Waiting...";
            break;
        case JobState.RUNNING:
            displayBox.$displayElt.textContent = (jobData.progress * 100).toFixed(2) + "%";
            break;
        case JobState.COMPLETED:
            displayBox.$displayElt.textContent = "Done";
            break;
        case JobState.CANCELLED:
            displayBox.$displayElt.textContent = "Cancelled";
            break;
        case JobState.ERROR:
            displayBox.$displayElt.textContent = "Error!";
            break;
    }

    displayBox.$progressElt.style.width = jobData.progress * 100 + '%';
}
