import { AppContext } from "@/components/Context";
import { gql, useMutation } from "@apollo/client";
import { useLocalSearchParams } from "expo-router";
import { useRouteInfo, useRouter } from "expo-router/build/hooks";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { TransparentCenterToolbar, Center, Expand, SimpleToolbar, TextView, ThemeContext, Title, VBox, VPage, CardView, CompositeTextInputView, SwitchView, HBox, SimpleDatalistView, SimpleDatatlistViewItem, Icon, ButtonView } from "react-native-boxes";
import { AlertMessage, Spinner } from "react-native-boxes";
import { Maybe, Pipelane, Pipetask } from "../../../../gen/model";
import { getGraphErrorMessage } from "@/common/api";

export default function PipelanePage() {
    const theme = useContext(ThemeContext)
    const { pipe } = useLocalSearchParams();
    const [curPipe, setCurPipe] = useState<Pipelane | undefined>(undefined)
    const [err, seterr] = useState<undefined | string>(undefined)
    const [loading, setLoading] = useState(true)
    const appContext = useContext(AppContext)
    const api = appContext.context.api

    function getPipe(getTasks?: boolean) {

        setLoading(true)
        seterr(undefined)
        api.getPipelane(pipe as string, getTasks).then(result => {
            setCurPipe(result.data.Pipelane)
            if (!result.data.Pipelane) {
                seterr(`No pipelane exists with name ${pipe}`)
            }
        }).catch((error) => {
            seterr(getGraphErrorMessage(error))
        }).finally(() => {
            setLoading(false)
        })
    }
    useEffect(() => {
        getPipe()
    }, [pipe])




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
                curPipe && <PipelaneView pipe={curPipe} save={(pipe: Pipelane) => {
                    setLoading(true)
                    seterr(undefined)
                    delete pipe.nextRun
                    delete pipe.__typename
                    pipe.retryCount = parseInt(`${pipe.retryCount || 0}`)
                    api.upsertPipelane({ ...pipe, tasks: undefined }).then(result => {
                        setCurPipe(result.data.createPipelane)
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

function PipelaneView({ pipe: inputPipe, save }: { pipe: Pipelane, save: Function }) {
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

    return (
        <VBox>
            <TransparentCenterToolbar title={pipe.name as string} homeIcon="arrow-left" forgroundColor={theme.colors.text} onHomePress={() => {
                router.navigate(`/home`)
            }} />
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
                    placeholder="Retry count"
                    value={`${pipe.retryCount}`}
                    onChangeText={(nt) => {
                        //@ts-ignore
                        pipe.retryCount = nt
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
                        pipe.input = t
                        forceUpdate()
                    }}
                    value={pipe.input as string}
                    initialText={pipe.input as string} />

                <ButtonView onPress={() => {
                    save(pipe)
                }}>Save</ButtonView>
            </CardView>
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
                                title: item.taskVariantName,
                                body: item.taskTypeName,
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

