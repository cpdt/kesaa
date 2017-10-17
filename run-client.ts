import { connect } from "net";
import { Node } from './client/Node';
import { JobRunner } from "./client/JobRunner";
import { BinaryWriter } from "./BinaryWriter";
import { Rect } from "./Rect";
import { ReturnState } from "./network";

const serverPort = 8282;

const socket = connect(serverPort);
const node = new Node(socket, getJobRunner);
socket.on('connect', () => {
    const addr = socket.address();
    console.log('Connected! ' + addr.address + ':' + addr.port);
});

function getJobRunner(): JobRunner {
    return {
        run(rect: Rect, data: BinaryWriter, done: (state: ReturnState) => void) {
            console.log('Processing rect ' + rect.x + ',' + rect.y + ',' + rect.width + ',' + rect.height);
            rect.serialize(data);
            done(ReturnState.OK);

            setTimeout(() => node.borrow(), 1000);
        },
        cancel() {
            console.log('Job was cancelled');
        }
    };
}

node.borrow();
