import React from "react"
import { Api } from "@/common/api"
import { Theme } from "react-native-boxes"

export class ContextData {
    appname: string = ''
    initialized: boolean = false
    theme: Theme = new Theme()
    api!: Api
    themeName = "dark"

    constructor(api?: Api) {
        this.api = api!
    }
}

type SetContext = (updatedCtx: ContextData) => ContextData
export const AppContext = React.createContext({
    context: new ContextData(undefined),
    setContext: (updatedCtx: ContextData) => { }
} as {
    context: ContextData,
    setContext: React.Dispatch<React.SetStateAction<ContextData>>
})
