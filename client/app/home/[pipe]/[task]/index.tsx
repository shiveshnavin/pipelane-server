import { AppContext } from "@/components/Context";
import { gql, useMutation } from "@apollo/client";
import { useLocalSearchParams } from "expo-router";
import { useRouteInfo, useRouter } from "expo-router/build/hooks";
import React, { useEffect, useState } from "react";
import { useContext } from "react";
import { Center, Expand, TextView, ThemeContext, Title, VBox, VPage } from "react-native-boxes";


export default function QueryPage() {
    const theme = useContext(ThemeContext)
    const { pipe } = useLocalSearchParams();
    const [curUser, setCurUser] = useState<any>({})
    const appContext = useContext(AppContext)
    const graph = appContext.context.api.graph

    const ADD_COMMENT = gql`
        mutation AddComment($id: String, $comment: String!) {
            commentOnUser(id: $id, comment: $comment) {
                id
                comments
            }
        }
    `;
    const [addComment, { data, loading, error }] = useMutation(ADD_COMMENT);
    useEffect(() => {

        addComment({
            variables: {
                id: pipe,
                comment: 'I visited on ' + (new Date()).toTimeString()
            }
        })
        let query = `
        query GetUser {
            pipe: Pipelane(id:"${pipe}") {
                id
                first_name
                userName
                comments
            }
        }
   `
        graph.query({
            query: gql(query),
        }).then((result: any) => {
            setCurUser(result.data.user)
        }).catch(() => {
            setCurUser({
                userName: `${pipe} not found`
            })
        })
    }, [pipe])




    return (
        <VPage>
            <Center>
                <TextView>Hello {pipe}!</TextView>
                <Title>{curUser.userName}</Title>
                <Expand title="See comments">
                    <VBox>

                    </VBox>
                </Expand>
            </Center>
        </VPage>
    );
}