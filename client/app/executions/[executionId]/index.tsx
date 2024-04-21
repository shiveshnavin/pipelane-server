import { AppContext } from "@/components/Context";
import { gql, useMutation } from "@apollo/client";
import { useLocalSearchParams } from "expo-router";
import { useRouteInfo, useRouter } from "expo-router/build/hooks";
import React, { useEffect, useState } from "react";
import { useContext } from "react";
import { Center, Expand, TextView, ThemeContext, Title, TransparentCenterToolbar, VBox, VPage } from "react-native-boxes";


export default function QueryPage() {
    const theme = useContext(ThemeContext)
    const { executionId } = useLocalSearchParams();
    const [pipeExecution, setPipeExecution] = useState<any>({})
    const appContext = useContext(AppContext)
    const api = appContext.context.api
    const router = useRouter()

    return (
        <VPage>
            <TransparentCenterToolbar
                title={executionId as string} homeIcon="arrow-left" forgroundColor={theme.colors.text} onHomePress={() => {
                    if (router.canGoBack())
                        router.back()
                    else
                        router.navigate(`/executions`)
                }} />
        </VPage>
    );
}