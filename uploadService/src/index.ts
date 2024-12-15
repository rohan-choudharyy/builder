
import express, {Request, Response} from 'express';
import cors from "cors";
import { generate } from './generate';
import simpleGit from 'simple-git'; 
import { getAllFiles } from './filePath';
import path from 'path';
import { uploadFile } from './aws';
import { createClient } from 'redis';

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
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined
    }
});

subscriber.on('error', err => console.log('Redis Client Error', err));

subscriber.connect();

const app = express();
app.use(cors());
app.use(express.json());


app.post('/deploy', async(req: Request, res: Response) => {
    const repoURL = req.body.repoURL;
    const id = generate();
    const clonedPath = path.join(__dirname, `output/${id}`);

    await simpleGit().clone(repoURL, clonedPath);

    const files = getAllFiles(clonedPath);
    for (const file of files) {
        const key = path.join(id, file.slice(clonedPath.length + 1));
        await uploadFile(key.replace(/\\/g, '/'), file);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
    publisher.lPush("build-queue", id);
    publisher.hSet("status", id, "uploaded");
    res.json({
        id: id
    });
})

app.get('/status', async(req, res) => {
    const id = req.query.id;
    const response = await subscriber.hGet("status", id as string);
    res.json({
        status: response
    })
})

app.listen(3000);