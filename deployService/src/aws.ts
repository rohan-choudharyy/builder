import { S3 } from "aws-sdk";
import * as dotenvSafe from "dotenv-safe";
import fs from "fs";
import path from "path";

dotenvSafe.config({
    path: '.env',
    example: '.env.example'
});

const s3 = new S3({
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    endpoint: process.env.CLOUDFLARE_ENDPOINT
});



export async function downloadS3Folder(prefix: string) {
    const outputDir = path.resolve(process.cwd(), 'dist/output');
    
    try {

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


const getAllFiles = (folderPath: string): string[] => {
    let response: string[] = [];
    const allFilesAndFolder = fs.readdirSync(folderPath);
    
    allFilesAndFolder.forEach(file => {
        const fullFilePath = path.join(folderPath, file);
        if(fs.statSync(fullFilePath).isDirectory()){
            response = response.concat(getAllFiles(fullFilePath));
        } else {
            response.push(fullFilePath);
        }
    });
    
    return response;
}


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


const uploadFile = async (fileName: string, localFilePath: string) => {
    try {
        const fileContent = fs.readFileSync(localFilePath);
        const uploadParams = {
            Body: fileContent,
            Bucket: process.env.CLOUDFLARE_BUCKET!,
            Key: fileName,
            ContentType: getContentType(localFilePath)
        };

        const response = await s3.upload(uploadParams).promise();
        console.log(`Successfully uploaded ${fileName}:`, response);
        return response;
    } catch (error) {
        console.error(`Error uploading ${fileName}:`, error);
        throw error;
    }
}


export async function copyFinalDist(id: string) {
    const folderPath = path.join(__dirname, `output/${id}/build`);

    if (!fs.existsSync(folderPath)) {
        console.error(`Directory does not exist: ${folderPath}`);
        return; 
    }

    const allFiles = getAllFiles(folderPath);
    
    const uploadPromises = allFiles.map(async file => {
        const relativePath = path.relative(folderPath, file);
        const uploadKey = `dist/output/${id}/${relativePath}`;
        console.log(`Uploading file: ${file} to key: ${uploadKey}`);
        try {
            await uploadFile(uploadKey, file);
        } catch (err) {
            console.error(`Failed to upload ${file}:`, err);
        }
    });

    await Promise.all(uploadPromises);
    console.log('All files upload process completed');
}
