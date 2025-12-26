import { AppContext, ContextData } from "@/components/Context";
import { gql } from "@apollo/client";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { AlertMessage, ButtonView, Caption, Colors, CompositeTextInputView, DarkColors, Icon, PressableView, SimpleDatalistView, SimpleToolbar, Storage, SwitchView, TextView, Theme, ThemeContext, Title, VPage, isDesktop, isWeb } from "react-native-boxes";
import { Pipelane, PipelaneExecution, Pipetask } from '../../../gen/model'
import { KeyboardAvoidingScrollView, CardView, HBox, VBox, Center } from "react-native-boxes/src/Box";
import { Link, useRouter } from "expo-router";
import { GestureResponderEvent, StatusBar } from "react-native";
import HealthBar from "../../components/HealthBar";
import { getGraphErrorMessage } from "@/common/api";


function calculateHealthColor(percentage: number, theme: Theme) {
    if (percentage >= 90) {
        return theme.colors.success;
    } else if (percentage >= 60) {
        return theme.colors.warning;
    } else if (percentage < 0) {
        return theme.colors.caption;
    } else {
        return theme.colors.critical;
    }

}

function calculateHealthPercentage(executions: PipelaneExecution[]) {
    executions = executions || []
    let successCount = 0;
    let failedCount = 0;
    let inProgressCount = 0;
    let total = executions.length;

    executions.forEach(execution => {
        switch (execution.status) {
            case 'SUCCESS':
                successCount++;
                break;
            case 'FAILED':
                failedCount++;
                break;
            case 'IN_PROGRESS':
                inProgressCount++;
                break;
            default:
                // Do nothing for other statuses like SKIPPED, PAUSED, PARTIAL_SUCCESS
                break;
        }
    });

    if (total === 0) {
        return { success: -1, failed: -1, inProgress: -1 };
    }

    return {
        success: (successCount / total) * 100,
        failed: (failedCount / total) * 100,
        inProgress: (inProgressCount / total) * 100,
    };

}

