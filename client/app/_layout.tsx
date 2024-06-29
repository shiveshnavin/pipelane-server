import React, { useState, useContext, useEffect } from "react";
import { Theme, ThemeContext, Colors, TextView, Spinner } from "react-native-boxes";
import { loadAsync } from "expo-font";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppContext, ContextData } from "../components/Context";
import { Linking, ScrollView, StatusBar } from "react-native";
import { Stack, router, useRouter } from 'expo-router';
import { Slot } from 'expo-router';
import { BottomNavBar, SimpleToolbar, VBox, VPage } from 'react-native-boxes';
import { useRouteInfo } from "expo-router/build/hooks";
import { Center, KeyboardAvoidingScrollView } from "react-native-boxes/src/Box";
import { ApolloProvider } from "@apollo/client";
import { createApiClient } from "@/common/api";
import axios from 'axios'

function Main() {
  const [context, setContext] = useState(new ContextData())
  let basePath = '/pipelane/'
  if (__DEV__) {
    basePath = ''
  }

  context.appname = 'client'
  const theme = new Theme('client', Object.assign(Colors, {
    background: '#F5F5F5'
  }))
  theme.insets = useSafeAreaInsets()
  const [init, setInit] = useState(false)

  useEffect(() => {
    Promise.all([
      loadAsync({
        'Regular': require('../assets/fonts/Regular.ttf'),
        'Bold': require('../assets/fonts/Bold.ttf'),
        'Styled': require('../assets/fonts/Bold.ttf'),
      }),
      axios.get('/pipelane/config').then((respo) => {
        let api;
        if (__DEV__) {
          api = createApiClient('http://localhost:8080')
        }
        else {
          api = createApiClient(respo.data.host)
        }
        setContext(new ContextData(api))
      })
    ]).finally(() => {
      setTimeout(() => {
        setInit(true)
      }, 500)
    })
  }, [])

  Linking.addEventListener('url', (url) => {
    if (url?.url) {
      let path = url?.url.split("://")[1]
      if (path)
        router.navigate(path)
    }
  });
  const router = useRouter()
  const [bottombarHeight, setBottomBarHeight] = useState(100)
  const [bottombarId, setBottombarId] = useState('/')
  const route = useRouteInfo()
  useEffect(() => {
    if (init) {
      console.log('route', route)
      let id = route.pathname.split('/')[1]
      if (id == '')
        id = 'home'
      setBottombarId(id)
      router.navigate(route.unstable_globalHref)
    }
  }, [init])

  if (!init) {
    return (
      <Center style={{
        flex: 1
      }}>
        <Spinner />
      </Center>
    )
  }
  return (
    <ThemeContext.Provider value={theme} >
      <ApolloProvider client={context.api?.graph}>
        <AppContext.Provider value={{ context, setContext }}>
          <SafeAreaView style={{
            width: '100%',
            height: '100%'
          }}>
            {
              init && (

                <VPage>
                  <KeyboardAvoidingScrollView style={{
                    width: '100%',
                    height: '100%',
                    margin: 0,
                    padding: 0,
                    marginBottom: bottombarHeight
                  }}>
                    <Slot />
                  </KeyboardAvoidingScrollView>
                  <BottomNavBar
                    onDimens={(w, h) => {
                      setBottomBarHeight(h)
                    }}
                    selectedId={bottombarId}
                    onSelect={(id) => {
                      router.navigate(basePath + id)
                      setBottombarId(id)
                    }}
                    options={[{
                      id: 'home',
                      icon: 'home',
                      title: 'Home'
                    },
                    {
                      id: 'executions',
                      icon: 'plane',
                      title: 'Executions'
                    }]} />
                </VPage>
              )
            }
          </SafeAreaView>
        </AppContext.Provider>
      </ApolloProvider>
    </ThemeContext.Provider >
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  )
}