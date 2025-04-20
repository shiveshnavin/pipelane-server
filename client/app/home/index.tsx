import { AppContext, ContextData } from "@/components/Context";
import { gql } from "@apollo/client";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { ButtonView, Colors, CompositeTextInputView, DarkColors, Icon, PressableView, SimpleDatalistView, SimpleToolbar, Storage, SwitchView, Theme, ThemeContext, VPage, isDesktop, isWeb } from "react-native-boxes";
import { Pipelane } from '../../../gen/model'
import { KeyboardAvoidingScrollView, CardView, HBox } from "react-native-boxes/src/Box";
import { useRouter } from "expo-router";
import { StatusBar } from "react-native";

export default function HomeLayout() {
    const theme = useContext(ThemeContext)
    const appContext = useContext(AppContext)
    const setContext = appContext.setContext
    const api = appContext.context.api
    const graph = appContext.context.api.graph
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [pipes, setUsers] = useState<Pipelane[]>([])
    const router = useRouter()
    const [ignored, forceUpdate] = useReducer(x => x + 1, 0);
    console.log('re-render')
    //@ts-ignores
    function getPipes(text?) {
        let query = `
        query GetPipes {
            pipelanes {
              name
              schedule
              active
              nextRun
            }
          }
     `
        graph.query({
            query: gql(query),
        }).then((result: any) => {
            setLoading(false)
            setUsers(result.data.pipelanes)
        });
    }
    useEffect(() => {
        getPipes(undefined)
    }, [])
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
                        <CompositeTextInputView
                            onChangeText={setSearch}
                            initialText={search}
                            placeholder="Search for pipelanes"
                            value={search}
                            style={{
                                flex: 8
                            }} />
                        <ButtonView onPress={() => {
                            router.navigate(`/home/new`)
                        }} style={{ flex: isDesktop() ? 1 : 2 }} icon="plus" />

                    </HBox>
                </CardView>
                <SimpleDatalistView
                    loading={loading}
                    style={{
                        padding: theme.dimens.space.sm
                    }}
                    items={pipes?.filter(p => p.name?.indexOf(search) > -1)}
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