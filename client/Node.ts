import { BinaryWriter } from '../common/BinaryWriter';
import { BinaryReader } from '../common/BinaryReader';
import { Socket } from 'net';
import { ServerClientPackets, ClientServerPackets } from "../common/network";
import {JobRunner, JobRunnerParams} from "./JobRunner";
import { Rect } from "../common/Rect";
import { ReturnState } from "../common/network";
import { InitData } from "../common/InitData";
import { unparse } from "uuid-parse";
import { v4 as uuidv4 } from "uuid";
import { writeFileSync } from 'fs';
import * as mkdirp from 'mkdirp';

interface JobData {
    runner: JobRunner;
    writer: BinaryWriter;
}

class Node {
    private _lastBuffer: Buffer = new Buffer(0);
    private _currentJobs: Map<string, JobData> = new Map<string, JobData>();
    private _init: InitData;
    private _filename: string;

    private _socketData(data: Buffer) {
        const concatData = Buffer.concat([this._lastBuffer, data]);

        const reader = new BinaryReader(concatData);
        if (reader.readUInt32() !== 0xdeedbeaf) {
            throw new Error("Invalid magic number!");
        }

        const contentLength = reader.readUInt32();
        if (contentLength > concatData.length) {
            console.log('Continuing: received ' + concatData.length + ', want ' + contentLength);
            this._lastBuffer = concatData;
            return;
        }

        this._lastBuffer = new Buffer(0);

        const messageType = reader.readUInt32() as ServerClientPackets;
        switch (messageType) {
            case ServerClientPackets.INIT:
                this._socketInit(reader);
                break;
            case ServerClientPackets.SEND:
                this._socketSend(reader);
                break;
            case ServerClientPackets.CANCEL:
                this._socketCancel(reader);
                break;
        }

        if (concatData.length > contentLength) {
            this._socketData(concatData.slice(contentLength));
        }
    }

    private _socketInit(reader: BinaryReader) {
        const quality = reader.readUInt8();
        const entireWidth = reader.readUInt32();
        const entireHeight = reader.readUInt32();
        const sourceLength = reader.readUInt32();
        const sourceText = reader.readStringUtf8(sourceLength);
        this._init = {
            quality: quality,
            source: sourceText,
            entireWidth,
            entireHeight
        };

        // write source text to local file
        const sourceDir = __dirname + "/scenes/";
        mkdirp.sync(sourceDir);
        this._filename = sourceDir + uuidv4() + ".pov";
        writeFileSync(this._filename, sourceText);
    }

    private _socketSend(reader: BinaryReader) {
        const jobId = reader.readBytes(16);
        const strId = jobId.toString('ascii');
        const rect = Rect.deserialize(reader);
        const runner = this._getRunner();
        const data = {
            runner,
            writer: new BinaryWriter()
        };

        this._currentJobs.set(strId, data);

        const params: JobRunnerParams = {
            jobId: unparse(jobId),
            rect,
            data: this._init,
            filename: this._filename,
            writer: data.writer
        };

        runner.run(
            params,
            (val: number) => this._sendProgress(jobId, strId, val),
            (state: ReturnState) => this._finishJob(jobId, strId, state)
        );
    }

    private _socketCancel(reader: BinaryReader) {
        const jobId = reader.readBytes(16);
        const strId = jobId.toString('ascii');
        if (!this._currentJobs.has(strId)) return;

        const jobData = this._currentJobs.get(strId) as JobData;
        this._currentJobs.delete(strId);
        jobData.runner.cancel();
    }

    private _socketClose(error: boolean) {
        console.log('Oh no! Lost connection :(');
    }

    private _sendProgress(jobId: Buffer, strId: string, val: number) {
        if (!this._currentJobs.has(strId)) {
            console.log('[warn] invalid job id ' + unparse(jobId));
            return;
        }

        const writer = new BinaryWriter(24);
        writer.writeUInt32(ClientServerPackets.PROGRESS);
        writer.writeBytes(jobId);
        writer.writeFloat(val);

        this._sendPacket(writer.toBuffer());
    }

    private _finishJob(jobId: Buffer, strId: string, state: ReturnState) {
        if (!this._currentJobs.has(strId)) {
            console.log('[warn] invalid job id ' + unparse(jobId));
            return;
        }
        const jobData = this._currentJobs.get(strId) as JobData;
        this._currentJobs.delete(strId);

        const writer = new BinaryWriter(24 + jobData.writer.offset);
        writer.writeUInt32(ClientServerPackets.RETURN);
        writer.writeBytes(jobId);
        writer.writeUInt32(state);
        writer.writeBytes(jobData.writer.toBuffer());

        this._sendPacket(writer.toBuffer());
    }

    private _sendPacket(buffer: Buffer) {
        const writer = new BinaryWriter();
        writer.writeUInt32(0xdeedbeaf);
        writer.writeUInt32(buffer.length + 8);
        writer.writeBytes(buffer);
        this._socket.write(writer.toBuffer());
    }

    constructor(private _socket: Socket, private _getRunner: () => JobRunner) {
        this._socket.on('data', this._socketData.bind(this));
        this._socket.on('close', this._socketClose.bind(this));
    }

    public borrow() {
        const writer = new BinaryWriter();
        writer.writeUInt32(ClientServerPackets.BORROW);
        this._sendPacket(writer.toBuffer());
    }
}
export { Node };
