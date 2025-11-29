import axios from "axios";
import fs from 'fs'
import PipeLane, { InputWithPreviousInputs, OutputWithStatus, PipeTask, PipeTaskDescription } from "pipelane";
import { createHash } from "crypto";
import moment from 'moment'
//@ts-ignore
import { XMLParser } from "fast-xml-parser";


const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true
});


export type EvaluateJsTaskInput = InputWithPreviousInputs & {
    last: OutputWithStatus[],
    additionalInputs: {
        js: string
    }
}

export const EvalJSUtils = {
    fs: fs,
    getXmlParser() {
        return parser
    },
    xml2json(xmlText: string) {
        return parser.parse(xmlText);
    },
    mkdir(path: string) {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path, { recursive: true })
        }
    },
    escapeJSONString(str: string) {
        return str
            .replace(/"/g, '\\"');
    },
    randomElement<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    },
    generateUID(input: string, length = 10): string {
        return createHash("sha256").update(input).digest("hex").substring(0, length);
    },
    generateHashCode(input: string, maxValue = 1000000000): number {
        const safeInput = input ?? ''
        const safeMax = Math.max(1, Math.floor(Number(maxValue) || 0))
        const hashHex = createHash('sha256').update(safeInput).digest('hex')
        const hashInt = BigInt('0x' + hashHex)
        const bounded = Number(hashInt % BigInt(safeMax))
        return bounded
    },
    extractEnclosedObjString(inputString) {
        const regex = /\{[^\}]*\}/g;
        const results = inputString.match(regex);
        return results[0];
    },
    extractCodeFromMarkdown(markdown) {
        let codeBlocks = [];
        let regex = /```(.+?)\s*([\s\S]+?)```/gs;
        let match;
        while ((match = regex.exec(markdown))) {
            codeBlocks.push(match[2]);
        }
        return codeBlocks;
    },
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            // Generate a random index between 0 and i (inclusive)
            const j = Math.floor(Math.random() * (i + 1));

            // Swap elements at i and j
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },
    refineString(str, replacementChar = "_") {
        const regexPattern = new RegExp(`[^a-zA-Z0-9]`, "g");
        return str.replace(regexPattern, replacementChar);
    },
    generateRandomID(length = 10) {
        const characters =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";

        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            result += characters.charAt(randomIndex);
        }

        return result;
    },
    getFileNameFromURL(url: string) {
        const parsedURL = new URL(url);
        const pathname = parsedURL.pathname;
        const parts = pathname.split("/");
        const filename = parts[parts.length - 1];
        return filename;
    },
    decodeBase64(base64: string): string {
        return Buffer.from(base64, "base64").toString("utf8");
    },
    getMoment() {
        return moment
    },
    formatDate(date: Date, format: string) {
        return moment(date).format(format);
    },
    encodeBase64(normalString: string): string {
        return Buffer.from(normalString).toString("base64");
    },
    async sleep(ms) {
        return await new Promise((resolve) => {
            setTimeout(resolve, ms);
        })
    }
}

/**
 * Deprecated. Use LoopEvaluateJsTask instead
 */
export class EvaluateJsTask extends PipeTask<EvaluateJsTaskInput, any> {

    static TASK_VARIANT_NAME: string = "eval-js"
    static TASK_TYPE_NAME: string = "eval-js"
    timeoutId: any

    constructor(variantName?: string) {
        super(EvaluateJsTask.TASK_TYPE_NAME, variantName || EvaluateJsTask.TASK_VARIANT_NAME)
    }

    kill(): boolean {
        return true
    }

    describe(): PipeTaskDescription | undefined {
        return {
            summary: "Process JS. Must return in format [{status:true}]",
            inputs: {
                additionalInputs: {
                    js: "string, The js code, for example: console.log(pl.inputs);\n//the last line of the must be an array in output\n[{status:true, ...other data}]"
                },
                last: [{
                    status: true
                }]
            }
        }
    }
    async evalInScope(js, pl, input, prev, axios, Utils = EvalJSUtils) {
        return await eval(js)
    }

    /**
     * 
     * @param pipeWorksInstance 
     * @param input { additionalInputs: {js} }, No need to enclose js in this input with ${} as it is           understood that the value of field js is a javascript string
     * @returns 
     */
    async execute(pipeWorksInstance: PipeLane, input: EvaluateJsTaskInput): Promise<any[]> {
        if (!input.additionalInputs.js) {
            return [{
                status: false,
                message: 'invalid input. required field `js` in additionalInputs  missing'
            }]
        }

        let js = input.additionalInputs.js
        let prev = input.last
        try {
            let output = await this.evalInScope(js, pipeWorksInstance, input, prev, axios, EvalJSUtils)
            return [{
                status: true,
                output: output
            }]
        } catch (e) {
            return [{
                status: false,
                error: e.message,
                stack: JSON.stringify(e.stack || '').substring(0, 100)
            }]
        }
    }


    async evaluatePlaceholdersInString(
        pl: PipeLane,
        input: InputWithPreviousInputs,
        jsInputString: string): Promise<string | undefined> {
        const placeholderRegex = /\${([^}]+)}/g;
        let prev = input.last
        //@ts-ignore
        let replacedString = jsInputString;
        const matches = jsInputString.matchAll(placeholderRegex);
        for (const match of matches) {
            const [fullMatch, placeholder] = match;
            const result = await this.evalInScope(placeholder.trim(), pl, input, prev, axios, EvalJSUtils);
            replacedString = replacedString.replace(fullMatch, result?.toString());
        }

        return replacedString
    }
}


const cut = new EvaluateJsTask()
function test() {
    cut.execute(new PipeLane({}, 'js'), {
        additionalInputs: {
            js: "${task.taskTypeName}"
        },
        last: []
    })
}

// test()

function testGenerateHashCode() {
    const input = 'hash-demo'
    const maxValue = 5
    const hash = EvalJSUtils.generateHashCode(input, maxValue)
    console.log('generateHashCode', { input, maxValue, hash })
    console.assert(Number.isInteger(hash), 'Hash should be integer')
    console.assert(hash >= 0 && hash < maxValue, 'Hash should be within range')
    const hashRepeat = EvalJSUtils.generateHashCode(input, maxValue)
    console.assert(hash === hashRepeat, 'Hash should be deterministic')
}

// testGenerateHashCode()