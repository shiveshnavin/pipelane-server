import { AppContext } from "@/components/Context";
import { gql } from "@apollo/client";
import React, { useEffect, useState } from "react";
import { useContext } from "react";
import { Avatar, Center, Icon, PressableView, SimpleDatalistView, Subtitle, SwitchView, TextView, ThemeContext, VBox, VPage } from "react-native-boxes";
import { Pipelane } from '../../gen/model'
import { router } from "expo-router";
import { ScrollView, Switch } from "react-native";
import KeyboardAvoidingScrollView, { HBox } from "react-native-boxes/src/Box";

export default function HomeLayout() {
    const theme = useContext(ThemeContext)
    const appContext = useContext(AppContext)
    const graph = appContext.context.api.graph
    const [pipes, setUsers] = useState([])
    useEffect(() => {
        let query = `
        query GetPipes {
            pipelanes {
              name
              inputs
              schedule
              active
            }
          }
          
     `
        graph.query({
            query: gql(query),
        }).then((result: any) => {
            setUsers(result.data.pipelanes)
        });
    }, [])
    return (
        <VPage>
            <Center>
                <TextView>Hello World!</TextView>
                <KeyboardAvoidingScrollView style={{
                    width: '100%'
                }}>

                    <SimpleDatalistView
                        style={{
                            padding: theme.dimens.space.sm
                        }}
                        items={pipes}
                        //@ts-ignore
                        itemAdapter={(pipe: Pipelane, idx: number) => {
                            const [isOn, setIsOn] = useState(false)
                            return {
                                action: (
                                    <SwitchView
                                        value={isOn}
                                        onValueChange={(p) => {
                                            console.log('presss', p)
                                            setIsOn(p)
                                        }} />
                                ),
                                title: pipe.name,
                                subtitle: pipe.schedule,
                                icon: (
                                    <Avatar iconText={pipe.name?.toUpperCase()} />
                                ),
                                flexRatio: [3, 7, 1],
                                body: pipe.inputs
                            }
                        }} />

                </KeyboardAvoidingScrollView>
            </Center>
        </VPage>
    );
}