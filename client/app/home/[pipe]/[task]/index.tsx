import { AppContext } from "@/components/Context";
import { gql } from "@apollo/client";
import { useLocalSearchParams } from "expo-router";
import { useRouter } from "expo-router/build/hooks";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { TransparentCenterToolbar, Expand, TextView, ThemeContext, VBox, VPage, CardView, CompositeTextInputView, SwitchView, HBox, SimpleDatalistView, Icon, DropDownView, ButtonView, Caption, ConfirmationDialog, Box, Center, TitleText, LoadingButton, PressableView } from "react-native-boxes";
import { AlertMessage, Spinner } from "react-native-boxes";
import { Maybe, Pipetask, PipetaskExecution, TaskType, TaskTypeDescription } from "../../../../../gen/model";
import { getGraphErrorMessage, removeFieldRecursively } from "@/common/api";
import Editor from "@monaco-editor/react";
import { isObject, prettyJson } from "../../../../common/utils/ReactUtils";
import { Try } from "expo-router/build/views/Try";
import { ErrorBoundary } from "../../../../components/Errorboundary";

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
                            description {
                            summary
                            inputs {
                                    last
                                    additionalInputs
                                }
                            }
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
                    loading={loading}
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

function PipetaskView({ loading, pipetask: inputPipetask, taskTypes, save, seterr }: { pipetask: Pipetask, taskTypes: TaskType[], loading: boolean, save: Function, seterr: Function }) {
    const router = useRouter()
    const [taskDesc, setTaskDesc] = useState<any>(undefined)
    const [task, setTask] = useState<Pipetask>(
        {
            ...inputPipetask
        })

    useEffect(() => {
        let taskDesc: TaskTypeDescription | undefined = undefined
        let taskInput = JSON.stringify(JSON.parse(inputPipetask.input as string), null, 2)
        const matchingTaskType = taskTypes.find(t => t.type == task.taskTypeName)
        if (matchingTaskType && matchingTaskType?.description) {
            taskDesc = removeFieldRecursively(matchingTaskType?.description, "__typename")
            setTaskDesc(taskDesc)
        }
        if (inputPipetask?.name == 'new' && taskDesc?.inputs?.additionalInputs) {
            taskInput = JSON.stringify(taskDesc?.inputs?.additionalInputs, null, 2)
            setTask(t => {
                t.input = taskInput
                return t
            })

        }
        if (task.taskTypeName == 'eval-js') {
            setEditingField('js')
        } else {
            setEditingField(undefined)
        }
        forceUpdate()
    }, [task.taskVariantName, task.taskTypeName])
    const [ignored, forceUpdate] = useReducer(x => x + 1, 0);
    const theme = useContext(ThemeContext)

    const [editingField, setEditingField] = useState<string | undefined>(undefined)
    const [editorType, setEditorType] = useState<"vscode" | "text">("vscode")
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

            {
                taskDesc?.summary && (
                    <TextView style={{
                        padding: theme.dimens.space.md,
                        marginLeft: theme.dimens.space.lg,
                    }}>{taskDesc?.summary}</TextView>
                )
            }
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
                <HBox style={{
                    justifyContent: 'space-between'
                }}>
                    <Caption style={{
                    marginTop: theme.dimens.space.md,
                    marginLeft: theme.dimens.space.sm
                }}>Additional Inputs</Caption>
                    <PressableView
                        onPress={() => {
                            setEditorType(editorType == 'vscode' ? 'text' : 'vscode')
                        }}>
                        <Caption style={{
                            color: theme.colors.accent,
                            marginTop: theme.dimens.space.md,
                            marginLeft: theme.dimens.space.sm
                        }}>Switch to {editorType == 'vscode' ? 'text' : 'vscode'}</Caption>
                    </PressableView>
                </HBox>

                {
                    editorType == 'vscode' && (
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
                        value={task.input as string}
                        defaultLanguage="json"
                        // defaultValue={task.input as string}
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

                    )}

                {
                    editorType == 'text' && (

                        <VBox>
                            <CompositeTextInputView
                                placeholder="Inputs"
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
                                onChangeText={(t: Maybe<string> | undefined) => {
                                    setTask((task) => {
                                        task.input = t
                                        return task
                                    })
                                    forceUpdate()
                                }}
                                value={task.input as string}
                                initialText={task.input as string} />

                        </VBox>
                    )
                }


                {
                    isObject(task.input) && (

                        <Expand title="Edit field as code" leftPadding={0} initialExpand={task.taskTypeName == 'eval-js'}>
                            <DropDownView
                                title="Select field"
                                forceDialogSelectOnWeb={true}
                                placeholder="Select field to edit separately"
                                selectedId={editingField!}
                                onSelect={(id) => {
                                    setEditingField(id)
                                    forceUpdate()
                                }}
                                options={
                                    Object.keys(JSON.parse(task.input!) || {}).map(key => {
                                        return {
                                            id: key,
                                            value: key,
                                            title: key
                                        }
                                    })
                                }
                            />
                            {
                                (editingField && editorType == 'vscode') && (
                                    <Center style={{
                                        borderWidth: 0.1,
                                        borderColor: theme.colors.caption,
                                        borderRadius: 10,
                                        padding: 3,
                                        margin: theme.dimens.space.sm
                                    }}>
                                        <Try catch={ErrorBoundary}>
                                            <Editor
                                                onChange={(t: Maybe<string> | undefined) => {

                                                    try {
                                                        setTask((task) => {
                                                            let inputObj = JSON.parse(task.input!)
                                                            inputObj[editingField] = t
                                                            task.input = JSON.stringify(inputObj, null, 2)
                                                            console.log(task.input)
                                                            return task
                                                        })
                                                        seterr(undefined)
                                                    } catch (e) {
                                                        seterr('Please enter a valid input')
                                                    }
                                                    forceUpdate()
                                                }}
                                                height="30vh"
                                                defaultLanguage="javascript"
                                                value={JSON.parse(task.input!)[editingField]}
                                                theme={theme.colors.text == '#444444' ? "light" : "vs-dark"}
                                                options={{
                                                    tabSize: 2,
                                                    formatOnPaste: true,
                                                    formatOnType: true,
                                                    lineNumbers: "on",
                                                    wordWrap: "on",
                                                    minimap: { enabled: false }
                                                }}
                                            />
                                        </Try>
                                    </Center>
                                )
                            }

                            {
                                (editingField && editorType == 'text') && (
                                    <VBox>
                                        <CompositeTextInputView
                                            placeholder="Inputs"
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
                                            onChangeText={(t: Maybe<string> | undefined) => {
                                                try {
                                                    setTask((task) => {
                                                        let inputObj = JSON.parse(task.input!)
                                                        inputObj[editingField] = t
                                                        task.input = JSON.stringify(inputObj, null, 2)
                                                        console.log(task.input)
                                                        return task
                                                    })
                                                    seterr(undefined)
                                                } catch (e) {
                                                    seterr('Please enter a valid input')
                                                }
                                                forceUpdate()
                                            }}
                                            value={JSON.parse(task.input!)[editingField]}
                                            initialText={task.input as string} />
                                    </VBox>
                                )
                            }

                        </Expand>

                    )
                }
                <Caption style={{
                    paddingBottom: theme.dimens.space.md
                }}>
                    You can access pipelane data using contextual varialbles like `pl` (Pipelane Instance), `input` (Input to task, contains last and additionalInputs fields. AdditionalInputs is essentially what you are writing in the above box), `prev` (Output of previous task, same as input.last), `axios` (An instance of axios for making network calls if required) and `Utils` which contains functions like `escapeJSONString`. E.g. to access an output of a task by its index you can use pl.executedTasks[0].outputs[0].my_output_field similarly you can use prev[0].my_output_field to access previous output and input.additionalInputs.my_static_input to access the values entered in above box.
                </Caption>
                {
                    taskDesc && (
                        <Expand title="Task description">
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
                                value={prettyJson(JSON.stringify(taskDesc)) || ''}
                                initialText={prettyJson(JSON.stringify(taskDesc)) || ''} />

                        </Expand>
                    )
                }
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
                <LoadingButton
                    loading={loading}
                    style={{
                        marginTop: theme.dimens.space.md
                    }}
                    onPress={() => {
                        if (!taskVariants.map(t => t.value).includes(task.taskVariantName as string)) {
                            task.taskVariantName = 'auto'
                        }
                        save(task)
                    }}>Save</LoadingButton>
            </CardView>
        </VBox>

    )

}

