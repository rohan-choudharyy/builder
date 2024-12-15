import { createClient, commandOptions } from "redis";
import { downloadS3Folder, copyFinalDist } from "./aws";
import { buildProject } from "./utils";
import express from 'express';
import path from 'path';
import * as dotenvSafe from 'dotenv-safe';

dotenvSafe.config({
    path: '.env',
    example: '.env.example'
})

console.log("Current working directory:", process.cwd());
console.log("__dirname:", __dirname);

const app = express();
app.listen(3002);

const publisher = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_URL,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined
    }
});

publisher.on('error', err => console.log('Redis Client Error', err));

publisher.connect();

const subscriber = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_URL,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT): undefined
    }
});

subscriber.on('error', err => console.log('Redis Client Error', err));
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
        subscriber.hSet("status", id, "deployed")
        
    }
}
main();