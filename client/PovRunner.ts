import { JobRunner, JobRunnerParams } from "./JobRunner";
import { ReturnState } from "../common/network";
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as sharp from 'sharp';
import { Node } from "./Node";

export class PovRunner implements JobRunner {
    private _povProcess: ChildProcess;
    private _running: boolean = false;

    constructor(private _node: Node) {

    }

    run(params: JobRunnerParams, progress: (val: number) => void, done: (state: ReturnState) => void): void {
        this._running = true;

        console.log("Filename: " + params.filename);
        console.log("JOB ID: " + params.jobId);
        const outPath = path.join(path.dirname(params.filename), params.jobId) + ".png";
        const args = [
            "+I" + params.filename,                         // pov file to load
            "+W" + params.data.entireWidth,                 // width of image
            "+H" + params.data.entireHeight,                // height of image
            "+SC" + params.rect.x,                          // sub-rect left
            "+SR" + params.rect.y,                          // sub-rect top
            "+EC" + (params.rect.x + params.rect.width),    // sub-rect right
            "+ER" + (params.rect.y + params.rect.height),   // sub-rect bottom
            "+FN",                                          // render as PNG
            "+o" + outPath,                                 // output name
            "-GA",                                          // don't display anything unecessary
            "-P",                                           // don't pause on completion
            "+Q" + params.data.quality,                     // render quality
            "+a0.3",                                        // antialiasing
        ];

        console.log("Starting POVRay...");
        this._povProcess = spawn("/usr/local/bin/povray", args);

        const matchRegex = /Rendered (\d+) of (\d+) pixels \((\d+)%\)/ig;

        this._povProcess.stderr.on('data', (chunk: Buffer) => {
            const strBuffer = chunk.toString();
            let match: string[] | null;
            while ((match = matchRegex.exec(strBuffer)) != null) {
                const renderedPixels = parseInt(match[1], 10);
                const totalPixels = parseInt(match[2], 10);

                const progressVal = renderedPixels / totalPixels;
                progress(progressVal);
            }
        });

        this._povProcess.on('close', (code: number) => {
            if (!this._running) return;

            console.log("Povray has completed");
            if (code !== 0) {
                done(ReturnState.ERROR);
                this._node.borrow();
                return;
            }

            sharp(outPath).extract({
                left: params.rect.x,
                top: params.rect.y,
                width: params.rect.width,
                height: params.rect.height
            }).toBuffer((err: Error, resizedBuffer: Buffer) => {
                if (!this._running) return;

                if (err) {
                    done(ReturnState.ERROR);
                } else {

                    params.writer.writeUInt32(resizedBuffer.length);
                    params.writer.writeBytes(resizedBuffer);
                    done(ReturnState.OK);
                }
                this._node.borrow();
            });
        });
    }

    cancel(): void {
        if (!this._running) return;
        this._running = false;
        this._povProcess.kill();
        this._node.borrow();
    }

}