export default function HomeLayout() {
    const theme = useContext(ThemeContext)
    const appContext = useContext(AppContext)
    const setContext = appContext.setContext
    const api = appContext.context.api
    const graph = appContext.context.api.graph
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [getHealth, setGetHealth] = useState(false)
    const [pipes, setUsers] = useState<Pipelane[]>([])
    const [err, seterr] = useState<string | undefined>(undefined);
    const router = useRouter()
    const [ignored, forceUpdate] = useReducer(x => x + 1, 0);
    console.log('re-render')
    //@ts-ignores
    function getPipes() {
        setLoading(true)
        let executionsQuery = `
        executions {
            id
            startTime
            status
            endTime
        }`;
        let query = `
        query GetPipes {
            pipelanes {
              name
              schedule
              active
              nextRun
              ${getHealth ? executionsQuery : ''}
            }
          }
     `
        graph.query({
            query: gql(query),
        }).then((result: any) => {
            setUsers(result.data.pipelanes)
        }).finally(() => {
            setLoading(false)
        })
    }
    useEffect(() => {
        getPipes()
    }, [getHealth])
    return (
        <VPage>
            <SimpleToolbar
                options={[
                    {
                        id: 'theme',
                        icon: (<Icon name="lightbulb-o" color={
                            theme.colors.text
                        } />),
                        onClick() {
                            if (appContext.context.themeName == 'dark') {
                                setContext((c) => {
                                    c.themeName = "light"
                                    c.theme = new Theme('client', Colors)
                                    return c
                                })
                                Storage.setKeyAsync('theme', 'light')
                                console.log('settign to light')
                                router.navigate('/home?theme=light')
                            }
                            else {
                                setContext((c) => {
                                    c.themeName = "dark"
                                    c.theme = new Theme('client', DarkColors)
                                    return c
                                })
                                Storage.setKeyAsync('theme', 'dark')
                                router.navigate('/home?theme=dark')

                            }
                        }
                    },
                    {
                        id: 'import',
                        icon: (<Icon name="upload" color={theme.colors.text} />),
                        onClick: () => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'application/json';
                            input.onchange = (event) => {
                                //@ts-ignore
                                const file = event.target?.files?.[0];
                                if (!file) return;

                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    try {
                                        const pipe: Pipelane = JSON.parse(e.target?.result as string);
                                        if (pipe.name == 'new') {
                                            seterr('Please change the pipe name');
                                            return;
                                        }
                                        try {
                                            JSON.parse(pipe.input as string);
                                            seterr(undefined);
                                        } catch (e) {
                                            seterr('Input must be a valid JSON string');
                                            return;
                                        }
                                        setLoading(true);
                                        seterr(undefined);
                                        delete pipe.nextRun;
                                        delete pipe.executions;
                                        delete pipe.updatedTimestamp;
                                        delete pipe.__typename;
                                        pipe.retryCount = parseInt(`${pipe.retryCount || 0}`);
                                        pipe.executionsRetentionCount = parseInt(`${pipe.executionsRetentionCount || 5}`);
                                        api.upsertPipelane({ ...pipe }, pipe.name).then(result => {
                                            getPipes()
                                            router.navigate(`/home/${result.data.createPipelane.name}`);
                                        }).catch((error) => {
                                            seterr(getGraphErrorMessage(error));
                                        }).finally(() => {
                                            setLoading(false);
                                        });
                                    } catch (err) {
                                        seterr('Invalid JSON file');
                                    }
                                };
                                reader.readAsText(file);
                            };
                            input.click();
                        }
                    }
                ]}
                textStyle={{
                    color: theme.colors.text
                }}
                backgroundColor={theme.colors.transparent} homeIcon="" title="Pipelanes" />

            {
                err && <AlertMessage
                    type="critical"
                    text={err}
                    onDismiss={() => {
                        seterr(undefined)
                    }} />
            }

            <KeyboardAvoidingScrollView style={{
                width: '100%'
            }}>
                <CardView>
                    <HBox>
                        <PressableView
                            style={{
                                borderRadius: theme.dimens.space.md,
                                backgroundColor: getHealth ? theme.colors.success : theme.colors.transparent,
                                flex: isDesktop() ? 1 : 2
                            }}
                            onPress={() => {
                                setGetHealth(t => !t);
                            }}
                        ><Center style={{
                            flex: isDesktop() ? 1 : 2
                        }}>
                                <Icon
                                    onPress={() => {
                                        setGetHealth(t => !t);
                                    }}
                                    name={'signal'} color={getHealth ? theme.colors.invert.text : theme.colors.text} />
                            </Center>
                        </PressableView>

                        <CompositeTextInputView
                            onChangeText={setSearch}
                            initialText={search}
                            placeholder="Search for pipelanes"
                            value={search}
                            style={{
                                flex: 8
                            }} />
                        <ButtonView
                            onPress={() => {
                                router.navigate(`/home/new`)
                            }}
                            style={{ flex: isDesktop() ? 1 : 2 }}
                            icon="plus" />

                    </HBox>
                </CardView>
                <SimpleDatalistView
                    loading={loading}
                    style={{
                        padding: theme.dimens.space.sm
                    }}
                    onRender={(pipe) => {
                        return <RenderPipe pipe={pipe} getHealth={getHealth} forceUpdate={forceUpdate} />
                    }}

                    items={pipes?.filter((p) => {
                        /// p.name?.toLocaleLowerCase()?.indexOf(search.toLocaleLowerCase()) > -1)
                        return p.name.toLowerCase().includes(search.toLowerCase()) ||
                            p.name?.replace(/[^a-zA-Z0-9 ]/g, ' ').toLowerCase().includes(search.toLowerCase()) ||
                            p.schedule?.toLowerCase().includes(search.toLowerCase())

                    }).sort((a, b) => {
                        if (a.active && !b.active) return -1;
                        if (!a.active && b.active) return 1;
                        return a.name.localeCompare(b.name);
                    })
                    }
                    //@ts-ignore
                    itemAdapter={(pipe: Pipelane, idx: number) => {

                        return {
                            onPress: () => {
                                router.navigate(`/home/${pipe.name}`)
                            },
                            action: (
                                <PressableView
                                    onPress={(e) => {
                                        e.stopPropagation()
                                    }}>
                                    <SwitchView
                                        value={pipe.active == true}
                                        onValueChange={(p) => {
                                            pipe.active = p
                                            api.upsertPipelane({
                                                active: p,
                                                name: pipe.name
                                            }).then(resp => {
                                                Object.assign(pipe, resp.data.createPipelane)
                                                forceUpdate()
                                            })
                                        }} />
                                </PressableView>
                            ),
                            title: pipe.name,
                            subtitle: `Schedule: ${pipe.schedule}`,
                            flexRatio: [0.1, 7, 1],
                            body: `Next run on ${pipe.nextRun}`
                        }
                    }} />

            </KeyboardAvoidingScrollView>
        </VPage>
    );
}


