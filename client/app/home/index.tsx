import { AppContext } from "@/components/Context";
import { gql } from "@apollo/client";
import React, { useEffect, useState } from "react";
import { useContext } from "react";
import { ButtonView, CompositeTextInputView, PressableView, SimpleDatalistView, SimpleToolbar, SwitchView, ThemeContext, VPage, isDesktop } from "react-native-boxes";
import { Pipelane } from '../../../gen/model'
import KeyboardAvoidingScrollView, { CardView, HBox } from "react-native-boxes/src/Box";
import { useRouter } from "expo-router";
import { StatusBar } from "react-native";

export default function HomeLayout() {
    const theme = useContext(ThemeContext)
    const appContext = useContext(AppContext)
    const api = appContext.context.api
    const graph = appContext.context.api.graph
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [pipes, setUsers] = useState([])
    const router = useRouter()
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
                            getPipes(search)
                        }} style={{ flex: isDesktop() ? 1 : 2 }} icon="search" />
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
                    items={pipes}
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