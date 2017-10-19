import { Node } from './Node';
import { Job } from './Job';
import { Server, Socket } from 'net';
import { EventEmitter } from 'events';
import { InitData } from "../common/InitData";

class Host extends EventEmitter {
    private _jobQueue: Job[] = [];
    private _waitingNodes: Node[] = [];

    private _connectedNodes: Node[] = [];
    public get connectedNodes(): ReadonlyArray<Node> {
        return this._connectedNodes;
    }

    private _iOnJobQueued(job: Job): void {

    }

    private _serverConnection(socket: Socket) {
        const node = new Node(socket);
        this.addNode(node);
        this.emit('connection', node, socket);
    }

    constructor(private _server: Server) {
        super();
        this._server.on('connection', this._serverConnection.bind(this));
    }

    public get queueSize(): number { return this._jobQueue.length; }

    public addNode(node: Node): boolean {
        if (node.host != null) return false;
        node.host = this;
        this._connectedNodes.push(node);
        return true;
    }

    public removeNode(node: Node) {
        node.host = null;

        let index: number;
        index = this._connectedNodes.indexOf(node);
        if (index !== -1) this._connectedNodes.splice(index, 1);

        while ((index = this._waitingNodes.indexOf(node)) !== -1) {
            this._waitingNodes.splice(index, 1);
        }
    }

    public addJob(job: Job): void {
        this._iOnJobQueued(job);

        if (!this._waitingNodes.length) {
            console.log('[job] ' + job.stringId + ' queueing');
            this._jobQueue.push(job);
            return;
        }

        // if there is a waiting node, send to it
        let cursorLocation = 0;
        while (!job._sendTo(this._waitingNodes[cursorLocation])) {
            cursorLocation++;
            if (cursorLocation >= this._waitingNodes.length) {
                this._jobQueue.push(job);
                return;
            }
        }
        this._waitingNodes.splice(cursorLocation, 1);
    }

    public removeJob(job: Job): void {
        const index = this._jobQueue.indexOf(job);
        if (index !== -1) this._jobQueue.splice(index, 1);
    }

    public sendInitData(data: InitData) {
        for (const node of this._connectedNodes) {
            node.sendInitData(data);
        }
    }

    public sendStart() {
        for (const node of this._connectedNodes) {
            node.sendStart();
        }
    }

    public _requestBorrow(node: Node): void {
        if (this._jobQueue.length === 0) {
            this._waitingNodes.push(node);
            return;
        }

        for (let i = 0; i < this._jobQueue.length; i++) {
            if (this._jobQueue[i]._sendTo(node)) {
                this._jobQueue.splice(i, 1);
                return;
            }
        }
        this._waitingNodes.push(node);
    }
}

export { Host };
