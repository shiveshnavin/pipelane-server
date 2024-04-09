import { AppContext } from "@/components/Context";
import { gql, useMutation } from "@apollo/client";
import { useLocalSearchParams } from "expo-router";
import { useRouteInfo, useRouter } from "expo-router/build/hooks";
import React, { useEffect, useState } from "react";
import { useContext } from "react";
import { Center, Expand, TextView, ThemeContext, Title, VBox, VPage } from "react-native-boxes";
import { User } from "../../../../gen/model";


export default function QueryPage() {
    const theme = useContext(ThemeContext)
    const { user } = useLocalSearchParams();
    const [curUser, setCurUser] = useState<User>({})
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
    useEffect( () => {

        addComment({
            variables:{
                id:user,
                comment:'I visited on '+(new Date()).toTimeString()
            }
        })
        let query = `
        query GetUser {
            user: User(id:"${user}") {
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
                userName: `${user} not found`
            })
        })
    }, [user])


    

    return (
        <VPage>
            <Center>
                <TextView>Hello {user}!</TextView>
                <Title>{curUser.userName}</Title>
               <Expand title="See comments">
                <VBox>
                        {
                            curUser?.comments?.map(cm=>
                                <TextView key={cm}>{cm}</TextView>
                            )
                        }
                    </VBox>
               </Expand>
            </Center>
        </VPage>
    );
}