import { Node } from './Node';
import { BinaryReader } from '../common/BinaryReader';
import { BinaryWriter } from '../common/BinaryWriter';
import { Rect } from '../common/Rect';
import { ServerClientPackets } from "../common/network";
import { ReturnState } from "../common/network";
import { v4 as uuidv4 } from "uuid";
import { unparse } from 'uuid-parse';
import { JobState } from "../common/job-state";
import { EventEmitter } from 'events';

class Job extends EventEmitter {
    private _currentState: JobState = JobState.WAITING;
    private _blacklistNodes: Set<Node> = new Set<Node>();
    private _progress: number = 0;
    private _id: Buffer = new Buffer(16);
    private _result?: Buffer;

    public node: Node | null = null;

    public get progress(): number { return this._progress; }

    private _setState(state: JobState): void {
        this._currentState = state;
        this._iOnStateChange();
    }

    private _setProgress(val: number): void {
        this._progress = val;
        this._iOnProgressChange();
    }

    private _iOnStateChange(): void {
        console.log('[job] ' + this.stringId + ' state ' + JobState[this.state]);
        if (this.state === JobState.COMPLETED) this._setProgress(1);

        this.emit('stateChange', this.state);
    }

    private _iOnProgressChange(): void {
        console.log('[job] ' + this.stringId + ' progress ' + (this._progress * 100) + '%');

        this.emit('progressChange', this._progress);
    }

    private _iOnCompleted(reader: BinaryReader): void {
        const bufferSize = reader.readUInt32();
        const imageBuffer = reader.readBytes(bufferSize);
        this._result = imageBuffer;

        this.emit('completed', imageBuffer);
    }

    private _iSend(): void {
        if (this.node == null) return;
        const writer = new BinaryWriter();
        writer.writeUInt32(ServerClientPackets.SEND);
        writer.writeBytes(this._id);
        this._rect.serialize(writer);
        this.node.sendPacket(writer.toBuffer());
    }

    private _iCancel(): void {
        if (this.node == null) return;
        const writer = new BinaryWriter();
        writer.writeUInt32(ServerClientPackets.CANCEL);
        writer.writeBytes(this._id);
        this.node.sendPacket(writer.toBuffer());
    }

    private _finishProcess(state: ReturnState, reader: BinaryReader): void {
        if (this.node == null) return;
        if (this.node.host == null) return;

        const host = this.node.host;

        switch (state) {
            case ReturnState.OK:
                this._setState(JobState.COMPLETED);
                this._iOnCompleted(reader);
                break;

            case ReturnState.OTHER:
                this._blacklistNodes.add(this.node);
            case ReturnState.RETRY:
                this._setState(JobState.WAITING);
                this.node = null;
                host.addJob(this);
                break;

            case ReturnState.ERROR: this._setState(JobState.ERROR); break;
        }
    }

    public constructor(private _rect: Rect) {
        super();
        uuidv4(null, this._id, 0);
    }

    public get id(): Buffer { return this._id; }
    public get stringId(): string { return unparse(this._id); }
    public get state(): JobState { return this._currentState; }
    public get rect(): Rect { return this._rect; }
    public get result(): Buffer | undefined { return this._result; }

    public cancel(): void {
        this._iCancel();
        this._setState(JobState.CANCELLED);
        if (this.node) {
            this.node._jobCancelled(this);
        }
    }

    public _receiveReturn(reader: BinaryReader) {
        const state = reader.readUInt32() as ReturnState;
        this._finishProcess(state, reader);
    }

    public _receiveProgress(reader: BinaryReader) {
        this._setProgress(reader.readFloat());
    }

    public _sendTo(node: Node): boolean {
        if (this.node != null || this._blacklistNodes.has(node) || this.state !== JobState.WAITING) return false;

        this.node = node;
        this._setState(JobState.RUNNING);
        node._runningJob(this);
        this._iSend();

        return true;
    }
}

export { Job, JobState, ReturnState };
