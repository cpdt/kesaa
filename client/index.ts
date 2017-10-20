import { createServer, connect, Socket } from "net";
import { BinaryReader } from "../common/BinaryReader";
import { REVERSE_JOIN_PORT, JOB_PORT, ReturnState } from "../common/network";
import {JobRunner, JobRunnerParams} from "./JobRunner";
import { Node } from "./Node";
import { PovRunner } from "./PovRunner";

// start reverse-connection server
const connectServer = createServer();
connectServer.listen(REVERSE_JOIN_PORT, () => {
    console.log('Waiting for join requests on *:' + REVERSE_JOIN_PORT);
});

connectServer.on('connection', (socket: Socket) => {
    const addr = socket.remoteAddress as string;
    const port = socket.remotePort as number;
    console.log('Received connection from ' + addr + ':' + port + ', waiting for handshake');

    socket.on('data', (data: Buffer) => {
        const reader = new BinaryReader(data);
        if (reader.readUInt32() !== 0xdeedbeaf) {
            console.log('Invalid handshake - unknown magic number');
            socket.end();
            return;
        }
        if (reader.readUInt8() !== 42) {
            console.log('Invalid handshake - unknown answer to life, the universe, and everything');
            socket.end();
            return;
        }

        console.log('Received handshake from ' + addr + ', connecting...');
        connectServer.close();
        socket.end();
        joinJobServer(addr);
    });
    socket.on('error', (err: Error) => {
        console.log('Lost connection from ' + addr + ' (' + err.message + ')');
    });
});

function joinJobServer(ip: string) {
    const socket = connect(JOB_PORT, ip);
    const node = new Node(socket, getJobRunner);

    socket.on('connect', () => {
        const addr = socket.address();
        console.log('Connected! ' + addr.address + ':' + addr.port);
    });

    function getJobRunner(): JobRunner {
        return new PovRunner(node);
    }

    // todo: make this configurable
    for (let i = 0; i < 4; i++) {
        node.borrow();
    }
}
