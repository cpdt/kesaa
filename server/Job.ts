import { Node } from './Node';
import { BinaryReader } from '../BinaryReader';
import { BinaryWriter } from '../BinaryWriter';
import { Rect } from '../Rect';
import { ServerClientPackets } from "../network";
import { ReturnState } from "../network";

enum JobState {
    WAITING,
    RUNNING,
    COMPLETED,
    CANCELLED,
    ERROR
}

class Job {
    private _currentState: JobState = JobState.WAITING;
    private _blacklistNodes: Set<Node> = new Set<Node>();
    private _progress: number;

    public node: Node | null = null;

    public get progress(): number { return this._progress; }

    private _setState(state: JobState): void {
        this._currentState = state;
        this._iOnStateChange();
    }

    private _iOnStateChange(): void {
        console.log('[job] #' + this.id + ' state ' + JobState[this.state]);
    }

    private _iOnProgressChange(): void {
        // todo
    }

    private _iSend(): void {
        if (this.node == null) return;
        const writer = new BinaryWriter();
        writer.writeUInt32(ServerClientPackets.SEND);
        writer.writeUInt32(this._id);
        this._rect.serialize(writer);
        this.node._sendPacket(writer.toBuffer());
    }

    private _iCancel(): void {
        if (this.node == null) return;
        const writer = new BinaryWriter();
        writer.writeUInt32(ServerClientPackets.CANCEL);
        writer.writeUInt32(this._id);
        this.node._sendPacket(writer.toBuffer());
    }

    private _finishProcess(state: ReturnState): void {
        if (this.node == null) return;
        if (this.node.host == null) return;

        const host = this.node.host;

        switch (state) {
            case ReturnState.OK: this._setState(JobState.COMPLETED); break;

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

    public constructor(private _id: number, private _rect: Rect) {
    }

    public get id(): number { return this._id; }
    private get state(): JobState { return this._currentState; }

    public cancel(): void {
        if (this.node == null) return;
        this._iCancel();
        this._setState(JobState.CANCELLED);
    }

    public _receiveReturn(reader: BinaryReader) {
        const state = reader.readUInt32() as ReturnState;

        if (state === ReturnState.OK) {
            //const blobSize = reader.readUInt32();
            //const imageBlob = reader.readBytes(blobSize);
            // todo: something with the image blob
        }

        this._finishProcess(state);
    }

    public _receiveProgress(reader: BinaryReader) {
        this._progress = reader.readFloat();
        this._iOnProgressChange();
    }

    // todo: actually use the return value from this
    public _sendTo(node: Node): boolean {
        if (this.node != null || this._blacklistNodes.has(node)) return false;

        this.node = node;
        this._setState(JobState.RUNNING);
        node._runningJob(this);
        this._iSend();

        return true;
    }
}

export { Job, JobState, ReturnState };
