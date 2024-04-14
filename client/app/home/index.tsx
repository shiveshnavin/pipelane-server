import { AppContext } from "@/components/Context";
import { gql } from "@apollo/client";
import React, { useEffect, useState } from "react";
import { useContext } from "react";
import { ButtonView, CompositeTextInputView, SimpleDatalistView, SimpleToolbar, SwitchView, ThemeContext, VPage, isDesktop } from "react-native-boxes";
import { Pipelane } from '../../../gen/model'
import KeyboardAvoidingScrollView, { CardView, HBox } from "react-native-boxes/src/Box";
import { useRouter } from "expo-router";

export default function HomeLayout() {
    const theme = useContext(ThemeContext)
    const appContext = useContext(AppContext)
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
              input
              schedule
              active
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
                                <SwitchView
                                    value={pipe.active == true}
                                    onValueChange={(p) => {
                                        pipe.active = p
                                        console.log('presss', p)
                                    }} />
                            ),
                            title: pipe.name,
                            subtitle: pipe.schedule,
                            flexRatio: [0.1, 7, 1],
                            body: pipe.input
                        }
                    }} />

            </KeyboardAvoidingScrollView>
        </VPage>
    );
}