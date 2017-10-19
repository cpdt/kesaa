import { NodeState } from "./node-state";
import { JobState } from "./job-state";
import { WebState } from "./web-state";

export interface ConnectData {
    ip: string;
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
    data: SetupData | null;
}

export interface UpdateDataClient {
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
}
