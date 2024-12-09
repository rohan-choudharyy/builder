
import express, {Request, Response} from 'express';
import cors from "cors";
import { generate } from './generate';
import simpleGit from 'simple-git'; 
import { getAllFiles } from './filePath';
import path from 'path';
import { uploadFile } from './aws';
import { createClient } from 'redis';

const publisher = createClient();
publisher.connect();

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

    publisher.lPush("build-queue", id);
    res.json({
        id: id
    });
})

app.listen(3000);