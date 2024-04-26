import { AppContext } from "@/components/Context";
import { gql } from "@apollo/client";
import { useLocalSearchParams } from "expo-router";
import { useRouter } from "expo-router/build/hooks";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { TransparentCenterToolbar, Expand, TextView, ThemeContext, VBox, VPage, CardView, CompositeTextInputView, SwitchView, HBox, SimpleDatalistView, Icon, DropDownView, ButtonView } from "react-native-boxes";
import { AlertMessage, Spinner } from "react-native-boxes";
import { Maybe, Pipetask, PipetaskExecution, TaskType } from "../../../../../gen/model";
import { getGraphErrorMessage } from "@/common/api";

export default function PipeTaskPage() {
    const theme = useContext(ThemeContext)
    const { task: name, pipe: pipelaneName } = useLocalSearchParams();
    const [curPipetask, setCurPipetask] = useState<Pipetask | undefined>(undefined)
    const [taskTypes, setTaskTypes] = useState([])
    const [err, seterr] = useState<undefined | string>(undefined)
    const [loading, setLoading] = useState(false)
    const appContext = useContext(AppContext)
    const router = useRouter()
    const api = appContext.context.api

    function getPipetask() {

        setLoading(true)
        seterr(undefined)
        if (name != 'new') {
            api.graph.query({
                query: gql`query PipeTasks($name: ID!, $pipelaneName: ID!) {
                    Pipetask(name: $name, pipelaneName: $pipelaneName) {
                      name
                      pipelaneName
                      taskVariantName
                      taskTypeName
                      isParallel
                      step
                      input
                      active
                    }
                    taskTypes {
                      type
                      variants
                    }
                  }
                  `,
                variables: {
                    pipelaneName,
                    name
                }
            }).then(result => {
                setCurPipetask(result.data.Pipetask)
                setTaskTypes(result.data.taskTypes)
                if (!result.data.Pipetask) {
                    seterr(`No task exists with name ${name} in ${pipelaneName}`)
                }
            }).catch(error => {
                seterr(getGraphErrorMessage(error))
            }).finally(() => {
                setLoading(false)
            })
        } else {
            let newTask = Object.assign({}, api.SAMPLE_PIPETASK)
            newTask.pipelaneName = pipelaneName as string
            api.graph.query({
                query: gql`
                        query TaskTypes {
                        taskTypes {
                            type
                            variants
                        }
                        }`,
                variables: {}
            }).then(result => {
                let taskTypes: TaskType[] = result.data.taskTypes
                newTask.taskTypeName = taskTypes[0].type
                newTask.taskVariantName = taskTypes[0].variants![0] as string
                setCurPipetask(newTask)
                setTaskTypes(result.data.taskTypes)
            }).catch(error => {
                seterr(getGraphErrorMessage(error))
            }).finally(() => {
                setLoading(false)
            })
        }
    }
    useEffect(() => {
        getPipetask()
    }, [pipelaneName, name])

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
                curPipetask && <PipetaskView
                    seterr={seterr}
                    save={(task: Pipetask) => {
                        if (task.taskTypeName == 'new') {
                            seterr('Please select the task type')
                            return
                        }
                        if (task.taskVariantName == 'new') {
                            seterr('Please select the task variant name')
                            return
                        }
                        if (task.name == 'new') {
                            seterr('Please enter task name')
                            return
                        }
                        setLoading(true)
                        seterr(undefined)
                        delete task.__typename
                        api.upsertPipelaneTask({ ...task }, (name && name != 'new' ? name : task.name) as string).then(result => {
                            setCurPipetask(result.data.createPipelaneTask)
                            if (result.data.createPipelaneTask.name != name) {
                                router.navigate(`/home/${result.data.createPipelaneTask.pipelaneName}/${result.data.createPipelaneTask.name}`)
                            }

                        }).catch((error) => {
                            seterr(getGraphErrorMessage(error))
                        }).finally(() => {
                            setLoading(false)
                        })
                    }}
                    taskTypes={taskTypes} pipetask={curPipetask} />
            }
        </VPage>
    );
}

function PipetaskView({ pipetask: inputPipetask, taskTypes, save, seterr }: { pipetask: Pipetask, taskTypes: TaskType[], save: Function, seterr: Function }) {
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
    const taskVariants = (taskTypes?.find(t => t.type == task.taskTypeName)?.variants || [])?.map(tt => ({
        id: tt,
        value: tt,
        title: tt,
    }))

    console.log(task)
    return (
        <VBox>
            <TransparentCenterToolbar
                options={[{
                    id: 'delete',
                    icon: 'trash',
                    title: 'Delete',
                    onClick: () => {
                        api.deletePipelaneTask(task.pipelaneName, task.name).then(() => {
                            router.navigate('/home/' + task.pipelaneName)
                        }).catch(e => seterr(getGraphErrorMessage(e)))
                    }
                }]}
                title={`${task.pipelaneName}   ➤   ${task.name}`} homeIcon="arrow-left" forgroundColor={theme.colors.text} onHomePress={() => {
                    router.navigate(`/home/${task.pipelaneName}`)
                }} />
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
                    icon="close"
                    placeholder="Name"
                    onChangeText={(t: string) => {
                        task.name = t
                        forceUpdate()
                    }}
                    value={task.name as string}
                    initialText={task.name as string} />
                <DropDownView
                    title="Task Type"
                    forceDialogSelectOnWeb={true}
                    onSelect={(taskTypeName) => {
                        task.taskTypeName = taskTypeName
                        forceUpdate()
                    }}
                    selectedId={task.taskTypeName}
                    options={taskTypes?.map(tt => ({
                        id: tt.type,
                        value: tt.type,
                        title: tt.type,
                    }) || [])} />
                <DropDownView
                    title="Task Variant"
                    forceDialogSelectOnWeb={true}
                    onSelect={(taskVariantName) => {
                        task.taskVariantName = taskVariantName
                        forceUpdate()
                    }}
                    selectedId={task.taskVariantName}
                    //@ts-ignore
                    options={taskVariants} />
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
                <ButtonView onPress={() => {
                    save(task)
                }}>Save</ButtonView>
            </CardView>
        </VBox>

    )

}

