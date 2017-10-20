import { connect } from 'socket.io-client';
import Socket = SocketIOClient.Socket;
import { Rect } from "../common/Rect";
import {
    ClientListData, FullRenderData, IntervalRenderData, JobRenderData,
    JobUpdateData, ClientData, StateData, SetupData,
} from "../common/web-messages";
import {WebState} from "../common/web-state";
import {JobState} from "../common/job-state";

interface PreviewBox {
    $mainElt: HTMLElement,
    $progressElt: HTMLElement,
    $displayElt: HTMLElement,
    $showImage: HTMLImageElement,
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
const $progressBg = document.getElementById('progressBg') as HTMLElement;
const $progressText = document.getElementById('progressText') as HTMLElement;

const $clientStatus = document.getElementById('clientStatus') as HTMLElement;
const $renderStart = document.getElementById('renderStart') as HTMLLinkElement;
const $renderCancel = document.getElementById('renderCancel') as HTMLLinkElement;
const $renderSave = document.getElementById('renderSave') as HTMLLinkElement;
const $renderReturn = document.getElementById('renderReturn') as HTMLLinkElement;

const socket: Socket = connect();
let clientCount: number = 0;
let previewBoxes: PreviewBox[] = [];
let currentWidth: number = 0, currentHeight: number = 0;

socket.on('state', (data: StateData) => {
    switch (data.state) {
        case WebState.SETUP:
            $setupPane.style.display = '';
            $renderPane.style.display = 'none';
            $addClientInput.style.display = '';
            $setupContinueBtn.style.display = '';
            break;
        case WebState.WAITING:
            $setupPane.style.display = 'none';
            $renderPane.style.display = '';
            $renderStart.style.display = '';
            $renderCancel.style.display = 'none';
            $renderSave.style.display = 'none';
            $renderReturn.style.display = '';
            break;
        case WebState.RENDER:
            $setupPane.style.display = 'none';
            $renderPane.style.display = '';
            $renderStart.style.display = 'none';
            $renderCancel.style.display = '';
            $renderSave.style.display = 'none';
            $renderReturn.style.display = 'none';
            break;
        case WebState.FINISHED:
            $setupPane.style.display = 'none';
            $renderPane.style.display = '';
            $renderStart.style.display = 'none';
            $renderCancel.style.display = 'none';
            $renderSave.style.display = '';
            $renderReturn.style.display = '';
            break;
    }
});

socket.on('clientList', (data: ClientListData) => {
    while ($connectedClients.firstChild) {
        $connectedClients.removeChild($connectedClients.firstChild);
    }

    for (const client of data.clients) {
        const newClientBox = document.createElement('p');
        newClientBox.textContent = client.ip;
        $connectedClients.appendChild(newClientBox);
    }

    clientCount = data.clients.length;
});

socket.on('fullData', (data: FullRenderData) => {
    updateIntervalData(data);

    currentWidth = data.setup.imageWidth;
    currentHeight = data.setup.imageHeight;

    // build the preview UI
    const boxWidth = data.setup.imageWidth / data.setup.jobColumns;
    const boxHeight = data.setup.imageHeight / data.setup.jobRows;

    $jobNum.textContent = data.setup.jobColumns * data.setup.jobRows + ' jobs';
    $clientNum.textContent = clientCount + ' clients';
    $sizeNum.textContent = boxWidth + 'x' + boxHeight + ' pixels';

    const previewTargetWidth = 1000;
    const scaleFactor = previewTargetWidth / data.setup.imageWidth;
    const displayWidth = boxWidth * scaleFactor;
    const displayHeight = boxHeight * scaleFactor;

    // remove all rows from parent
    while ($renderPreview.firstChild) {
        $renderPreview.removeChild($renderPreview.firstChild);
    }
    previewBoxes = [];

    // build new rows
    for (let y = 0; y < data.setup.jobRows; y++) {
        const $row = document.createElement('div');
        $row.classList.add('preview-row');
        $renderPreview.appendChild($row);

        for (let x = 0; x < data.setup.jobColumns; x++) {
            const $cell = document.createElement('div');
            $cell.classList.add('render-cell');
            $cell.style.width = displayWidth + 'px';
            $cell.style.height = displayHeight + 'px';
            $row.appendChild($cell);

            const $previewImage = document.createElement('img') as HTMLImageElement;
            $previewImage.style.display = 'none';
            $cell.appendChild($previewImage);

            const $progressBar = document.createElement('div');
            $progressBar.classList.add('render-progress-bar');
            $progressBar.style.width = '0%';
            $cell.appendChild($progressBar);

            const $display = document.createElement('span');
            $cell.appendChild($display);

            previewBoxes.push({
                $mainElt: $cell,
                $showImage: $previewImage,
                $progressElt: $progressBar,
                $displayElt: $display,
                rect: new Rect(x * boxWidth, y * boxHeight, boxWidth, boxHeight)
            });
        }
    }

    for (let i = 0; i < data.jobs.length; i++) {
        updateJob(i, data.jobs[i]);
    }
});

socket.on('intervalData', (data: IntervalRenderData) => {
    updateIntervalData(data);
});

socket.on('jobUpdate', (data: JobUpdateData) => {
    updateJob(data.id, data);
});

$addClientInput.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;

