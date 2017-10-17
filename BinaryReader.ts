export class BinaryReader {
    private _offset: number = 0;

    constructor(private _buffer: Buffer) { }

    get offset(): number { return this._offset; }
    set offset(val: number) {
        this._offset = Math.max(0, Math.min(val, this._buffer.length));
    }

    readUInt8(): number {
        const val = this._buffer.readUInt8(this._offset);
        this._offset += 1;
        return val;
    }

    readInt8(): number {
        const val = this._buffer.readInt8(this._offset);
        this._offset += 1;
        return val;
    }

    readUInt16(): number {
        const val = this._buffer.readUInt16LE(this._offset);
        this._offset += 2;
        return val;
    }

    readInt16(): number {
        const val = this._buffer.readInt16LE(this._offset);
        this._offset += 2;
        return val;
    }

    readUInt32(): number {
        const val = this._buffer.readUInt32LE(this._offset);
        this._offset += 4;
        return val;
    }

    readInt32(): number {
        const val = this._buffer.readInt32LE(this._offset);
        this._offset += 4;
        return val;
    }

    readFloat(): number {
        const val = this._buffer.readFloatLE(this._offset);
        this._offset += 4;
        return val;
    }

    readDouble(): number {
        const val = this._buffer.readDoubleLE(this._offset);
        this._offset += 8;
        return val;
    }

    readBytes(length: number): Buffer {
        const val = this._buffer.slice(this._offset, this._offset + length);
        this._offset += length;
        return val;
    }

    skipBytes(length: number) {
        this._offset += length;
    }

    readStringUtf8(length?: number): string {
        if (length == null) length = this._buffer.length - this._offset;
        length = Math.max(0, length);
        const val = this._buffer.toString('utf8', this._offset, this._offset + length);
        this._offset += length;
        return val;
    }

    readStringUnicode(length?: number): string {
        if (length == null) length = this._buffer.length - this._offset;
        length = Math.max(0, length);
        const safeLength = Math.max(0, length - (length % 2));
        const val = this._buffer.toString('ucs2', this._offset, this._offset + safeLength);
        this._offset += length;
        return val;
    }
}
