export const WEB_PORT = 8281;
export const JOB_PORT = 8282;
export const REVERSE_JOIN_PORT = 8283;

export enum ServerClientPackets {
    INIT,
    SEND,
    CANCEL
}

export enum ClientServerPackets {
    BORROW,
    RETURN,
    PROGRESS
}

export enum ReturnState {
    OK,
    RETRY,
    OTHER,
    ERROR
}

