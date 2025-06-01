import { Link, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { useContext } from "react";
import { AlertMessage, ButtonView, Center, Icon, SimpleDatalistView, TextView, ThemeContext, TransparentCenterToolbar, VPage, StatusIcon, HBox, VBox } from "react-native-boxes";
import { PipelaneExecution, Pipetask } from "../../../gen/model";
import { AppContext } from "../../components/Context";
import { getGraphErrorMessage } from "../../common/api";


export default function ExecutionsPage() {
    const theme = useContext(ThemeContext)
    const router = useRouter()
    const context = useContext(AppContext)
    const [executions, setExecutions] = useState<any>(undefined)
    const [err, setErr] = useState(undefined)
    const api = context.context.api
    useEffect(() => {
        api.executions().then(data => {
            setExecutions(data.data.executions)
        }).catch(e => {
            setErr(getGraphErrorMessage(e))
        })
    }, [])
    return (
        <VPage>
            <TransparentCenterToolbar
                title="Executions" homeIcon="arrow-left"
                forgroundColor={theme.colors.text}
                onHomePress={() => {
                    router.navigate(`/home`)
                }} />
            {
                err && <AlertMessage type="critical" text={err} />
            }
            <PipeExecutionsView executions={executions} router={router} />
        </VPage>
    );
}

export function PipeExecutionsView({ executions, router }: { executions: PipelaneExecution[], router: any }) {
    const theme = useContext(ThemeContext)
    return (
        <SimpleDatalistView
            loading={executions == undefined}
            items={executions || []}
            onRender={(item: PipelaneExecution, idx: number) => (
                <Link
                    href={`/executions/${item.id}`}
                    style={{ marginRight: 12, flex: 1, width: '100%' }}
                >
                    <HBox
                        key={item.name}
                        style={{
                            alignItems: 'center',
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            flex: 1,
                            width: '100%'
                        }}
                    >
                        <VBox style={{ flex: 1 }}>
                            <TextView style={{
                                color: theme.colors.accent,
                                fontWeight: 'bold', fontSize: 16
                            }}>
                                {item.id}
                            </TextView>
                            <TextView style={{
                                color: theme.colors.caption,
                                fontSize: 13
                            }}>
                                {(`${new Date(parseInt(item.startTime as string)).toLocaleString()}` + (item.endTime ? ` -> ${new Date(parseInt(item.endTime as string)).toLocaleString()}` : ''))}
                            </TextView>
                        </VBox>
                        <StatusIcon
                            status={item.status}
                            colorMap={[{
                                color: theme.colors.warning,
                                icon: "ban",
                                status: "SKIPPED"
                            }]}
                        />
                    </HBox>
                </Link>
            )}
            itemAdapter={(item: PipelaneExecution, idx) => {
                let criticality = item.status == 'SUCCESS' ? 'success' :
                    item.status == 'FAILED' ? 'critical' : 'info'
                return {
                    onPress: () => {
                        router.navigate(`/executions/${item.id}`)
                    },
                    flexRatio: [0, 8, 2],
                    action: (
                        <StatusIcon
                            status={item.status}
                            colorMap={[{
                                color: theme.colors.warning,
                                icon: "ban",
                                status: "SKIPPED"
                            }]}

                        />
                    ),
                    title: item.id,
                    body: (`${new Date(parseInt(item.startTime as string)).toLocaleString()}` + (item.endTime ? ` -> ${new Date(parseInt(item.endTime as string)).toLocaleString()}` : ''))
                }
            }} />
    )
}