import { AppContext } from "@/components/Context";
import { router, useLocalSearchParams } from "expo-router";
import { useRouter } from "expo-router/build/hooks";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { TransparentCenterToolbar, Expand, TextView, ThemeContext, VBox, VPage, CardView, CompositeTextInputView, SwitchView, HBox, SimpleDatalistView, Icon, ButtonView, TertiaryButtonView } from "react-native-boxes";
import { AlertMessage, Spinner, ConfirmationDialog } from "react-native-boxes";
import { Maybe, Pipelane, PipelaneExecution, Pipetask } from "../../../../gen/model";
import { getGraphErrorMessage } from "@/common/api";
import { PipeExecutionsView } from "@/app/executions";

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
                        api.upsertPipelane({ ...pipe, tasks: undefined }, pipeName as string).then(result => {
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
    }, [inputPipe])
    const [ignored, forceUpdate] = useReducer(x => x + 1, 0);
    const theme = useContext(ThemeContext)

    const appContext = useContext(AppContext)
    const api = appContext.context.api

    function getTasks() {
        api.getPipelaneTasks(pipe.name as string).then(result => {
            pipe.tasks = result.data.pipelaneTasks
            forceUpdate()
        })
    }


    function getExecutions() {
        api.pipelaneExecutions(pipe.name).then((plx) => {
            pipe.executions = plx.data.pipelaneExecutions
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

                    <CompositeTextInputView
                        icon="close"
                        placeholder="Inputs"
                        numberOfLines={10}
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
                            pipe.input = t
                            forceUpdate()
                        }}
                        value={pipe.input as string}
                        initialText={pipe.input as string} />

                </Expand>
            </CardView>
            {
                pipe.updatedTimestamp != undefined && (
                    <CardView>

                        <Expand title="Tasks" onExpand={() => {
                            getTasks()
                        }}>
                            <SimpleDatalistView
                                loading={pipe.tasks == undefined}
                                items={(pipe.tasks || []) as any}
                                itemAdapter={(item: Pipetask) => {
                                    return {
                                        flexRatio: [0, 9, 1],
                                        action: (
                                            <Icon
                                                color={theme.colors.text}
                                                name="arrow-right" />
                                        ),
                                        title: item.name + (item.active ? '' : ' (Disabled)'),
                                        body: `Type: ${item.taskVariantName} (${item.taskTypeName})`,
                                        onPress: () => {
                                            router.navigate(`/home/${item.pipelaneName}/${item.name}`)
                                        }
                                    }
                                }}
                            />
                            <TertiaryButtonView text="Create" onPress={() => {
                                router.navigate(`/home/${pipe.name}/new`)
                            }} />
                        </Expand>
                    </CardView>
                )
            }

            <CardView>

                <Expand title="Executions" onExpand={() => {
                    getExecutions()
                }}>
                    <PipeExecutionsView executions={pipe.executions as PipelaneExecution[]} router={router} />
                </Expand>
            </CardView>
        </VBox>

    )

}

