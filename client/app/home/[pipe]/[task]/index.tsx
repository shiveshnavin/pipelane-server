import { AppContext } from "@/components/Context";
import { gql, useMutation } from "@apollo/client";
import { useLocalSearchParams } from "expo-router";
import { useRouteInfo, useRouter } from "expo-router/build/hooks";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { TransparentCenterToolbar, Center, Expand, SimpleToolbar, TextView, ThemeContext, Title, VBox, VPage, CardView, CompositeTextInputView, SwitchView, HBox, SimpleDatalistView, SimpleDatatlistViewItem, Icon, Subtitle, DropDownView } from "react-native-boxes";
import { AlertMessage, Spinner } from "react-native-boxes";
import { Maybe, Pipelane, Pipetask, PipetaskExecution, TaskType } from "../../../../../gen/model";
import { getGraphErrorMessage } from "@/common/api";

export default function PipeTaskPage() {
    const theme = useContext(ThemeContext)
    const { pipe: pipelaneName, task: taskVariantName } = useLocalSearchParams();
    const [curPipetask, setCurPipetask] = useState<Pipetask | undefined>(undefined)
    const [taskTypes, setTaskTypes] = useState([])
    const [err, seterr] = useState<undefined | string>(undefined)
    const [loading, setLoading] = useState(true)
    const appContext = useContext(AppContext)
    const api = appContext.context.api

    function getPipetask() {

        setLoading(true)
        seterr(undefined)

        api.graph.query({
            query: gql`query PipeTasks($taskVariantName: ID!, $pipelaneName: ID!) {
                Pipetask(taskVariantName: $taskVariantName, pipelaneName: $pipelaneName) {
                  pipelaneName
                  taskVariantName
                  taskTypeName
                  isParallel
                  input
                }
                taskTypes {
                  type
                  variants
                }
              }
              `,
            variables: {
                pipelaneName,
                taskVariantName
            }
        }).then(result => {
            setCurPipetask(result.data.Pipetask)
            setTaskTypes(result.data.taskTypes)
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
                curPipetask && <PipetaskView taskTypes={taskTypes} pipetask={curPipetask} />
            }
        </VPage>
    );
}

function PipetaskView({ pipetask: inputPipetask, taskTypes }: { pipetask: Pipetask, taskTypes: TaskType[] }) {
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
                <DropDownView
                    title="Task Type"
                    forceDialogSelectOnWeb={true}
                    onSelect={(taskTypeName) => {
                        task.taskTypeName = taskTypeName
                        forceUpdate()
                    }}
                    selectedId={task.taskTypeName}
                    options={taskTypes.map(tt => ({
                        id: tt.type,
                        value: tt.type,
                        title: tt.type,
                    }))} />
                <DropDownView
                    title="Task Variant"
                    forceDialogSelectOnWeb={true}
                    onSelect={(taskVariantName) => {
                        task.taskVariantName = taskVariantName
                        forceUpdate()
                    }}
                    selectedId={task.taskVariantName}
                    //@ts-ignore
                    options={taskTypes?.find(t => t.type == task.taskTypeName)?.variants?.map(tt => ({
                        id: tt,
                        value: tt,
                        title: tt,
                    }) || [])} />
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

