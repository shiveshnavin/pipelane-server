import axios from "axios";
//@ts-ignore
import PipeLane, { PipeTask } from "pipelane";
import fs from 'fs';
import { Parser } from 'json2csv';

export class WriteCsvFileTask extends PipeTask<any, any> {

    static TASK_TYPE_NAME: string = "write-file"
    static TASK_VARIANT_NAME: string = "csv"

    constructor(variantName?: string) {
        super(WriteCsvFileTask.TASK_TYPE_NAME, variantName || WriteCsvFileTask.TASK_VARIANT_NAME)
    }

    kill(): boolean {
        return true
    }
    async execute(pipeWorksInstance: PipeLane, inputs: any): Promise<any[]> {

        let jsonData = inputs.last.filter(item => item.status == true);
        let format = inputs.additionalInputs?.format || "csv";
        let file = inputs.additionalInputs?.file || `${pipeWorksInstance.instanceId}.${format}`;
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
            lines: jsonData.length,
            status: jsonData.length > 0
        }];


    }

}