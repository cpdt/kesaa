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

    /*const socket = connect(JOB_PORT, ip);
    const node = new Node(socket, getJobRunner);

    let currentNumber = 0;
    function finishAndContinue() {
        currentNumber--;
        borrowN();
    }

    function borrowN() {
        while (currentNumber < 4) {
            currentNumber++;
            node.borrow();
        }
    }

    socket.on('connect', () => {
        const addr = socket.address();
        console.log('Connected! ' + addr.address + ':' + addr.port);
    });

    function getJobRunner(): JobRunner {
        return {
            run(params: JobRunnerParams, progress: (val: number) => void, done: (state: ReturnState) => void) {
                runPovray(params.filename, params.jobId + ".png", params.data.quality, params.rect, params.data.entireWidth, params.data.entireHeight, progress).catch(() => {
                    console.log("Looks like an error occurred");
                    done(ReturnState.ERROR);
                    finishAndContinue();
                }).then((buffer: Buffer) => {
                    // crop buffer to just our rect
                    sharp(buffer).extract({
                        left: params.rect.x,
                        top: params.rect.y,
                        width: params.rect.width,
                        height: params.rect.height
                    }).toBuffer((err: Error, resizedBuffer: Buffer) => {
                        if (err) {
                            done(ReturnState.ERROR);
                            finishAndContinue();
                        } else {
                            params.writer.writeUInt32(resizedBuffer.length);
                            params.writer.writeBytes(resizedBuffer);
                            done(ReturnState.OK);
                        }
                        finishAndContinue();
                    });
                });
            },
            cancel() {
                console.log("Job cancelled");
                // todo
            }
        };
    }

    borrowN();
}

function runPovray(povPath: string, outName: string, quality: number, rect: Rect, entireWidth: number, entireHeight: number, progress: (val: number) => void): Promise<Buffer> {
    const outPath = path.join(path.dirname(povPath), outName) + ".png";
    const args = [
        "+I" + povPath,                 // pov file to load
        "+W" + entireWidth,             // width of image
        "+H" + entireHeight,            // height of image
        "+SC" + rect.x,                 // sub-rect left
        "+SR" + rect.y,                 // sub-rect top
        "+EC" + (rect.x + rect.width),  // sub-rect right
        "+ER" + (rect.y + rect.height), // sub-rect bottom
        "+FN",                          // render as PNG
        "+o" + outPath,                 // output name
        "-GA",                          // don't display anything unecessary
        "-P",                           // don't pause on completion
        "+Q" + quality,                 // render quality
        "+a0.3",                        // antialiasing
    ];

    console.log("Starting povray...");
    const subprocess = spawn("/usr/local/bin/povray", args);

    const matchRegex = /Rendered (\d+) of (\d+) pixels \((\d+)%\)/ig;

    return new Promise((resolve, reject) => {
        subprocess.stderr.on('data', (chunk: Buffer) => {
            const strBuffer = chunk.toString();
            let match: string[] | null;
            while ((match = matchRegex.exec(strBuffer)) != null) {
                const renderedPixels = parseInt(match[1], 10);
                const totalPixels = parseInt(match[2], 10);

                const progressVal = renderedPixels / totalPixels;
                progress(progressVal);
            }
        });

        subprocess.on('close', (code: number) => {
            console.log("Povray has completed");
            if (code !== 0) reject();
            else resolve(readFileSync(outPath));
        });
    });*/
}
