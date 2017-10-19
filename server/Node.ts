import { Host } from './Host';
import { Job } from './Job';
import { Socket } from 'net';
import { BinaryReader } from '../common/BinaryReader';
import { BinaryWriter } from "../common/BinaryWriter";
import { ClientServerPackets, ServerClientPackets } from "../common/network";
import { NodeState } from "../common/node-state";
import { InitData } from "../common/InitData";

class Node {
    private _currentState: NodeState = NodeState.IDLE;
    private _lastBuffer: Buffer = new Buffer(0);
    private _currentJobs: Map<string, Job> = new Map<string, Job>();
    private _waitingCount: number = 0;

    public host: Host | null;

    public get currentJobs(): ReadonlyArray<Job> {
        return Array.from(this._currentJobs.values());
    }

    private _setState(state: NodeState): void {
        this._currentState = state;
        this._iOnStateChange();
    }

    private _iOnStateChange(): void {

    }

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

        if (concatData.length > contentLength) {
            this._socketData(concatData.slice(contentLength));
        }
    }

    private _receiveBorrow(reader: BinaryReader) {
        this._requestBorrow();
    }

    private _receiveReturn(reader: BinaryReader) {
        const key = reader.readBytes(16);
        const strKey = key.toString('ascii');
        const job = this._currentJobs.get(strKey);
        if (job == null) throw new Error('Invalid job ID: ' + job);
        this._currentJobs.delete(strKey);
        job._receiveReturn(reader);

        this._setState(this._waitingCount > 0 ? NodeState.WAITING : NodeState.IDLE);
    }

    private _receiveProgress(reader: BinaryReader) {
        const job = this._currentJobs.get(reader.readBytes(16).toString('ascii'));
        if (job == null) throw new Error('Invalid job ID: ' + job);
        job._receiveProgress(reader);
    }

    private _socketClose(error: boolean) {
        if (this.host == null) return;
        console.log('Lost connection!');

        const host = this.host;
        this.host.removeNode(this);
        this._setState(NodeState.INVALID);

        // re-queue all waiting jobs
        for (const job of this._currentJobs.values()) {
            host.addJob(job);
        }
    }

    private _requestBorrow(): void {
        if (this.host == null) return;

        if (this.state === NodeState.IDLE) this._setState(NodeState.WAITING);
        this._waitingCount++;
        this.host._requestBorrow(this);
    }

    constructor(private _socket: Socket) {
        this._socket.on('data', this._socketData.bind(this));
        this._socket.on('close', this._socketClose.bind(this));
        this._socket.on('error', () => {});
    }

    public get state(): NodeState { return this._currentState; }

    public get socket(): Socket { return this._socket; }

    public sendInitData(data: InitData) {
        const writer = new BinaryWriter();
        writer.writeUInt32(ServerClientPackets.INIT);
        writer.writeUInt8(data.quality);
        writer.writeUInt32(data.entireWidth);
        writer.writeUInt32(data.entireHeight);
        writer.writeUInt32(data.source.length);
        writer.writeStringUtf8(data.source);
        this.sendPacket(writer.toBuffer());
    }

    public sendStart() {
        const writer = new BinaryWriter();
        writer.writeUInt32(ServerClientPackets.START);
        this.sendPacket(writer.toBuffer());
    }

    public _runningJob(job: Job) {
        this._currentJobs.set(job.id.toString('ascii'), job);
        this._waitingCount--;
        this._setState(NodeState.RUNNING);
    }

    public sendPacket(buffer: Buffer) {
        const writer = new BinaryWriter();
        writer.writeUInt32(0xdeedbeaf);
        writer.writeUInt32(buffer.length + 8);
        writer.writeBytes(buffer);
        this._socket.write(writer.toBuffer());
    }
}

export { Node };
