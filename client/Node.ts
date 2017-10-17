import { BinaryWriter } from '../BinaryWriter';
import { BinaryReader } from '../BinaryReader';
import { Socket } from 'net';
import { ServerClientPackets, ClientServerPackets } from "../network";
import { JobRunner } from "./JobRunner";
import { Rect } from "../Rect";
import { ReturnState } from "../network";

interface JobData {
    runner: JobRunner;
    writer: BinaryWriter;
}

class Node {
    private _lastBuffer: Buffer = new Buffer(0);
    private _currentJobs: Map<number, JobData> = new Map<number, JobData>();

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
            case ServerClientPackets.SEND:
                this._socketSend(reader);
                break;
            case ServerClientPackets.CANCEL:
                this._socketCancel(reader);
                break;
        }
    }

    private _socketSend(reader: BinaryReader) {
        const jobId = reader.readUInt32();
        const rect = Rect.deserialize(reader);
        const runner = this._getRunner();
        const data = {
            runner,
            writer: new BinaryWriter()
        };

        this._currentJobs.set(jobId, data);
        runner.run(rect, data.writer, (state: ReturnState) => this._finishJob(jobId, state));
    }

    private _socketCancel(reader: BinaryReader) {
        const jobId = reader.readUInt32();
        if (!this._currentJobs.has(jobId)) return;

        const jobData = this._currentJobs.get(jobId) as JobData;
        this._currentJobs.delete(jobId);
        jobData.runner.cancel();
    }

    private _socketClose(error: boolean) {
        console.log('Oh no! Lost connection :(');
    }

    private _finishJob(jobId: number, state: ReturnState) {
        if (!this._currentJobs.has(jobId)) {
            console.log('[warn] invalid job id ' + jobId);
            return;
        }
        const jobData = this._currentJobs.get(jobId) as JobData;
        this._currentJobs.delete(jobId);

        const writer = new BinaryWriter(4 + jobData.writer.offset);
        writer.writeUInt32(ClientServerPackets.RETURN);
        writer.writeUInt32(jobId);
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
