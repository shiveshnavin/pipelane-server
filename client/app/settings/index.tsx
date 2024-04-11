import React from "react";
import { useContext } from "react";
import { Center, DemoScreen, TextView, ThemeContext, VPage } from "react-native-boxes";


export default function ProfilePage() {
    const theme = useContext(ThemeContext)
    return (
        <VPage>
            <DemoScreen />
        </VPage>
    );
}