import { S3 } from "aws-sdk";
import fs from 'fs';
import * as dotenvSafe from "dotenv-safe";
import path from "path";

dotenvSafe.config({
    path: '.env',
    example: '.env.example'
});

const s3 = new S3({
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    endpoint: process.env.CLOUDFLARE_ENDPOINT
})

export const uploadFile = async (fileName: string, localFilePath:string) => {
    const fileContent = fs.readFileSync(localFilePath);
    const response = await s3.upload({
        Body: fileContent,
        Bucket: process.env.CLOUDFLARE_BUCKET!,
        Key: fileName
    }).promise();
    console.log(response);
}