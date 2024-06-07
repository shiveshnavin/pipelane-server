import axios from "axios";
import PipeLane, { PipeTask } from "pipelane";
import { exec } from 'child_process'

export type ShellTaskAdditionalInput = {
    cmd: string
}

export class ShellTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "shell"
    static TASK_TYPE_NAME: string = "shell"

    allowedCommands = []

    constructor(variantName?: string, allowedCommands?: string[]) {
        super(ShellTask.TASK_TYPE_NAME, variantName || ShellTask.TASK_VARIANT_NAME)
        this.allowedCommands = allowedCommands || []
    }

    kill(): boolean {
        return true
    }


    isExecutableAllowed(command, allowedExecutables) {
        const commands = command.split(/[&;&|&&|]/);
        // Iterate through each command
        for (let i = 0; i < commands.length; i++) {
            const singleCommand = commands[i].trim().split(' ')[0];
            if (!allowedExecutables.includes(singleCommand)) {
                return false;
            }
        }
        return true;
    }


    async execute(pipeWorkInstance: PipeLane, input: { inputs: any[], additionalInputs: ShellTaskAdditionalInput }): Promise<any[]> {

        let cmd = input.additionalInputs.cmd

        if (!this.isExecutableAllowed(input.additionalInputs.cmd, this.allowedCommands)) {
            return [{
                status: false,
                message: 'Command not allowed'
            }]
        }

        return new Promise((resolve, reject) => {

            console.log('Executing command:', cmd)
            exec(cmd,
                (error, stdout, stderr) => {
                    if (error !== null) {
                        resolve([{
                            status: false,
                            message: 'Error in exec: ' + error
                        }])
                    } else {
                        resolve([{
                            status: true,
                            output: stdout
                        }])
                    }
                });

        })
    }

}