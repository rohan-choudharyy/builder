import { S3 } from "aws-sdk";
import * as dotenvSafe from "dotenv-safe";
import fs from "fs";
import { console } from "inspector";
import path, { resolve } from "path";

dotenvSafe.config({
    path: '.env',
    example: '.env.example'
});

const s3 = new S3({
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    endpoint: process.env.CLOUDFLARE_ENDPOINT
})

export async function downloadS3Folder(prefix: string){
    // Use absolute path and ensure it's created
    const outputDir = path.resolve(process.cwd(), 'dist/output');
    
    try {
        // Explicitly create the output directory
        fs.mkdirSync(outputDir, { recursive: true });
    } catch (mkdirError) {
        console.error("Failed to create output directory:", mkdirError);
    }

    console.log("Absolute Output Directory Path:", outputDir);
    console.log("Does output directory exist?", fs.existsSync(outputDir));
    console.log("Current working directory:", process.cwd());
    console.log("Downloading prefix:", prefix);

    try {
        const allFiles = await s3.listObjectsV2({
            Bucket: process.env.CLOUDFLARE_BUCKET!,
            Prefix: prefix  
        }).promise();

        console.log("Total files found:", allFiles.Contents?.length);

        const allPromises = allFiles.Contents?.map(async ({Key}) => {
            return new Promise(async (resolve, reject) => {
                if (!Key) {
                    resolve("");
                    return;
                }
                
                const finalOutput = path.join(outputDir, Key);
                console.log("Attempting to download file:", Key);
                console.log("Final output path:", finalOutput);

                const dirName = path.dirname(finalOutput);
                
                try {
                    // Ensure directory exists
                    fs.mkdirSync(dirName, { recursive: true });
                    
                    const outputFile = fs.createWriteStream(finalOutput);
                    
                    s3.getObject({
                        Bucket: process.env.CLOUDFLARE_BUCKET!,
                        Key
                    }).createReadStream()
                    .on('error', (err) => {
                        console.error("S3 download error:", err);
                        reject(err);
                    })
                    .pipe(outputFile)
                    .on("finish", () => {
                        console.log("File downloaded successfully:", Key);
                        resolve("");
                    })
                    .on('error', (err) => {
                        console.error("File write error:", err);
                        reject(err);
                    });
                } catch (err) {
                    console.error("Directory creation error:", err);
                    reject(err);
                }
            })
        }) || []

        console.log("Total download promises:", allPromises.length);
        await Promise.all(allPromises);
        console.log("Download process completed");
    } catch (error) {
        console.error("Overall download process error:", error);
    }
}

const getAllFiles = (folderPath: string) => {
    let response: string[] = [];
    const allFilesAndFolder = fs.readdirSync(folderPath);
    allFilesAndFolder.forEach(file => {
        const fullFilePath = path.join(folderPath, file);
        if(fs.statSync(fullFilePath).isDirectory()){
            response = response.concat(getAllFiles(fullFilePath))
        } else{
            response.push(fullFilePath);
        }
    });
    return response;
}

const uploadFile = async (fileName: string, localFilePath: string) => {
    const fileContent = fs.readFileSync(localFilePath);
    const response = await s3.upload({
        Body: fileContent,
        Bucket: process.env.CLOUDFLARE_BUCKET!,
        Key: fileName,
    }).promise();
    console.log(response);
}

export function copyFinalDist(id: string){
    const folderPath = path.join(__dirname, `output/${id}/dist`);
    const allFiles = getAllFiles(folderPath);
    allFiles.forEach(file => {
        uploadFile(`dist/${id}/` + file.slice(folderPath.length + 1), file);
    }) 
}