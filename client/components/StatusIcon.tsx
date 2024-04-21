import { useContext } from "react";
import { Status } from "../../gen/model";
import { Icon, IconProps, ThemeContext } from "react-native-boxes";
import React from "react";
import { ViewProps } from "react-native";

export function StatusIcon(props: { status: string | any, } & ViewProps) {
    const theme = useContext(ThemeContext)
    let color = theme.colors.info
    let icon = 'check'
    if (props.status == 'SUCCESS') {
        icon = 'check'
        color = theme.colors.success
    } else if (props.status == 'FAILED') {
        icon = 'close'
        color = theme.colors.critical
    } else if (props.status == 'PARTIAL_SUCCESS') {
        icon = 'warning'
        color = theme.colors.warning
    } else if (props.status == 'PAUSED') {
        icon = 'pause'
        color = theme.colors.text
    } else if (props.status == 'IN_PROGRESS') {
        icon = 'play'
        color = theme.colors.accent
    }

    return (
        <Icon  {...props} name={icon} color={color} style={[{
            paddingRight: theme.dimens.space.md
        }, props.style]} />
    )
}