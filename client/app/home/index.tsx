import { AppContext, ContextData } from "@/components/Context";
import { gql } from "@apollo/client";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { ButtonView, Caption, Colors, CompositeTextInputView, DarkColors, Icon, PressableView, SimpleDatalistView, SimpleToolbar, Storage, SwitchView, TextView, Theme, ThemeContext, VPage, isDesktop, isWeb } from "react-native-boxes";
import { Pipelane, PipelaneExecution, Pipetask } from '../../../gen/model'
import { KeyboardAvoidingScrollView, CardView, HBox, VBox } from "react-native-boxes/src/Box";
import { Link, useRouter } from "expo-router";
import { StatusBar } from "react-native";
import HealthBar from "../../components/HealthBar";

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
                    }
                ]}
                textStyle={{
                    color: theme.colors.text
                }}
                backgroundColor={theme.colors.transparent} homeIcon="" title="Pipelanes" />

            <KeyboardAvoidingScrollView style={{
                width: '100%'
            }}>
                <CardView>
                    <HBox>
                        <ButtonView
                            underlayColor={getHealth ? theme.colors.successBackground : theme.colors.accent}
                            onPress={() => {
                                setGetHealth(t => !t);
                            }}
                            style={{
                                backgroundColor: getHealth ? theme.colors.success : theme.colors.transparent,
                                flex: isDesktop() ? 1 : 2
                            }}
                            icon="signal" />
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
                    onRender={(pipe: Pipelane, idx: number) => (
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
                                    (getHealth && pipe.executions && pipe.executions?.length > 0) && (

                                        <HealthBar
                                            style={{
                                                paddingLeft: theme.dimens.space.md
                                            }}
                                            maxSize={pipe.executions?.length}
                                            items={pipe.executions as any}
                                            onPressItem={(index, item) => {
                                                router.navigate(`executions/${(item as PipelaneExecution).id}`)
                                            }}
                                        />
                                    )
                                }
                            </VBox>
                        </Link>
                    )}
                    items={pipes?.filter(p => p.name?.toLocaleLowerCase()?.indexOf(search.toLocaleLowerCase()) > -1)}
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