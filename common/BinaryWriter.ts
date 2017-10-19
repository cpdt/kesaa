export class BinaryWriter {
    private _length: number = 0;
    private _buffer: Buffer;

    private _checkAlloc(size: number) {
        const needed = this._length + size;
        if (this._buffer.length >= needed) return;
        const chunk = Math.max((Buffer as any).poolSize as number, 1024);
        let chunkCount = (needed / chunk) >>> 0;
        if ((needed % chunk) > 0) chunkCount++;
        const buffer = new Buffer(chunkCount * chunk);
        this._buffer.copy(buffer, 0, 0, this._length);
        this._buffer = buffer;
    }

    constructor(sizeBuffer: number | Buffer = 0) {
        if (sizeBuffer instanceof Buffer) {
            this._buffer = sizeBuffer;
        } else {
            if (sizeBuffer <= 0) sizeBuffer = (Buffer as any).poolSize as number / 2;
            this._buffer = new Buffer(sizeBuffer);
        }
    }

    get offset(): number { return this._length; }
    set offset(val: number) {
        this._length = Math.max(0, val);
        this._checkAlloc(0);
    }

    reset() { this._length = 0; }

    toBuffer() {
        //return Buffer.concat([this._buffer.slice(0, this._length)]);
        return this._buffer.slice(0, this._length);
    }

    writeUInt8(val: number) {
        this._checkAlloc(1);
        this._buffer.writeUInt8(val, this._length);
        this._length++;
    }

    writeInt8(val: number) {
        this._checkAlloc(1);
        this._buffer.writeInt8(val, this._length);
        this._length++;
    }

    writeUInt16(val: number) {
        this._checkAlloc(2);
        this._buffer.writeUInt16LE(val, this._length);
        this._length += 2;
    }

    writeInt16(val: number) {
        this._checkAlloc(2);
        this._buffer.writeInt16LE(val, this._length);
        this._length += 2;
    }

    writeUInt32(val: number) {
        this._checkAlloc(4);
        this._buffer.writeUInt32LE(val, this._length);
        this._length += 4;
    }

    writeInt32(val: number) {
        this._checkAlloc(4);
        this._buffer.writeInt32LE(val, this._length);
        this._length += 4;
    }

    writeFloat(val: number) {
        this._checkAlloc(4);
        this._buffer.writeFloatLE(val, this._length);
        this._length += 4;
    }

    writeDouble(val: number) {
        this._checkAlloc(4);
        this._buffer.writeDoubleLE(val, this._length);
        this._length += 8;
    }

    writeBytes(data: Buffer) {
        this._checkAlloc(data.length);
        data.copy(this._buffer, this._length, 0, data.length);
        this._length += data.length;
    }

    writeStringUtf8(val: string) {
        const length = Buffer.byteLength(val, 'utf8');
        this._checkAlloc(length);
        this._buffer.write(val, this._length, length, 'utf8');
        this._length += length;
    }

    writeStringUnicode(val: string) {
        const length = Buffer.byteLength(val, 'ucs2');
        this._checkAlloc(length);
        this._buffer.write(val, this._length, length, 'ucs2');
        this._length += length;
    }

}