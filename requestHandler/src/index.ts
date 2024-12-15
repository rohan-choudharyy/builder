import express from "express";
import { S3 } from "aws-sdk";
import * as dotenvSafe from 'dotenv-safe';
import path from 'path';

dotenvSafe.config({
    path: '.env',
    example: '.env.example'
});

const s3 = new S3({
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    endpoint: process.env.CLOUDFLARE_ENDPOINT
})

const app = express();

function getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch(ext) {
        case '.html': return 'text/html';
        case '.css': return 'text/css';
        case '.js': return 'application/javascript';
        case '.json': return 'application/json';
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.svg': return 'image/svg+xml';
        case '.webp': return 'image/webp';
        default: return 'application/octet-stream';
    }
}

app.get('*', async(req, res) => {
    try {
        const host = req.hostname;
        const id = host.split(".")[0];
        
        const filePath = req.path.startsWith('/') ? req.path : `/${req.path}`;
        
        const key = `dist/output/${id}${filePath}`;

        console.log(`Attempting to retrieve file: ${key}`);

        const contents = await s3.getObject({
            Bucket: process.env.CLOUDFLARE_BUCKET!,
            Key: key
        }).promise();

        const type = getContentType(filePath);
        res.set("Content-Type", type);

        res.send(contents.Body);
    } catch (error) {
        console.error('Error retrieving file:', error);
        
        if (error && typeof error === 'object' && 'code' in error && error.code === 'NoSuchKey') {
            res.status(404).send('File not found');
        } else {
            res.status(500).send('Internal server error');
        }
    }
})

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});