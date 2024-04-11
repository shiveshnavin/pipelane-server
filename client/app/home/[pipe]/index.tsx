import { AppContext } from "@/components/Context";
import { gql, useMutation } from "@apollo/client";
import { useLocalSearchParams } from "expo-router";
import { useRouteInfo, useRouter } from "expo-router/build/hooks";
import React, { useEffect, useReducer, useState } from "react";
import { useContext } from "react";
import { TransparentCenterToolbar, Center, Expand, SimpleToolbar, TextView, ThemeContext, Title, VBox, VPage, CardView, CompositeTextInputView } from "react-native-boxes";
import { AlertMessage, Spinner } from "react-native-boxes";
import { Maybe, Pipelane } from "../../../../gen/model";

export default function QueryPage() {
    const theme = useContext(ThemeContext)
    const { pipe } = useLocalSearchParams();
    const [curPipe, setCurPipe] = useState<Pipelane | undefined>(undefined)
    const appContext = useContext(AppContext)
    const [err, seterr] = useState<undefined | string>(undefined)
    const [loading, setLoading] = useState(true)
    const graph = appContext.context.api.graph

    useEffect(() => {
        setLoading(true)
        seterr(undefined)
        graph
            .query({
                query: gql`
                    query Pipelane($name: ID) {
                            Pipelane(name: $name) {
                                name
                                inputs
                                schedule
                                active
                                tasks {
                                pipelaneName
                                taskVariantName
                                taskTypeName
                                isParallel
                                input
                                }
                            }
                        }
  `,
                variables: { name: pipe },
            })
            .then(result => {
                setCurPipe(result.data.Pipelane)
                if (!result.data.Pipelane) {
                    seterr(`No pipelane exists with name ${pipe}`)
                }
            })
            .catch(error => {
                seterr(error.message)
            }).finally(() => {
                setLoading(false)
            })
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
                curPipe && <PipelaneView pipe={curPipe} />
            }
        </VPage>
    );
}

function PipelaneView({ pipe: inputPipe }: { pipe: Pipelane }) {
    const [pipe, setPipe] = useState<Pipelane>({ ...inputPipe, inputs: JSON.stringify(JSON.parse(inputPipe.inputs as string), null, 2) })
    const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

    return (
        <VBox>
            <TransparentCenterToolbar title={pipe.name as string} />
            <CardView>
                <CompositeTextInputView
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
                        pipe.inputs = t
                        forceUpdate()
                    }}
                    value={pipe.inputs as string}
                    initialText={pipe.inputs as string} />
            </CardView>
        </VBox>

    )

}

