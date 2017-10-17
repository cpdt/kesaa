import { BinaryWriter } from '../BinaryWriter';
import { Rect } from "../Rect";
import { ReturnState } from "../network";

export interface JobRunner {
    run(rect: Rect, data: BinaryWriter, done: (state: ReturnState) => void): void;
    cancel(): void;
}
