import { AppContext } from "@/components/Context";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useRouter } from "expo-router/build/hooks";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { TransparentCenterToolbar, Expand, TextView, ThemeContext, VBox, VPage, CardView, CompositeTextInputView, SwitchView, HBox, SimpleDatalistView, Icon, ButtonView, TertiaryButtonView, Center } from "react-native-boxes";
import { AlertMessage, Spinner, ConfirmationDialog } from "react-native-boxes";
import { Maybe, Pipelane, PipelaneExecution, Pipetask } from "../../../../gen/model";
import { getGraphErrorMessage } from "@/common/api";
import { PipeExecutionsView } from "@/app/executions";
import { Editor } from "@monaco-editor/react";
import DraggableTasksList from "../../../components/DraggableTasksList";

export default function PipelanePage() {
    const theme = useContext(ThemeContext)
    const { pipe: pipeName } = useLocalSearchParams();
    const [pipe, setPipe] = useState<Pipelane | undefined>(undefined)
    const [err, seterr] = useState<undefined | string>(undefined)
    const [loading, setLoading] = useState(false)
    const appContext = useContext(AppContext)
    const api = appContext.context.api

    function getPipe(getTasks?: boolean) {

        if (pipeName != 'new') {

            setLoading(true)
            seterr(undefined)
            api.getPipelane(pipeName as string, getTasks).then(result => {
                setPipe(result.data.Pipelane)
                if (!result.data.Pipelane) {
                    seterr(`No pipelane exists with name ${pipeName}`)
                }
            }).catch((error) => {
                seterr(getGraphErrorMessage(error))
            }).finally(() => {
                setLoading(false)
            })
        }
        else {
            setPipe(api.SAMPLE_PIPELANE)
        }
    }
    useEffect(() => {
        getPipe()
    }, [pipeName])


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
                pipe && <PipelaneView
                    setLoading={setLoading}
                    seterr={seterr} pipe={pipe} save={(pipe: Pipelane) => {
                        if (pipe.name == 'new') {
                            seterr('Please change the pipe name')
                            return
                        }
                        try {
                            JSON.parse(pipe.input as string)
                            seterr(undefined)
                        } catch (e) {
                            seterr('Input must be a valid JSON string')
                            return
                        }
                        setLoading(true)
                        seterr(undefined)
                        delete pipe.nextRun
                        delete pipe.executions
                        delete pipe.updatedTimestamp
                        delete pipe.__typename
                        pipe.retryCount = parseInt(`${pipe.retryCount || 0}`)
                        pipe.executionsRetentionCount = parseInt(`${pipe.executionsRetentionCount || 5}`)
                        api.upsertPipelane({ ...pipe }, pipeName as string).then(result => {
                            setPipe(result.data.createPipelane)
                            if (result.data.createPipelane.name != pipeName) {
                                router.navigate(`/home/${result.data.createPipelane.name}`)
                            }

                        }).catch((error) => {
                            seterr(getGraphErrorMessage(error))
                        }).finally(() => {
                            setLoading(false)
                        })
                    }} />
            }
        </VPage>
    );
}

