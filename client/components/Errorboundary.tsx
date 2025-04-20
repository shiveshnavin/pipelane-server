import { View, Text } from 'react-native';
import { type ErrorBoundaryProps } from 'expo-router';
import React from 'react';
import { Center, TertiaryButtonView, TextView } from 'react-native-boxes';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    return (
        <Center style={{ flex: 1, paddingTop: 20 }}>
            <TextView>Error in rendering. {error.message}</TextView>
            <TertiaryButtonView onPress={retry}>Try Again?</TertiaryButtonView>
        </Center>
    );
}