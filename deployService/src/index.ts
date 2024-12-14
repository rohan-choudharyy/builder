import { createClient, commandOptions } from "redis";
import { downloadS3Folder, copyFinalDist } from "./aws";
import { buildProject } from "./utils";
import express from 'express';
import path from 'path';

console.log("Current working directory:", process.cwd());
console.log("__dirname:", __dirname);

const app = express();
app.listen(3002);

const publisher = createClient({
    url: process.env.REDIS_URL
});
publisher.connect();

const subscriber = createClient({
    url: process.env.REDIS_URL
});
subscriber.connect();

async function main(){
    while(1){
        const response = await publisher.brPop(
            commandOptions({ isolated: true}),
            'build-queue',
            0
        );

        if (!response) continue;
        const id = response.element;
        console.log(`Downloading for ID: ${id}`);
        await downloadS3Folder(`${id}/`);
        console.log("downloaded");
        await buildProject(id);
        copyFinalDist(id);
        publisher.hSet("status", id, "deployed")
        
    }
}
main();