function RenderPipe(props: { pipe: Pipelane, getHealth: boolean, forceUpdate: () => void }) {
    const { pipe, getHealth, forceUpdate } = props
    const theme = useContext(ThemeContext)
    const { api } = useContext(AppContext).context
    const router = useRouter()
    const [expand, setExpand] = useState(false)

    const executionsToConsiderForHealthCount = pipe.executionsRetentionCount || 10
    const executionsToConsiderForHealth = pipe.executions
        ?.filter(e => !!e?.startTime)
        .sort((a, b) => {
            //@ts-ignore
            return new Date(parseInt(b.startTime as string)).getTime() - new Date(parseInt(a.startTime as string)).getTime()
        })
        ?.slice(0, executionsToConsiderForHealthCount)

    const health = calculateHealthPercentage(executionsToConsiderForHealth as PipelaneExecution[]).success;
    const healthColor = calculateHealthColor(health, theme);
    const healthDisplay = health >= 0 ? health.toFixed(0) : '-';
    return (
        <Link
            href={`/home/${pipe.name}`}
            style={{
                flex: 1,
                width: '100%',
                marginLeft: theme.dimens.space.sm,
                marginRight: theme.dimens.space.md,
                paddingRight: theme.dimens.space.md,
                marginBottom: theme.dimens.space.md,
                marginTop: 0,
            }}
        >
            <VBox style={{
                borderRadius: theme.dimens.space.md,
                backgroundColor: theme.colors.forground,
                paddingVertical: 8,
                paddingHorizontal: 12,
                flex: 1,
                width: '100%'
            }}>

                <HBox
                    key={pipe.name}
                    style={{
                        alignItems: 'center',
                        flex: 1,
                        width: '100%'
                    }}
                >
                    {
                        getHealth && (
                            <PressableView
                                onPress={(e: GestureResponderEvent) => {
                                    e.stopPropagation?.();
                                    e.preventDefault?.();
                                    (e.nativeEvent as any)?.stopImmediatePropagation?.();
                                    setExpand(t => !t)
                                }}>
                                <Center>
                                    <Title style={{
                                        textAlign: 'center',
                                        width: theme.dimens.icon.xl,
                                        color: healthColor
                                    }} >{healthDisplay}
                                    </Title>


                                    {/* <Caption
                                        style={{
                                            color: theme.colors.accent,
                                            textAlign: 'center',
                                            width: theme.dimens.icon.xl,
                                        }}>{
                                            expand ? 'Collapse' : 'Expand'
                                        }</Caption> */}

                                    {/* <Icon name={
                                        expand ? 'eye-slash' : 'eye'
                                    } color={theme.colors.accent}
                                        size={theme.dimens.icon.md} /> */}

                                </Center>
                            </PressableView>

                        )
                    }
                    <VBox style={{ flex: 1 }}>
                        <TextView style={{
                            color: theme.colors.accent,
                            fontWeight: 'bold', fontSize: theme.dimens.font.lg
                        }}>
                            {pipe.name}
                        </TextView>
                        <TextView style={{
                            fontSize: theme.dimens.font.md
                        }}>
                            Schedule: {pipe.schedule}
                        </TextView>
                        <Caption>
                            Next run on {pipe.nextRun}
                        </Caption>

                    </VBox>
                    <PressableView
                        onPress={(e) => {
                            e.stopPropagation()
                        }}>
                        <SwitchView
                            value={pipe.active == true}
                            onValueChange={(p) => {
                                pipe.active = p
                                api.upsertPipelane({
                                    active: p,
                                    name: pipe.name
                                }).then(resp => {
                                    Object.assign(pipe, resp.data.createPipelane)
                                    forceUpdate()
                                })
                            }} />
                    </PressableView>
                </HBox>
                {
                    (expand && getHealth && executionsToConsiderForHealth && executionsToConsiderForHealth.length > 0) && (

                        <HealthBar
                            style={{
                                paddingLeft: theme.dimens.space.md
                            }}
                            maxSize={executionsToConsiderForHealth?.length}
                            items={executionsToConsiderForHealth as any}
                            onPressItem={(index, item) => {
                                router.navigate(`executions/${(item as PipelaneExecution).id}`)
                            }}
                        />
                    )
                }
            </VBox>
        </Link>
    )

}