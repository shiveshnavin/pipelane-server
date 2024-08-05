import axios from "axios";
//@ts-ignore
import PipeLane, { PipeTask } from "pipelane";
import fs from 'fs';
import { Parser } from 'json2csv';

export class WriteFileTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "write-file"
    static TASK_TYPE_NAME: string = "write-file"

    constructor(variantName?: string) {
        super(WriteFileTask.TASK_TYPE_NAME, variantName || WriteFileTask.TASK_VARIANT_NAME)
    }

    kill(): boolean {
        return true
    }
    async execute(pipeWorkInstance: PipeLane, inputs: any): Promise<any[]> {

        let jsonData = inputs.last;
        let format = inputs.additionalInputs?.format || "csv";
        let file = inputs.additionalInputs?.file || `${pipeWorkInstance.name}.${format}`;
        let incremental = inputs.additionalInputs?.incremental || true;

        const fields = Object.keys(jsonData[0]);
        const opts = { fields };
        const parser = new Parser(opts);

        if (incremental && format === "csv") {
            const writeStream = fs.createWriteStream(file, { flags: 'a' });
            const fileExists = fs.existsSync(file);
            if (!fileExists) {
                const header = fields.join(',') + '\n';
                writeStream.write(header);
            }
            jsonData.forEach((item) => {
                const csvRow = parser.parse([item]).split('\n')[1] + '\n';
                writeStream.write(csvRow);
            });
            writeStream.end();
        } else if (format === "csv") {
            const csvData = parser.parse(jsonData);
            fs.writeFileSync(file, csvData);
        } else {
            return [{
                file,
                message: 'Format not supported ' + format,
                status: false
            }];
        }

        return [{
            file,
            lines:jsonData.length,
            status: true
        }];


    }

}