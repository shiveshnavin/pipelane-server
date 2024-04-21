import React from "react"
import { Api } from "@/common/api"

export class ContextData {
    appname: string = ''
    initialized: boolean = false
    api!: Api

    constructor(api?: Api) {
        this.api = api!
    }
}
export const AppContext = React.createContext({
    context: new ContextData(undefined),
    setContext: (updatedCtx: ContextData) => { }
})
