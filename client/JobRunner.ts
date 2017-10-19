import { BinaryWriter } from '../common/BinaryWriter';
import { Rect } from "../common/Rect";
import { ReturnState } from "../common/network";
import { InitData } from "../common/InitData";

export interface JobRunnerParams {
    jobId: string,
    rect: Rect,
    data: InitData,
    filename: string,
    writer: BinaryWriter
}

export interface JobRunner {
    run(
        params: JobRunnerParams,
        progress: (val: number) => void,
        done: (state: ReturnState) => void
    ): void;
    cancel(): void;
}
