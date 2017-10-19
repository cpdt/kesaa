
declare module 'uuid-parse' {
    export function parse(id: string, buffer?: Array<number> | Buffer | null, offset?: number | null): Buffer;
    export function unparse(buffer: Array<number> | Buffer, offset?: number | null): string;
}
