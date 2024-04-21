import { getGraphErrorMessage } from "@/common/api";
import { AppContext } from "@/components/Context";
import { gql, useMutation } from "@apollo/client";
import { Link, useLocalSearchParams } from "expo-router";
import { useRouteInfo, useRouter } from "expo-router/build/hooks";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { AlertMessage, BottomSheet, CardView, Center, CompositeTextInputView, Expand, HBox, SimpleDatalistView, Spinner, Subtitle, TextView, ThemeContext, Title, TransparentCenterToolbar, VBox, VPage } from "react-native-boxes";
import { PipelaneExecution, PipetaskExecution } from "../../../../gen/model";
import { prettyJson } from "@/common/utils/ReactUtils";
import { StatusIcon } from "@/components/StatusIcon";


export default function QueryPage() {
    const theme = useContext(ThemeContext)
    const router = useRouter()
    const context = useContext(AppContext)
    const { executionId } = useLocalSearchParams()
    const [execution, setExecution] = useState<PipelaneExecution | undefined>(undefined)
    const [err, setErr] = useState(undefined)
    const api = context.context.api
    const [taskDetails, setTaskDetails] = useState<PipetaskExecution | undefined>(undefined)
    function refresh() {
        api.pipelaneExecution(executionId as string).then(data => {
            setExecution(data.data.PipelaneExecution)
            if (data.data.PipelaneExecution.status == 'IN_PROGRESS') {
                setTimeout(refresh, 5000)
            }
        }).catch(e => {
            setErr(getGraphErrorMessage(e))
        })
    }
    useEffect(() => {
        refresh()
    }, [executionId]);

    const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

    return (
        <VPage>
            <TransparentCenterToolbar
                options={[{
                    id: 'refresh',
                    icon: 'refresh',
                    title: 'Refresh',
                    onClick: () => {
                        setExecution(undefined)
                        setTimeout(refresh, 1000)
                    }
                }]}
                title={execution?.id || ''} homeIcon="arrow-left"
                forgroundColor={theme.colors.text}
                onHomePress={() => {
                    if (router.canGoBack())
                        router.back()
                    else
                        router.navigate(`/executions`)
                }} />
            <Center style={{
                padding: 0,
                paddingBottom: theme.dimens.space.md
            }}>
                <Link style={{
                    color: theme.colors.accent
                }} href={`/home/${execution?.name}`}>{execution?.name}</Link>
            </Center>
            {
                err && <AlertMessage type="critical" text={err} />
            }
            {
                execution ? (
                    <VBox>
                        <CardView>
                            <VBox>
                                <HBox style={{
                                    justifyContent: 'space-between'
                                }}>
                                    <AlertMessage
                                        type={execution.status == 'SUCCESS' ? 'success' : execution.status == 'FAILED' ? 'critical' : 'info'} style={{ width: 10 }} text={execution.status as string} />
                                </HBox>
                                <HBox style={{
                                    justifyContent: 'space-between'
                                }}>
                                    <TextView>Started</TextView>
                                    <TextView>{new Date(parseInt(execution.startTime as string)).toLocaleString()}</TextView>
                                </HBox>
                                {
                                    execution.endTime && <HBox style={{
                                        justifyContent: 'space-between'
                                    }}>
                                        <TextView>Ended</TextView>
                                        <TextView>{new Date(parseInt(execution.endTime as string)).toLocaleString()}</TextView>
                                    </HBox>
                                }
                                <CompositeTextInputView
                                    editable={false}
                                    placeholder="Outputs"
                                    _textInputProps={{
                                        numberOfLines: 10,
                                        multiline: true,
                                        style: {
                                            textAlignVertical: 'top',
                                            verticalAlign: 'top',
                                            alignContent: 'flex-start',
                                        }
                                    }}
                                    value={prettyJson(execution.output) || ''}
                                    initialText={prettyJson(execution.output) || ''} />

                            </VBox>
                        </CardView>
                        <Subtitle style={{
                            fontWeight: '900',
                            paddingStart: theme.dimens.space.lg,
                        }}>Executed Tasks</Subtitle>
                        <SimpleDatalistView
                            style={{
                                padding: theme.dimens.space.md,
                            }}
                            items={execution?.tasks || []} itemAdapter={(item: PipetaskExecution, idx) => {

                                return {
                                    onPress: () => {
                                        setTaskDetails(item)
                                    },
                                    flexRatio: [0, 8, 3],
                                    action: (
                                        <StatusIcon status={item.status
                                        } />
                                    ),
                                    title: item.name,
                                    body: (`${new Date(parseInt(item.startTime as string)).toLocaleString()}` + (item.endTime ? ` -> ${new Date(parseInt(item.endTime as string)).toLocaleString()}` : ''))
                                }
                            }} />
                        <BottomSheet
                            title={taskDetails?.name}
                            visible={taskDetails != undefined}
                            onDismiss={() => {
                                setTaskDetails(undefined)
                            }}
                        >
                            <VBox>
                                <CompositeTextInputView
                                    editable={false}
                                    placeholder="Outputs"
                                    _textInputProps={{
                                        numberOfLines: 10,
                                        multiline: true,
                                        style: {
                                            textAlignVertical: 'top',
                                            verticalAlign: 'top',
                                            alignContent: 'flex-start',
                                        }
                                    }}
                                    value={prettyJson(taskDetails?.output) || ''}
                                    initialText={prettyJson(taskDetails?.output) || ''} />

                            </VBox>

                        </BottomSheet>

                    </VBox>
                ) : (
                    <Spinner />
                )}
        </VPage>)
}