    const clientData: ClientData = {
        ip: $addClientInput.value.trim()
    };
    socket.emit('add', clientData);
    $addClientInput.value = '';
});

$setupContinueBtn.addEventListener('click', () => {
    const imageData: SetupData = {
        quality: parseInt($imageQuality.value, 10),
        povSource: $sceneTextInput.value,
        imageWidth: parseInt($imageWidthInput.value, 10),
        imageHeight: parseInt($imageHeightInput.value, 10),
        jobRows: parseInt($jobRowsInput.value, 10),
        jobColumns: parseInt($jobColumnsInput.value, 10)
    };
    socket.emit('setup', imageData);
});

$renderStart.addEventListener('click', () => {
    socket.emit('start');
});

$renderCancel.addEventListener('click', () => {
    socket.emit('cancel');
});

$renderSave.addEventListener('click', () => {
    const renderCanvas = document.createElement('canvas');
    const renderCtx = renderCanvas.getContext('2d') as CanvasRenderingContext2D;
    renderCanvas.width = currentWidth;
    renderCanvas.height = currentHeight;

    for (const box of previewBoxes) {
        if (!box.$showImage) continue;

        renderCtx.drawImage(box.$showImage, box.rect.x, box.rect.y, box.rect.width, box.rect.height);
    }

    window.open(renderCanvas.toDataURL('image/png'));
});

$renderReturn.addEventListener('click', () => {
    socket.emit('return');
});

function updateIntervalData(data: IntervalRenderData) {
    $clientStatus.textContent = data.clients.join('\n');

    const remainingMinutes = Math.floor(data.remainingSeconds / 60);
    const remainingSeconds = Math.floor(data.remainingSeconds % 60);

    $progressBg.style.width = data.totalProgress * 100 + '%';
    $progressText.textContent = (data.totalProgress * 100).toFixed(2) + '% - ' + remainingMinutes + ':' + Math.floor(remainingSeconds);
}

function updateJob(index: number, job: JobRenderData) {
    if (index > previewBoxes.length) return;

    const previewBox = previewBoxes[index];
    switch (job.state) {
        case JobState.WAITING:
            previewBox.$displayElt.textContent = "Waiting...";
            break;
        case JobState.RUNNING:
            previewBox.$displayElt.textContent = (job.progress * 100).toFixed(2) + "%";
            break;
        case JobState.COMPLETED:
            previewBox.$displayElt.textContent = "Done";
            break;
        case JobState.CANCELLED:
            previewBox.$displayElt.textContent = "Cancelled";
            break;
        case JobState.ERROR:
            previewBox.$displayElt.textContent = "Error!";
            break;
    }

    previewBox.$progressElt.style.width = job.progress * 100 + "%";

    if (!job.image) {
        previewBox.$showImage.style.display = 'none';
        previewBox.$progressElt.style.display = '';
        previewBox.$displayElt.style.display = '';
        return;
    }

    const buffer = new Buffer(job.image);
    previewBox.$showImage.src = "data:image/png;base64," + buffer.toString('base64');
    previewBox.$showImage.style.display = '';
    previewBox.$progressElt.style.display = 'none';
    previewBox.$displayElt.style.display = 'none';
}
