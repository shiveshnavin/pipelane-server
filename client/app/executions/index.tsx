import { Link, useRouter } from "expo-router";
import React from "react";
import { useContext } from "react";
import { ButtonView, Center, TextView, ThemeContext, VPage } from "react-native-boxes";


export default function SearchPage() {
    const theme = useContext(ThemeContext)
    const router = useRouter()
    return (
        <VPage>
            <Center>
                <TextView>Hello Search!</TextView>
                <ButtonView
                    onPress={() => {
                        router.push(`/search/yolo?query=paneer`)
                    }}
                    text="Go to query" />
            </Center>
        </VPage>
    );
}