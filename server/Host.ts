import { Node } from './Node';
import { Job } from './Job';
import { Server, Socket } from 'net';
import { Rect } from '../Rect';

class Host {
    private _jobQueue: Job[] = [];
    private _waitingNodes: Node[] = [];
    private _nextJobId: number = 0;

    private _iOnJobQueued(job: Job): void {

    }

    private _serverConnection(socket: Socket) {
        const addr = socket.address();
        console.log('Received connection from ' + addr.address + ':' + addr.port);
        this.addNode(new Node(socket));
    }

    constructor(private _server: Server) {
        this._server.on('connection', this._serverConnection.bind(this));
    }

    public get queueSize(): number { return this._jobQueue.length; }

    public createJob(r: Rect): Job {
        return new Job(this._nextJobId++, r);
    }

    public addNode(node: Node): boolean {
        if (node.host != null) return false;
        node.host = this;
        return true;
    }

    public removeNode(node: Node) {
        node.host = null;

        let index: number;
        while ((index = this._waitingNodes.indexOf(node)) !== -1) {
            this._waitingNodes.splice(index, 1);
        }
    }

    public addJob(job: Job): void {
        this._iOnJobQueued(job);

        if (!this._waitingNodes.length) {
            console.log('[job] #' + job.id + ' queueing');
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

    public _requestBorrow(node: Node): void {
        if (this._jobQueue.length === 0) {
            this._waitingNodes.push(node);
            return;
        }

        if (this._jobQueue[0]._sendTo(node)) {
            this._jobQueue.shift();
        } else {
            this._waitingNodes.push(node);
        }
    }
}

export { Host };
