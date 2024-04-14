import { AppContext } from "@/components/Context";
import { gql, useMutation } from "@apollo/client";
import { useLocalSearchParams } from "expo-router";
import { useRouteInfo, useRouter } from "expo-router/build/hooks";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { TransparentCenterToolbar, Center, Expand, SimpleToolbar, TextView, ThemeContext, Title, VBox, VPage, CardView, CompositeTextInputView, SwitchView, HBox, SimpleDatalistView, SimpleDatatlistViewItem, Icon, Subtitle } from "react-native-boxes";
import { AlertMessage, Spinner } from "react-native-boxes";
import { Maybe, Pipelane, Pipetask, PipetaskExecution } from "../../../../../gen/model";
import { getGraphErrorMessage } from "@/common/api";

export default function PipeTaskPage() {
    const theme = useContext(ThemeContext)
    const { pipe: pipelaneName, task: taskVariantName } = useLocalSearchParams();
    const [curPipetask, setCurPipetask] = useState<Pipetask | undefined>(undefined)
    const [err, seterr] = useState<undefined | string>(undefined)
    const [loading, setLoading] = useState(true)
    const appContext = useContext(AppContext)
    const api = appContext.context.api

    function getPipetask(getTasks?: boolean) {

        setLoading(true)
        seterr(undefined)
        api.getPipetask(pipelaneName as string, taskVariantName as string).then(result => {
            setCurPipetask(result.data.Pipetask)
            if (!result.data.Pipetask) {
                seterr(`No task exists with name ${taskVariantName} in ${pipelaneName}`)
            }
        }).catch(error => {
            seterr(getGraphErrorMessage(error))
        }).finally(() => {
            setLoading(false)
        })
    }
    useEffect(() => {
        getPipetask()
    }, [pipelaneName, taskVariantName])

    return (
        <VPage>
            {
                err && <AlertMessage style={{
                    margin: theme.dimens.space.md,
                    width: '95%'
                }} text={err} type="critical" />
            }
            {
                loading && <Spinner style={{
                    marginTop: theme.dimens.space.xl
                }} />
            }
            {
                curPipetask && <PipetaskView pipetask={curPipetask} />
            }
        </VPage>
    );
}

function PipetaskView({ pipetask: inputPipetask }: { pipetask: Pipetask }) {
    const router = useRouter()
    const [task, setTask] = useState<Pipetask>(
        {
            ...inputPipetask,
            input: JSON.stringify(JSON.parse(inputPipetask.input as string), null, 2)
        })
    const [ignored, forceUpdate] = useReducer(x => x + 1, 0);
    const theme = useContext(ThemeContext)

    const appContext = useContext(AppContext)
    const api = appContext.context.api

    function getExecutions() {

    }

    return (
        <VBox>
            <TransparentCenterToolbar title={task.taskVariantName as string} />
            <Center><Subtitle>{task.pipelaneName}</Subtitle></Center>
            <CardView>
                <HBox style={{
                    padding: theme.dimens.space.md,
                    justifyContent: 'space-between'
                }}>
                    <TextView>Active</TextView>
                    <SwitchView
                        value={task.active as boolean}
                        onValueChange={(newV) => {
                            task.active = newV
                            forceUpdate()
                        }}
                    />
                </HBox>
                <CompositeTextInputView
                    placeholder="Task variant name"
                    value={task.taskVariantName as string}
                    onChangeText={(nt) => {
                        task.taskVariantName = nt
                        forceUpdate()
                    }}
                />

                <CompositeTextInputView
                    icon="close"
                    placeholder="Inputs"
                    _textInputProps={{
                        numberOfLines: 10,
                        multiline: true,
                        style: {
                            textAlignVertical: 'top',
                            verticalAlign: 'top',
                            alignContent: 'flex-start',
                        }
                    }}
                    onChangeText={(t: Maybe<string> | undefined) => {
                        task.input = t
                        forceUpdate()
                    }}
                    value={task.input as string}
                    initialText={task.input as string} />
            </CardView>
            <CardView>

                <Expand title="Executions" onExpand={() => {
                    getExecutions()
                }}>
                    <SimpleDatalistView
                        loading={task.executions == undefined}
                        items={(task.executions || []) as any}
                        itemAdapter={(item: PipetaskExecution) => {
                            return {
                                flexRatio: [0, 9, 1],
                                action: (
                                    <Icon
                                        color={theme.colors.text}
                                        name="arrow-right" />
                                ),
                                title: item.taskVariantName,
                                body: item.pipelaneName,
                                onPress: () => {
                                    router.navigate(`/home/${item.pipelaneName}/${item.taskVariantName}`)
                                }
                            }
                        }}
                    />

                </Expand>
            </CardView>
        </VBox>

    )

}

