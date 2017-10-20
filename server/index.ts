import { createServer as createHttpServer } from 'http';
import * as socket from 'socket.io';
import * as express from 'express';

import { connect, createServer as createTcpServer, Socket as TcpSocket } from 'net';
import { Host } from './Host';
import { Node } from './Node';
import { WEB_PORT, JOB_PORT, REVERSE_JOIN_PORT } from "../common/network";
import { BinaryWriter } from "../common/BinaryWriter";
import { RenderManager } from "./RenderManager";
import {
    ClientData, ClientListData, SetupData,
    StateData
} from '../common/web-messages';
import { EventEmitter } from 'events';
import {WebState} from "../common/web-state";

// start job server
const tcp = createTcpServer();
const jobHost = new Host(tcp);

tcp.listen(JOB_PORT, () => {
    console.log('Job server listening on *:' + JOB_PORT);
});

function getClientData(node: Node): ClientData {
    return {
        ip: node.socket.remoteAddress as string
    };
}

function sendClientUpdateTo(socket: EventEmitter): void {
    const data: ClientListData = {
        clients: jobHost.connectedNodes.map(getClientData)
    };
    socket.emit('clientList', data);
}

jobHost.on('connection', (node: Node, socket: TcpSocket) => {
    const addr = socket.remoteAddress;

    socket.on('close', () => {
        console.log('Lost connection from ' + addr);
        sendClientUpdateTo(io.sockets);
    });
    console.log('Received job connection from ' + addr + ':' + socket.remotePort);
    sendClientUpdateTo(io.sockets);
});

// start web server
const app = express();
const http = createHttpServer(app);
const io = socket(http);

app.use(express.static('../public'));

function reverseConnectTo(ip: string) {
    console.log('Attempting to reverse-connect to ' + ip + '...');

    const socket = connect(REVERSE_JOIN_PORT, ip);
    socket.on('connect', () => {
        console.log('Connected to ' + ip + ', sending handshake');

        const handshakeWriter = new BinaryWriter();
        handshakeWriter.writeUInt32(0xdeedbeaf);
        handshakeWriter.writeUInt8(42);
        socket.write(handshakeWriter.toBuffer());
    });
    socket.on('error', (ex: Error) => {
        console.log('Failed to reverse-connect to ' + ip + ' (' + ex.message + ')');
    });
}

let _currentManager: RenderManager | null;

function sendStateTo(socket: EventEmitter, state: WebState): void {
    const data: StateData = {
        state
    };
    socket.emit('state', data);
}

function returnToSetup() {
    _currentManager = null;
    sendStateTo(io.sockets, WebState.SETUP);
}

io.on('connection', (socket: SocketIO.Socket) => {
    sendClientUpdateTo(socket);

    if (_currentManager) {
        _currentManager.onConnection(socket);
    } else {
        sendStateTo(io.sockets, WebState.SETUP);
    }

    socket.on('add', (data: ClientData) => {
        reverseConnectTo(data.ip);
    });

    socket.on('setup', (data: SetupData) => {
        if (_currentManager) return;

        _currentManager = new RenderManager(io, jobHost, data);
    });

    socket.on('start', () => {
        if (!_currentManager) return;

        _currentManager.start();
    });

    socket.on('cancel', () => {
        if (!_currentManager) return;

        _currentManager.cancel();
        returnToSetup();
    });

    socket.on('return', () => {
        returnToSetup();
    });
});

http.listen(WEB_PORT, () => {
    console.log('Web server listening on *:' + WEB_PORT);
});
