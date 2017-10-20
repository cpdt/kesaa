import { Host } from "./Host";
import {
    ClientListData, SetupData, StateData, ClientData,
    IntervalRenderData, JobRenderData, FullRenderData, JobUpdateData
} from "../common/web-messages";
import { WebState } from "../common/web-state";
import { EventEmitter } from "events";
import { Node } from "./Node";
import { Job } from "./Job";
import { NodeState } from "../common/node-state";
import { Rect } from "../common/Rect";
import {InitData} from "../common/InitData";

export class RenderManager {
    private _state: WebState;
    private _jobWidth: number;
    private _jobHeight: number;
    private _jobList: Job[] = [];
    private _startTime?: Date;
    private _updateInterval: NodeJS.Timer | null;
    private _completedJobs: number = 0;

    private static _getClientDataFor(node: Node): ClientData {
        return {
            ip: node.socket.remoteAddress as string
        };
    }

    private static _getJobData(job: Job): JobRenderData {
        return {
            state: job.state,
            progress: job.progress,
            image: job.result
        };
    }

    private static _sendJobUpdateTo(socket: EventEmitter, job: Job, id: number): void {
        const data = RenderManager._getJobData(job) as JobUpdateData;
        data.id = id;
        socket.emit('jobUpdate', data);
    }

    constructor(private _io: SocketIO.Server, private _host: Host, private _setup: SetupData) {
        _host.reset();

        this._jobWidth = this._setup.imageWidth / this._setup.jobColumns;
        this._jobHeight = this._setup.imageHeight / this._setup.jobRows;

        // setup jobs
        for (let y = 0; y < this._setup.jobRows; y++) {
            for (let x = 0; x < this._setup.jobColumns; x++) {
                const job = new Job(
                    new Rect(Math.floor(x * this._jobWidth), Math.floor(y * this._jobHeight), Math.floor(this._jobWidth), Math.floor(this._jobHeight))
                );
                this._jobList.push(job);
                this._host.addJob(job);
            }
        }

        const initData: InitData = {
            source: _setup.povSource,
            quality: _setup.quality,
            entireWidth: _setup.imageWidth,
            entireHeight: _setup.imageHeight
        };
        this._host.sendInitData(initData);

        this.state = WebState.WAITING;
    }

    private _getIntervalRenderData(): IntervalRenderData {
        let totalProgress = 0;
        for (const job of this._jobList) {
            totalProgress += job.progress;
        }
        totalProgress /= this._jobList.length;

        let remainingSeconds = 0;
        if (this._startTime && totalProgress > 0) {
            const currentTime = new Date();
            const progressedTime = (currentTime.getTime() - this._startTime.getTime()) / 1000;
            remainingSeconds = progressedTime / totalProgress * (1 - totalProgress);
        }

        const clientStrings = this._host.connectedNodes.map((node: Node): string => {
            let str = (node.socket.remoteAddress || "<error>") + " - ";
            switch (node.state) {
                case NodeState.IDLE:
                    str += 'idle';
                    break;
                case NodeState.WAITING:
                    str += 'waiting';
                    break;
                case NodeState.INVALID:
                    str += 'error';
                    break;
                case NodeState.RUNNING:
                    str += node.currentJobs.map((job: Job): string => {
                        const rectX = job.rect.x / this._jobWidth;
                        const rectY = job.rect.y / this._jobHeight;
                        return '(' + rectX + ',' + rectY + ') @ ' + (job.progress * 100).toFixed(2) + '%';
                    }).join(', ');
            }
            return str;
        });

        return {
            totalProgress,
            remainingSeconds,
            clients: clientStrings
        };
    }

    /* STATE UPDATES */
    private _sendStateUpdateTo(socket: EventEmitter): void {
        // updates state
        const stateData: StateData = { state: this._state };
        socket.emit('state', stateData);

        // update per-state data
        switch (this._state) {
            /*case WebState.SETUP:
                this._sendSetupUpdateTo(socket);
                break;*/
            case WebState.WAITING:
            case WebState.RENDER:
            case WebState.FINISHED:
                this._sendRenderUpdateTo(socket);
                break;
        }
    }

    private _sendRenderUpdateTo(socket: EventEmitter): void {
        const data = this._getIntervalRenderData() as FullRenderData;
        data.jobs = this._jobList.map(RenderManager._getJobData);
        data.setup = this._setup;
        socket.emit('fullData', data);
    }

    private _finish(): void {
        this.state = WebState.FINISHED;
        this._clearUpdateInterval();
    }

    private _clearUpdateInterval(): void {
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
            this._updateInterval = null;
        }
    }

    public get state(): WebState { return this._state; }
    public set state(newState: WebState) {
        this._state = newState;
        this._sendStateUpdateTo(this._io.sockets);
    }

    public start(): void {
        if (this._state !== WebState.WAITING) return;

        this._startTime = new Date();

        // start updating clients with some info
        this._updateInterval = setInterval(() => {
            this._io.sockets.emit('intervalData', this._getIntervalRenderData());
        }, 100);

        // start listening for job changes
        for (let i = 0; i < this._jobList.length; i++) {
            const job = this._jobList[i];
            job.on('stateChange', () => RenderManager._sendJobUpdateTo(this._io.sockets, job, i));
            job.on('progressChange', () => RenderManager._sendJobUpdateTo(this._io.sockets, job, i));
            job.on('completed', () => {
                RenderManager._sendJobUpdateTo(this._io.sockets, job, i);
                this._completedJobs++;
                if (this._completedJobs >= this._jobList.length) this._finish();
            });
        }

        this.state = WebState.RENDER;
        this._host.start();
    }

    public cancel(): void {
        this._clearUpdateInterval();
        for (const job of this._jobList) {
            job.cancel();
        }
    }

    public onConnection(socket: SocketIO.Socket) {
        this._sendStateUpdateTo(socket);
    }
}
