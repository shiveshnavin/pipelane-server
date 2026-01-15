import { Pipelane } from "../../gen/model";

export const PipelaneUtils = {
    generatePipelaneId(pipelaneName: string): string {
        return `${PipelaneUtils.refineString(pipelaneName)}`;
    },
    generatePipelaneTaskId(pipelaneName: string, pipeTaskName: string): string {
        return `${PipelaneUtils.refineString(pipelaneName)}::${PipelaneUtils.refineString(pipeTaskName)}`;
    },


    /**
     * Removes all special characters and spaces from a string, leaving only alphanumeric characters.
     * replaces them with optional replacement character (default is underscore).
     * @param str 
     * @param replacementChar
     * @param str 
     * @returns 
     */
    refineString(str: string | null | undefined, replacementChar: string = '-'): string {
        if (!str) return '';
        return str.replace(/[^a-zA-Z0-9]/g, replacementChar);
    }
}


