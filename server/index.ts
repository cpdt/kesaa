import { createServer as createHttpServer } from 'http';
import * as socket from 'socket.io';
import * as express from 'express';
import {
    SetupData, ConnectData, UpdateDataClient, UpdateDataJob, UpdateData,
    StateData, UpdateJobData, SetJobImageData, SaveImageData
} from "../common/web-messages";

import { connect, createServer as createTcpServer, Socket as TcpSocket } from 'net';
import { Host } from './Host';
import { Node } from './Node';
import { Job } from './Job';
import { Rect } from '../common/Rect';
import { WEB_PORT, JOB_PORT, REVERSE_JOIN_PORT } from "../common/network";
import { BinaryWriter } from "../common/BinaryWriter";
import { WebState } from "../common/web-state";

// start job server
const tcp = createTcpServer();
const jobHost = new Host(tcp);

tcp.listen(JOB_PORT, () => {
    console.log('Job server listening on *:' + JOB_PORT);
});

jobHost.on('connection', (node: Node, socket: TcpSocket) => {
    console.log('Received job connection from ' + socket.remoteAddress + ':' + socket.remotePort);
    const connectData: ConnectData = {
        ip: socket.remoteAddress as string
    };
    io.sockets.emit('add', connectData);
});

// start web server
const app = express();
const http = createHttpServer(app);
const io = socket(http);

app.use(express.static('../public'));

let currentState = WebState.SETUP;

function updateState(state: WebState) {
    currentState = state;
    const stateData: StateData = { state, data: currentData };
    io.sockets.emit('state', stateData);
}

function reverseConnectTo(ip: string) {
    console.log('Attempting to reverse-connect to ' + ip + '...');

    const socket = connect(REVERSE_JOIN_PORT, ip);
    socket.on('connect', () => {
        console.log('Connected to ' + ip + ', sending handshake - expect a response soon!');

        const handshakeWriter = new BinaryWriter();
        handshakeWriter.writeUInt32(0xdeedbeaf);
        handshakeWriter.writeUInt8(42);
        socket.write(handshakeWriter.toBuffer());
    });
    socket.on('error', (ex: Error) => {
        console.log('Failed to reverse-connect to ' + ip + ' (' + ex.message + ')');
    });
}


let jobList: Job[] = [];
let completedJobs = 0;
let updateInterval: NodeJS.Timer;

let currentData: SetupData | null = null;
let jobWidth: number = 0, jobHeight: number = 0;

function setupState(data: SetupData) {
    currentData = data;
    updateState(WebState.WAITING);
    jobHost.sendInitData({
        source: data.povSource,
        quality: data.quality,
        entireWidth: data.imageWidth,
        entireHeight: data.imageHeight
    });

    jobWidth = data.imageWidth / data.jobColumns;
    jobHeight = data.imageHeight / data.jobRows;

    // create jobs
    for (let y = 0; y < data.jobRows; y++) {
        for (let x = 0; x < data.jobColumns; x++) {
            const job = new Job(
                new Rect(Math.floor(x * jobWidth), Math.floor(y * jobHeight), Math.floor(jobWidth), Math.floor(jobHeight))
            );
            jobList.push(job);
            jobHost.addJob(job);
        }
    }

    // send one update to display UI state
    sendClientUpdate(true);
}

function startRender() {
    updateState(WebState.RENDER);

    // start updating clients with node info only
    updateInterval = setInterval(() => sendClientUpdate(false), 500);

    // start listening for job info changes
    for (let i = 0; i < jobList.length; i++) {
        const job = jobList[i];
        job.on('stateChange', () => sendClientJobUpdate(i, job));
        job.on('progressChange', () => sendClientJobUpdate(i, job));
        job.on('completed', (buffer: Buffer) => {
            sendClientJobImage(i, buffer);
            completedJobs++;
            if (completedJobs >= jobList.length) {
                updateState(WebState.FINISHED);
                clearInterval(updateInterval);
            }
        });
    }

    jobHost.sendStart();
}

function getNodeUpdate(): UpdateDataClient[] {
    return jobHost.connectedNodes.map((node: Node) => {
        const nodeJobs = node.currentJobs;
        let currentX = 0, currentY = 0, progress = 0;
        if (nodeJobs.length > 0) {
            currentX = nodeJobs[0].rect.x / jobWidth;
            currentY = nodeJobs[0].rect.y / jobHeight;
            progress = nodeJobs[0].progress;
        }

        return {
            ip: node.socket.remoteAddress as string,
            state: node.state,
            currentX, currentY,
            progress
        };
    });
}

function getJobUpdate(): UpdateDataJob[] {
    return jobList.map((job: Job) => {
        return {
            state: job.state,
            progress: job.progress
        };
    });
}

function sendClientUpdate(full: boolean, socket?: SocketIO.Socket) {
    const updateData: UpdateData = {
        clients: getNodeUpdate()
    };
    if (full) {
        updateData.jobs = getJobUpdate();
    }

    if (socket) {
        socket.emit('update', updateData);
    } else {
        io.sockets.emit('update', updateData);
    }

    if (full) {
        // send images
        for (let i = 0; i < jobList.length; i++) {
            const job = jobList[i];
            if (job.result) {
                sendClientJobImage(i, job.result, socket);
            }
        }
    }
}

function sendClientJobUpdate(index: number, job: Job): void {
    const updateData: UpdateJobData = {
        index,
        data: {
            state: job.state,
            progress: job.progress
        }
    };

    io.sockets.emit('jobUpdate', updateData);
}

function sendClientJobImage(index: number, buffer: Buffer, socket?: SocketIO.Socket): void {
    const imageData: SetJobImageData = {
        index,
        data: buffer
    };

    if (socket) {
        socket.emit('jobImage', imageData);
    } else {
        io.sockets.emit('jobImage', imageData);
    }
}

function returnToSetup() {
    jobList = [];
    completedJobs = 0;
    currentData = null;
    clearInterval(updateInterval);
    updateState(WebState.SETUP);
}

io.on('connection', (socket: SocketIO.Socket) => {
    socket.emit('connected');

    // update state to where we are now
    const stateData: StateData = { state: currentState, data: currentData };
    io.sockets.emit('state', stateData);
    if (currentState === WebState.RENDER || currentState === WebState.FINISHED) {
        sendClientUpdate(true, socket);
    }

    for (const client of jobHost.connectedNodes) {
        const connectData: ConnectData = {
            ip: client.socket.remoteAddress as string
        };
        socket.emit('add', connectData);
    }

    socket.on('add', (data: ConnectData) => {
        reverseConnectTo(data.ip);
    });

    socket.on('setup', setupState);

    socket.on('start', startRender);

    socket.on('cancel', () => {
        for (const job of jobList) {
            job.cancel();
            jobHost.removeJob(job);
        }
        returnToSetup();
    });

    socket.on('return', returnToSetup);
});

http.listen(WEB_PORT, () => {
    console.log('Web server listening on *:' + WEB_PORT);
});
