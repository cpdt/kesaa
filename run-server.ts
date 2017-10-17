import { createServer } from "net";
import { Host } from './server/Host';
import { Rect } from "./Rect";

const serverPort = 8282;
const server = createServer();
const host = new Host(server);
server.listen(serverPort, () => {
    console.log('Listening on ' + serverPort);
});

const stageWidth = 1920;
const stageHeight = 1080;
const divX = 10;
const divY = 10;

const rectWidth = stageWidth / divX;
const rectHeight = stageHeight / divY;

const jobs = [];
for (let y = 0; y < divY; y++) {
    for (let x = 0; x < divX; x++) {
        const job = host.createJob(
            new Rect(x * rectWidth, y * rectHeight, rectWidth, rectHeight)
        );
        jobs.push(job);
        host.addJob(job);
    }
}
