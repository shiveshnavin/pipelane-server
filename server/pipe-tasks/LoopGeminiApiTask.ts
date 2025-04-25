import axios from "axios";
//@ts-ignore
import PipeLane, { PipeTask } from "pipelane";


const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");

const { GoogleAIFileManager } = require("@google/generative-ai/server");

const apiKey = 'AIzaSyDS1Q3rcXkSGygRYYr99vBU_Oo_DyAbj78';
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

async function uploadToGemini(path, mimeType): Promise<{ uri: string, mimeType: string }> {
    const uploadResult = await fileManager.uploadFile(path, {
        mimeType,
        displayName: path,
    });
    const file = uploadResult.file;
    console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
    return file;
}

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
});

const generationConfig = {
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

type InputPart = {
    text?: string,
    fileData?: {
        mimeType: string
        localFileUri?: string
        fileUri?: string
    }
}

export type GeminiApiTaskInput = {
    additionalInputs?: {
        parts: InputPart[]
    },
    last?: { parts: InputPart[] }[]
}
export class LoopGeminiApiTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "gemini"
    static TASK_TYPE_NAME: string = "llm"

    constructor(variantName?: string) {
        super(LoopGeminiApiTask.TASK_TYPE_NAME, variantName || LoopGeminiApiTask.TASK_VARIANT_NAME)
    }

    kill(): boolean {
        return true
    }

    private async callGemini(parts: InputPart[]) {
        let finalParts = []

        await Promise.all(parts.map(part => {
            return new Promise(async (resolve, reject) => {

                try {
                    if (part.fileData?.localFileUri) {
                        let fileRes = (await uploadToGemini(part.fileData?.localFileUri, part.fileData.mimeType))
                        part.fileData.fileUri = fileRes.uri
                        part.fileData.mimeType = fileRes.mimeType
                        delete part.fileData?.localFileUri
                    }
                    finalParts.push(part)
                    resolve(part)
                } catch (e) {
                    reject(e)
                }

            })
        }))

        const result = await model.generateContent({
            contents: [{ role: "user", parts: finalParts }],
            generationConfig,
        });

        return result
    }

    async execute(pipeWorksInstance: PipeLane, data: GeminiApiTaskInput): Promise<any[]> {
        let inputs = data.last || [data.additionalInputs]
        if (!inputs) {
            return [{
                status: false,
                message: `invalid input. Required {
                                additionalInputs: {
                                    parts: InputPart[]
                                },
                                last: { parts: InputPart[] }[]
                            }`
            }]
        }

        let outputs = []

        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            try {
                let response = await this.callGemini(input.parts)
                outputs.push({ ...response, status: true })
            } catch (e) {
                pipeWorksInstance.onLog(e.message)
                outputs.push({ message: e.message, status: false })
            }
        }

        return outputs

    }

}


// let gem = new LoopGeminiApiTask()
// gem.execute(new PipeLane({}), {
//     additionalInputs: {
//         parts: [
//             { text: "Extract the objects in the provided image and output them in a list in alphabetical order" }
//         ]
//     }
// }).then(console.log)