function PipelaneView({ pipe: inputPipe, save, seterr, setLoading }: { pipe: Pipelane, save: Function, seterr: Function, setLoading: Function }) {
    const router = useRouter()
    const [pipe, setPipe] = useState<Pipelane>(
        {
            ...inputPipe,
            tasks: undefined,
            input: JSON.stringify(JSON.parse(inputPipe.input as string), null, 2)
        })
    useEffect(() => {
        setPipe({
            tasks: pipe.tasks,
            ...inputPipe,
            input: JSON.stringify(JSON.parse(inputPipe.input as string), null, 2)
        })
        getTasks()
        getExecutions()
    }, [inputPipe])
    const [ignored, forceUpdate] = useReducer(x => x + 1, 0);
    const theme = useContext(ThemeContext)

    const appContext = useContext(AppContext)
    const api = appContext.context.api

    function getTasks() {
        api.getPipelaneTasks(pipe.name as string).then(result => {
            setPipe((pipe) => {
                pipe.tasks = result.data.pipelaneTasks
                pipe.tasks?.forEach(task => {
                    delete task?.__typename
                })
                return pipe
            })
            forceUpdate()
        })
    }


    function getExecutions() {
        api.pipelaneExecutions(pipe.name).then((plx) => {
            setPipe(pipe => {
                pipe.executions = plx.data.pipelaneExecutions
                return pipe
            })
            forceUpdate()
        }).catch(e => {
            seterr(getGraphErrorMessage(e))
        })
    }

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    return (
        <VBox>
            <TransparentCenterToolbar
                options={[
                    {
                        id: 'clone',
                        icon: 'copy',
                        title: 'Clone',
                        onClick: () => {
                            setLoading(true)
                            api.clonePipelane(pipe.name).then((result) => {
                                router.navigate(`/home/${result.data.clonePipelane.name}`)
                            }).catch(e => seterr(getGraphErrorMessage(e))).finally(() => {
                                setLoading(false)
                            })
                        }
                    },
                    {
                        id: 'execute',
                        icon: 'play',
                        title: 'Execute',
                        onClick: () => {
                            setLoading(true)
                            api.executePipelane(pipe.name, pipe.input as string).then((result) => {
                                let executionId = result.data.executePipelane.id
                                router.navigate('/executions/' + executionId)
                            }).catch(e => seterr(getGraphErrorMessage(e))).finally(() => {
                                setLoading(false)
                            })
                        }
                    },
                    {
                        id: 'delete',
                        icon: 'trash',
                        title: 'Delete',
                        onClick: () => {
                            setShowDeleteConfirm(true)
                        }
                    }]}
                title={pipe.name as string} homeIcon="arrow-left" forgroundColor={theme.colors.text} onHomePress={() => {
                    router.navigate(`/home`)
                }} />
            <ConfirmationDialog
                title="Delete ?"
                confirmText="Confirm"
                cancelText="Cancel"
                message=" This action is irreversible. Are you sure you want to delete this pipelane and all its tasks and executions?"
                onDismiss={() => {
                    setShowDeleteConfirm(false)
                }}
                onConfirm={function (): void {
                    setLoading(true)
                    api.deletePipelane(pipe.name).then(() => {
                        router.navigate('/home')
                    }).catch(e => seterr(getGraphErrorMessage(e))).finally(() => {
                        setLoading(false)
                    })
                }}
                visible={showDeleteConfirm}
            />
            <CardView>
                <HBox style={{
                    padding: theme.dimens.space.md,
                    justifyContent: 'space-between'
                }}>
                    <TextView>Active</TextView>
                    <SwitchView
                        value={pipe.active as boolean}
                        onValueChange={(newV) => {
                            pipe.active = newV
                            forceUpdate()
                        }}
                    />
                </HBox>
                <HBox style={{
                    padding: theme.dimens.space.md,
                    justifyContent: 'space-between'
                }}>
                    <TextView>Next run</TextView>
                    <TextView>{pipe.nextRun}</TextView>
                </HBox>
                <CompositeTextInputView
                    placeholder="Pipelane name"
                    value={pipe.name as string}
                    onChangeText={(nt) => {
                        pipe.name = nt
                        forceUpdate()
                    }}
                />

                <CompositeTextInputView
                    icon="close"
                    placeholder="Schedule cron"
                    value={pipe.schedule as string}
                    onChangeText={(nt) => {
                        pipe.schedule = nt
                        forceUpdate()
                    }}
                />

                <ButtonView onPress={() => {
                    save(pipe)
                }}>Save</ButtonView>
            </CardView>
            <CardView>
                <Expand title="Advanced">

                    <CompositeTextInputView
                        placeholder="Retry count"
                        value={`${pipe.retryCount}`}
                        onChangeText={(nt) => {
                            //@ts-ignore
                            pipe.retryCount = nt
                            forceUpdate()
                        }}
                    />

                    <CompositeTextInputView
                        placeholder="Number of executions to keep"
                        value={`${pipe.executionsRetentionCount}`}
                        onChangeText={(nt) => {
                            //@ts-ignore
                            pipe.executionsRetentionCount = nt
                            forceUpdate()
                        }}
                    />

                    <Center style={{
                        borderWidth: 0.1,
                        borderColor: theme.colors.caption,
                        borderRadius: 10,
                        padding: 3,
                        margin: theme.dimens.space.sm
                    }}>
                        <Editor
                            onChange={(t: Maybe<string> | undefined) => {
                                pipe.input = t
                                forceUpdate()
                            }}
                            height="30vh"
                            defaultLanguage="json"
                            defaultValue={pipe.input as string}
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
                </Expand>
            </CardView>
            {
                pipe.updatedTimestamp != undefined && (
                    <CardView>

                        <Expand title="Tasks"
                            leftPadding={0}
                            onExpand={() => {
                                if (pipe.tasks == undefined || pipe.tasks.length == 0)
                                    getTasks()
                            }}>

                            <DraggableTasksList
                                onReorder={(newTasks) => {
                                    setPipe({ ...pipe, tasks: newTasks });
                                }}

                                onRender={(item: Pipetask, idx: number) => (

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
                                        <Link
                                            href={`/home/${item.pipelaneName}/${item.name}`}
                                            style={{ marginRight: 12, flex: 1, width: '100%' }}
                                        >
                                            <VBox style={{ flex: 1 }}>
                                                <TextView style={{
                                                    color: theme.colors.accent,
                                                    fontWeight: 'bold', fontSize: 16
                                                }}>
                                                    {item.name}
                                                    {!item.active && <TextView style={{ color: theme.colors.caption }}> (Disabled)</TextView>}
                                                </TextView>
                                                <TextView style={{
                                                    color: theme.colors.caption,
                                                    fontSize: 13
                                                }}>
                                                    {item.taskVariantName} ({item.taskTypeName})
                                                </TextView>
                                            </VBox>
                                        </Link>

                                    </HBox>

                                )}
                                loading={pipe.tasks == undefined}
                                tasks={(pipe.tasks || []).sort((a, b) => (a?.step || 0) - (b?.step || 0)) as any}
                            />
                            <Center>
                                <Link href={`/home/${pipe.name}/new`}>
                                    <TertiaryButtonView text="Create" />
                                </Link>
                            </Center>

                        </Expand>
                    </CardView>
                )
            }

            <CardView>

                <Expand title="Executions" onExpand={() => {
                    if (pipe.executions == undefined || pipe.executions.length == 0)
                        getExecutions()
                }}>
                    <PipeExecutionsView executions={pipe.executions as PipelaneExecution[]} router={router} />
                </Expand>
            </CardView>
        </VBox>

    )

}

