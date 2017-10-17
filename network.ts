export enum ServerClientPackets {
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

