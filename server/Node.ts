import { Host } from './Host';
import { Job } from './Job';
import { Socket } from 'net';
import { BinaryReader } from '../BinaryReader';
import { BinaryWriter } from "../BinaryWriter";
import { ClientServerPackets } from "../network";

class Node {
    private _lastBuffer: Buffer = new Buffer(0);
    private _currentJobs: Map<number, Job> = new Map<number, Job>();

    public host: Host | null;

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

        const messageType = reader.readUInt32() as ClientServerPackets;
        switch (messageType) {
            case ClientServerPackets.BORROW:
                this._receiveBorrow(reader);
                break;
            case ClientServerPackets.RETURN:
                this._receiveReturn(reader);
                break;
            case ClientServerPackets.PROGRESS:
                this._receiveProgress(reader);
                break;
            default:
                throw new Error('Invalid packet! ' + messageType);
        }
    }

    private _receiveBorrow(reader: BinaryReader) {
        this._requestBorrow();
    }

    private _receiveReturn(reader: BinaryReader) {
        const key = reader.readUInt32();
        const job = this._currentJobs.get(key);
        if (job == null) throw new Error('Invalid job ID: ' + job);
        this._currentJobs.delete(key);
        job._receiveReturn(reader);
    }

    private _receiveProgress(reader: BinaryReader) {
        const job = this._currentJobs.get(reader.readUInt32());
        if (job == null) throw new Error('Invalid job ID: ' + job);
        job._receiveProgress(reader);
    }

    private _socketClose(error: boolean) {
        if (this.host == null) return;
        this.host.removeNode(this);
        console.log('Lost connection!');
    }

    private _requestBorrow(): void {
        if (this.host == null) return;

        this.host._requestBorrow(this);
    }

    constructor(private _socket: Socket) {
        this._socket.on('data', this._socketData.bind(this));
        this._socket.on('close', this._socketClose.bind(this));
    }

    public _runningJob(job: Job) {
        this._currentJobs.set(job.id, job);
    }

    public _sendPacket(buffer: Buffer) {
        const writer = new BinaryWriter();
        writer.writeUInt32(0xdeedbeaf);
        writer.writeUInt32(buffer.length + 8);
        writer.writeBytes(buffer);
        this._socket.write(writer.toBuffer());
    }
}

export { Node };
