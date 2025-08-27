import axios from "axios";
import PipeLane, { PipeTask, PipeTaskDescription } from "pipelane";
import { exec } from 'child_process'
import { RateLimiter } from "limiter";

export type ShellTaskAdditionalInput = {
    cmd: string
}

export class LoopShellTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "loop-shell"
    static TASK_TYPE_NAME: string = "shell"

    allowedCommands = []

    constructor(variantName?: string, allowedCommands?: string[]) {
        super(LoopShellTask.TASK_TYPE_NAME, variantName || LoopShellTask.TASK_VARIANT_NAME)
        this.allowedCommands = allowedCommands || []
    }

    kill(): boolean {
        return true
    }


    describe(): PipeTaskDescription | undefined {
        return {
            summary: 'Task to execute shell commands',
            inputs: {
                last: [{
                    cmd: "string, the shell command to run"
                }],
                additionalInputs: {
                    sequential: "boolean, if true, other rate fields will be ignored",
                    rate: "Number, x requests / Y interval",
                    interval: "day | hour | min | sec",
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


    async execute(
        pipeWorksInstance: PipeLane,
        input: { last: any[]; additionalInputs: { cmd?: string; sequential?: boolean; rate?: number; interval?: any } }
    ): Promise<any[]> {
        const { additionalInputs } = input;
        const singleCmd = additionalInputs?.cmd;

        // Commands can come from input.inputs (array) or single cmd
        const cmds: string[] =
            (input?.last || [])
                .map(x => (typeof x === "string" ? x : x?.cmd))
                .filter(Boolean);

        if (singleCmd && cmds.length === 0) cmds.push(singleCmd);

        if (!cmds.length) {
            return [{ status: false, message: "No command(s) provided" }];
        }

        const limiter = new RateLimiter({
            tokensPerInterval: additionalInputs?.rate ?? 10,
            interval: additionalInputs?.interval ?? "second",
        });

        const runOne = (rawCmd: string) =>
            new Promise<any>(resolve => {
                if (!this.isExecutableAllowed(rawCmd, this.allowedCommands)) {
                    return resolve({ status: false, cmd: rawCmd, message: "Command not allowed" });
                }

                const wrapped = `source ~/.bash_profile >/dev/null 2>&1 || true; ${rawCmd}`;
                pipeWorksInstance.onLog?.(`Executing: ${rawCmd}`);

                exec(wrapped, (error, stdout, stderr) => {
                    if (error) {
                        resolve({ status: false, cmd: rawCmd, message: `Error: ${error.message}`, stderr });
                    } else {
                        resolve({ status: true, cmd: rawCmd, output: stdout, stderr });
                    }
                });
            });

        const outputs: any[] = [];

        if (!additionalInputs?.sequential) {
            // Parallel with rate limiting
            const tasks = cmds.map(async c => {
                await limiter.removeTokens(1);
                return runOne(c);
            });
            const results = await Promise.all(tasks);
            outputs.push(...results);
        } else {
            // Sequential execution
            for (const c of cmds) {
                const res = await runOne(c);
                outputs.push(res);
            }
        }

        return outputs;
    }

}
