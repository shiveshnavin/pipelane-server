import { getGraphErrorMessage } from "@/common/api";
import { AppContext } from "@/components/Context";
import { Link, useLocalSearchParams } from "expo-router";
import { useRouter } from "expo-router/build/hooks";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { Animated, Easing } from "react-native";
import { AlertMessage, StatusIcon, BottomSheet, CardView, Center, CompositeTextInputView, HBox, SimpleDatalistView, Spinner, Subtitle, TextView, ThemeContext, TransparentCenterToolbar, VBox, VPage, Icon } from "react-native-boxes";
import { PipelaneExecution, PipetaskExecution } from "../../../../gen/model";
import { prettyJson } from "../../../common/utils/ReactUtils";


export default function QueryPage() {
    const theme = useContext(ThemeContext)
    const router = useRouter()
    const context = useContext(AppContext)
    const { executionId } = useLocalSearchParams()
    const [execution, setExecution] = useState<PipelaneExecution | undefined>(undefined)
    const [err, setErr] = useState(undefined)
    const [loading, setLoading] = useState(false)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const api = context.context.api
    const [taskDetails, setTaskDetails] = useState<PipetaskExecution | undefined>(undefined)

    const spinValue = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.timing(
                spinValue,
                {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.linear,
                    useNativeDriver: true
                }
            )
        );
        if (autoRefresh) {
            animation.start();
        } else {
            spinValue.stopAnimation();
            spinValue.setValue(0);
        }
        return () => {
            spinValue.stopAnimation();
        }
    }, [autoRefresh, spinValue])

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    })


    function refresh(stop?: Boolean) {
        api.pipelaneExecution(executionId as string).then(data => {
            setExecution(data.data.PipelaneExecution)
            if (autoRefresh) {
                if (data.data.PipelaneExecution.status == 'IN_PROGRESS') {
                    setTimeout(refresh, 500)
                } else if (!stop) {
                    setTimeout(() => {
                        refresh(true);
                        setAutoRefresh(false)
                    }, 5000)
                }
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
                options={[
                    ...(
                        (execution?.status == "IN_PROGRESS") ? [{
                            id: 'stop',
                            icon: loading ?
                                <Spinner size="small" color={theme.colors.critical} />
                                :
                                <Icon name="stop" color={theme.colors.critical} />
                            ,
                            title: 'Stop',
                            onClick: () => {
                                if (loading)
                                    return;
                                setLoading(true)
                                api.stopPipelaneExecution(executionId as string).then(() => {
                                    setLoading(false)
                                    refresh()
                                }).catch(e => {
                                    setLoading(false)
                                    setErr(getGraphErrorMessage(e))
                                })
                            }
                        }] : []
                    ),
                    {
                        id: 'refresh',
                        icon: <Animated.View style={{ transform: [{ rotate: spin }] }}><Icon name="refresh" /></Animated.View>,
                        title: autoRefresh ? 'Pause Auto-Refresh' : 'Start Auto-Refresh',
                        onClick: () => {
                            if (!autoRefresh) {
                                refresh()
                            }
                            setAutoRefresh(a => !a)
                        }
                    }
                ]}
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
                                        type={
                                            execution.status == 'SUCCESS' ? 'success' :
                                                execution.status == 'FAILED' ? 'critical' :
                                                    execution.status == 'SKIPPED' ? 'warning' : 'info'}
                                        style={{ width: 10 }}
                                        text={execution.status as string} />
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
                            items={execution?.tasks || []}
                            itemAdapter={(item: PipetaskExecution, idx) => {

                                return {
                                    onPress: () => {
                                        setTaskDetails(item)
                                    },
                                    flexRatio: [0, 8, 3],
                                    action: (
                                        <StatusIcon
                                            status={item.status}
                                            colorMap={[{
                                                color: theme.colors.warning,
                                                icon: "ban",
                                                status: "SKIPPED"
                                            }]} />
                                    ),
                                    title: (<Link style={{
                                        color: theme.colors.accent
                                    }} href={`/home/${execution?.name}/${item.name}`}>{item?.name}</Link>) as any,
                                    body: (`${new Date(parseInt(item.startTime as string)).toLocaleString()}` + (item.endTime ? ` -> ${new Date(parseInt(item.endTime as string)).toLocaleString()}` : ''))
                                }
                            }} />

                        <Subtitle style={{
                            fontWeight: '900',
                            paddingStart: theme.dimens.space.lg,
                        }}>Output</Subtitle>
                        <CardView>
                            <CompositeTextInputView
                                editable={false}
                                placeholder="Outputs"
                                textInputProps={{
                                    numberOfLines: 10,
                                    multiline: true,
                                    style: {
                                        color: theme.colors.text,
                                        textAlignVertical: 'top',
                                        verticalAlign: 'top',
                                        alignContent: 'flex-start',
                                    }
                                }}
                                value={prettyJson(execution.output!) || ''}
                                initialText={prettyJson(execution.output!) || ''} />

                        </CardView>
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
                                    textInputProps={{
                                        numberOfLines: 10,
                                        multiline: true,
                                        style: {
                                            color: theme.colors.text,
                                            textAlignVertical: 'top',
                                            verticalAlign: 'top',
                                            alignContent: 'flex-start',
                                        }
                                    }}
                                    value={prettyJson(taskDetails?.output!) || ''}
                                    initialText={prettyJson(taskDetails?.output!) || ''} />

                            </VBox>

                        </BottomSheet>

                    </VBox>
                ) : (
                    <Spinner />
                )}
        </VPage>)
}
