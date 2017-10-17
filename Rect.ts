import { BinaryReader } from './BinaryReader';
import { BinaryWriter } from './BinaryWriter';

export class Rect {
    public get x(): number { return this._x; }
    public get y(): number { return this._y; }
    public get width(): number { return this._width; }
    public get height(): number { return this._height; }

    public static deserialize(reader: BinaryReader): Rect {
        return new Rect(
            reader.readFloat(),
            reader.readFloat(),
            reader.readFloat(),
            reader.readFloat()
        );
    }

    constructor(
        private _x: number,
        private _y: number,
        private _width: number,
        private _height: number) {
    }

    public serialize(writer: BinaryWriter): void {
        writer.writeFloat(this._x);
        writer.writeFloat(this._y);
        writer.writeFloat(this._width);
        writer.writeFloat(this._height);
    }
}
