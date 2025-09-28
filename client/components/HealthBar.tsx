// HealthBar.tsx
import React, { useContext, memo, useMemo } from 'react';
import { View, Pressable, StyleSheet, ViewStyle, ScrollView, GestureResponderEvent } from 'react-native';
import { ThemeContext } from 'react-native-boxes';
import { Status } from '../gen/model';

type ItemWithStatus = {
    status: Status | boolean | undefined | null
};

export interface HealthBarProps {
    /** Maximum number of boxes to render (e.g., segments in the bar) */
    maxSize: number;
    /**
     * Items to render (left→right). Each item’s status can be:
     *  - Status enum value
     *  - boolean (true = SUCCESS, false = FAILED)
     *  - undefined/null (treated as SKIPPED/empty)
     */
    items: ItemWithStatus[];
    /** Called when a segment is pressed */
    onPressItem?: (index: number, item: ItemWithStatus) => void;
    /** Style for the outer container (row wrapper) */
    style?: ViewStyle;
    /** Size (width & height) of each box in dp; defaults to 16 */
    boxSize?: number;
    /** Gap between boxes; defaults to 6 */
    gap?: number;
    /** Corner radius for boxes; defaults to 4 for a pill-ish look */
    radius?: number;
    /** Optional override to dim non-active states (0–1); defaults to 0.35 */
    dimOpacity?: number;
}

const toEnum = (v: ItemWithStatus): Status => {
    if (v.status === true) return Status.Success;
    if (v.status === false) return Status.Failed;
    return (v.status as Status) ?? Status.Skipped;
};

// Helper to tone down a color by mixing with background
function toneDown(hex: string, bg: string, factor: number = 0.5): string {
    const h2d = (h: string) => parseInt(h, 16);
    const d2h = (d: number) => d.toString(16).padStart(2, '0');

    const r = h2d(hex.slice(1, 3));
    const g = h2d(hex.slice(3, 5));
    const b = h2d(hex.slice(5, 7));

    const rb = h2d(bg.slice(1, 3));
    const gb = h2d(bg.slice(3, 5));
    const bb = h2d(bg.slice(5, 7));

    const mix = (c: number, cb: number) => Math.round(c * factor + cb * (1 - factor));

    return `#${d2h(mix(r, rb))}${d2h(mix(g, gb))}${d2h(mix(b, bb))}`;
}

const HealthBar: React.FC<HealthBarProps> = memo(
    ({
        maxSize,
        items,
        onPressItem,
        style,
        boxSize = 16,
        gap = 6,
        radius = 4,
        dimOpacity = 0.35,
    }) => {
        const theme = useContext(ThemeContext);

        const background = theme.colors?.background ?? '#0b0f14';

        // Color map with toned-down effect
        const colors = useMemo(
            () => ({
                [Status.Success]: toneDown(theme.colors?.success ?? '#22c55e', background, 0.6),
                [Status.PartialSuccess]: toneDown(theme.colors?.success ?? '#22c55e', background, 0.6),
                [Status.InProgress]: toneDown(theme.colors?.warning ?? '#f59e0b', background, 0.6),
                [Status.Paused]: toneDown(theme.colors?.warning ?? '#f59e0b', background, 0.6),
                [Status.Failed]: toneDown(theme.colors?.critical ?? '#ef4444', background, 0.6),
                [Status.Skipped]: toneDown(theme.colors?.forground ?? '#1f2937', background, 0.6),
                bg: background,
                border: toneDown(theme.colors?.forground ?? '#1f2937', background, 0.6),
            }),
            [theme],
        );

        const data = useMemo(() => {
            const normalized = (items ?? []).slice(0, maxSize).map(toEnum);
            if (normalized.length < maxSize) {
                return normalized.concat(Array(maxSize - normalized.length).fill(Status.Skipped));
            }
            return normalized;
        }, [items, maxSize]);

        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                    flexDirection: 'row',
                    alignItems: 'center',
                }}
                style={style}
            >
                {data.map((status, idx) => {
                    const isActive =
                        status === Status.Success ||
                        status === Status.PartialSuccess ||
                        status === Status.Failed ||
                        status === Status.InProgress ||
                        status === Status.Paused;

                    const bg = colors[status] ?? colors[Status.Skipped];

                    const opacity = status === Status.Skipped ? dimOpacity : 1;

                    const handlePress = (e: GestureResponderEvent) => {
                        e.stopPropagation();
                        if (onPressItem) onPressItem(idx, items?.[idx]);
                    };

                    return (
                        <Pressable
                            key={idx}
                            onPress={onPressItem ? handlePress : undefined}
                            accessibilityRole="button"
                            accessibilityLabel={`Health segment ${idx + 1} of ${maxSize}`}
                            accessibilityState={{
                                disabled: !onPressItem,
                                selected: isActive,
                            }}
                            style={[
                                styles.box,
                                {
                                    width: boxSize,
                                    height: boxSize,
                                    borderRadius: radius,
                                    backgroundColor: bg,
                                    marginRight: idx === data.length - 1 ? 0 : gap,
                                    opacity,
                                    borderWidth: status === Status.Skipped ? StyleSheet.hairlineWidth : 0,
                                    borderColor: colors.border,
                                },
                            ]}
                        />
                    );
                })}
            </ScrollView>
        );
    },
);

const styles = StyleSheet.create({
    box: {},
});

export default HealthBar;