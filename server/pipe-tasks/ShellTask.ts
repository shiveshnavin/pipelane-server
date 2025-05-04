import axios from "axios";
import PipeLane, { PipeTask, PipeTaskDescription } from "pipelane";
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


    describe(): PipeTaskDescription | undefined {
        return {
            summary: 'Task to execute shell commands',
            inputs: {
                last: [],
                additionalInputs: {
                    cmd: "string, the shell command to run"
                }
            }
        }
    }

    isExecutableAllowed(command, allowedExecutables) {
        if (allowedExecutables.includes("*"))
            return true
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


    async execute(pipeWorksInstance: PipeLane, input: { inputs: any[], additionalInputs: ShellTaskAdditionalInput }): Promise<any[]> {

        let cmd = input.additionalInputs.cmd

        if (!this.isExecutableAllowed(input.additionalInputs.cmd, this.allowedCommands)) {
            return [{
                status: false,
                message: 'Command not allowed'
            }]
        }

        return new Promise((resolve, reject) => {

            console.log('Executing command:', `bash -c "source ~/.bash_profile && ${cmd}" `)
            exec(cmd,
                (error, stdout, stderr) => {
                    if (error !== null) {
                        resolve([{
                            status: false,
                            message: 'Error in exec: ' + error + ' : ' + stderr
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
