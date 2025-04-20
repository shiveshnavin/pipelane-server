import { AppContext } from "@/components/Context";
import { gql } from "@apollo/client";
import { useLocalSearchParams } from "expo-router";
import { useRouter } from "expo-router/build/hooks";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { TransparentCenterToolbar, Expand, TextView, ThemeContext, VBox, VPage, CardView, CompositeTextInputView, SwitchView, HBox, SimpleDatalistView, Icon, DropDownView, ButtonView, Caption, ConfirmationDialog, Box, Center } from "react-native-boxes";
import { AlertMessage, Spinner } from "react-native-boxes";
import { Maybe, Pipetask, PipetaskExecution, TaskType } from "../../../../../gen/model";
import { getGraphErrorMessage, removeFieldRecursively } from "@/common/api";
import Editor from "@monaco-editor/react";

export default function PipeTaskPage() {
    const theme = useContext(ThemeContext)
    const { task: name, pipe: pipelaneName } = useLocalSearchParams();
    const [curPipetask, setCurPipetask] = useState<Pipetask | undefined>(undefined)
    const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
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
                      description {
                        summary
                        inputs {
                            last
                            additionalInputs
                        }
                      }
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

                        try {
                            JSON.parse(task.input as string)
                            seterr(undefined)
                        } catch (e) {
                            seterr('Input must be a valid JSON string')
                            return
                        }
                        setLoading(true)
                        seterr(undefined)
                        delete task.__typename

                        api.upsertPipelaneTask({ ...task }, (name && name != 'new' ? name : task.name) as string).then(result => {
                            setCurPipetask(result.data.createPipelaneTask)
                            if (result.data.createPipelaneTask.name != name) {
                                router.navigate(`/home/${result.data.createPipelaneTask.pipelaneName}/${result.data.createPipelaneTask.name}`)
                            } else {
                                router.navigate('/home/' + task.pipelaneName)
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
    let taskInput = JSON.stringify(JSON.parse(inputPipetask.input as string), null, 2)
    if (!taskInput || taskInput == '{}') {
        const matchingTaskType = taskTypes.find(t => t.type == inputPipetask.taskTypeName)
        if (matchingTaskType && matchingTaskType?.description) {
            const desc = removeFieldRecursively(matchingTaskType?.description, "__typename")
            taskInput = JSON.stringify(desc, null, 2)
        }
    }
    const [task, setTask] = useState<Pipetask>(
        {
            ...inputPipetask,
            input: taskInput
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
    taskVariants?.unshift({
        id: 'auto',
        value: 'auto',
        title: 'auto'
    })
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    return (
        <VBox>
            <TransparentCenterToolbar
                options={[{
                    id: 'delete',
                    icon: 'trash',
                    title: 'Delete',
                    onClick: () => {
                        setShowDeleteConfirm(true)
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
                            setTask((task) => {
                                task.active = newV
                                return task
                            })
                            forceUpdate()
                        }}
                    />
                </HBox>
                <HBox style={{
                    padding: theme.dimens.space.md,
                    justifyContent: 'space-between'
                }}>
                    <TextView>Parallel execution</TextView>
                    <SwitchView
                        value={task.isParallel as boolean}
                        onValueChange={(newV) => {
                            setTask((task) => {
                                task.isParallel = newV
                                return task
                            })
                            forceUpdate()
                        }}
                    />
                </HBox>
                <CompositeTextInputView
                    icon="close"
                    placeholder="Name"
                    onChangeText={(t: string) => {
                        setTask((task) => {
                            task.name = t
                            return task
                        })
                        forceUpdate()
                    }}
                    value={task.name as string}
                    initialText={task.name as string} />
                <DropDownView
                    title="Task Type"
                    forceDialogSelectOnWeb={true}
                    onSelect={(taskTypeName) => {
                        setTask((task) => {
                            task.taskTypeName = taskTypeName
                            if (task.taskTypeName !== taskTypeName) {
                                task.taskVariantName = 'auto'
                            }
                            return task
                        })
                        forceUpdate()
                    }}
                    selectedId={task.taskTypeName}
                    options={taskTypes?.map(tt => ({
                        id: tt.type,
                        value: tt.type,
                        title: tt.type,
                    })) || []} />
                <DropDownView
                    title="Task Variant"
                    forceDialogSelectOnWeb={true}
                    onSelect={(taskVariantName) => {
                        setTask((task) => {
                            task.taskVariantName = taskVariantName
                            return task
                        })
                        forceUpdate()
                    }}
                    selectedId={task.taskVariantName || 'auto'}
                    //@ts-ignore
                    options={taskVariants} />
                <Center style={{
                    borderWidth: 0.1,
                    borderColor: theme.colors.caption,
                    borderRadius: 10,
                    padding: 3,
                    margin: theme.dimens.space.sm
                }}>
                    <Editor
                        onChange={(t: Maybe<string> | undefined) => {

                            setTask((task) => {
                                task.input = t
                                return task
                            })
                            forceUpdate()
                        }}
                        height="30vh"
                        defaultLanguage="json"
                        defaultValue={task.input as string}
                        theme={theme.colors.text == '#444444' ? "light" : "vs-dark"}
                        options={{
                            tabSize: 2,
                            formatOnPaste: true,
                            formatOnType: true,
                            lineNumbers: "off",
                            wordWrap: "on",
                            minimap: { enabled: false }
                        }}
                    />
                </Center>
                <Caption style={{
                    paddingBottom: theme.dimens.space.md
                }}>
                    You can access pipelane data using contextual varialbles like pl (Pipelane Instance), input (Input to task, contains last and additionalInputs fields. AdditionalInputs is essentially what you are writing in the above box), prev (Output of previous task, same as input.last), axios (An instance of axios for making network calls if required). E.g. to access an output of a task by its index you can use pl.executedTasks[0].outputs[0].my_output_field similarly you can use prev[0].my_output_field to access previous output and input.additionalInputs.my_static_input to access the values entered in above box.
                </Caption>
                <ConfirmationDialog
                    title="Delete ?"
                    confirmText="Confirm"
                    cancelText="Cancel"
                    message=" This action is irreversible. Are you sure you want to delete this task?"
                    onDismiss={() => {
                        setShowDeleteConfirm(false)
                    }}
                    onConfirm={function (): void {
                        api.deletePipelaneTask(task.pipelaneName, task.name).then(() => {
                            router.navigate('/home/' + task.pipelaneName)
                        }).catch(e => seterr(getGraphErrorMessage(e)))
                    }}
                    visible={showDeleteConfirm}
                />
                <ButtonView onPress={() => {
                    if (!taskVariants.map(t => t.value).includes(task.taskVariantName as string)) {
                        task.taskVariantName = 'auto'
                    }
                    save(task)
                }}>Save</ButtonView>
            </CardView>
        </VBox>

    )

}

