import { NodeState } from "./node-state";
import { JobState } from "./job-state";
import { WebState } from "./web-state";

export interface ClientData {
    ip: string;
}

export interface ClientListData {
    clients: ClientData[];
}

export interface SetupData {
    quality: number;
    povSource: string;
    imageWidth: number;
    imageHeight: number;
    jobRows: number;
    jobColumns: number;
}

export interface StateData {
    state: WebState;
}

export interface IntervalRenderData {
    totalProgress: number;
    remainingSeconds: number;
    clients: string[];
}

export interface JobRenderData {
    state: JobState;
    progress: number;
    image?: Buffer;
}

export interface JobUpdateData extends JobRenderData {
    id: number;
}

export interface FullRenderData extends IntervalRenderData {
    jobs: JobRenderData[];
    setup: SetupData;
}

/*export interface UpdateDataClient {
    ip: string;
    state: NodeState;
    currentX: number;
    currentY: number;
    progress: number;
}

export interface UpdateDataJob {
    state: JobState;
    progress: number;
}

export interface UpdateData {
    totalProgress: number;
    remainingSeconds: number;
    clients: UpdateDataClient[];
    jobs?: UpdateDataJob[];
}

export interface UpdateJobData {
    index: number;
    data: UpdateDataJob;
}

export interface SetJobImageData {
    index: number;
    data: Buffer;
}

export interface SaveImageData {
    buffer: Buffer;
}*/
