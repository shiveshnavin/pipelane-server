// DraggableTasksList.tsx
// HTML5-drag-and-drop implementation for web with a fallback icon-based reorder.
// Keeps the original `onRender` contract from your SimpleDatalistView and
// preserves an icon action so you can keep the icon-based move for devices
// where drag doesn't work well.

import React, { useState, useRef, useContext } from "react";
import { Pipetask } from "../../gen/model";
import { Icon, Spinner, ThemeContext, VBox } from "react-native-boxes";

type Props = {
    tasks: Pipetask[];
    onReorder: (newTasks: Pipetask[]) => void;
    /**
     * If provided, used to render each item (same contract as your SimpleDatalistView onRender).
     * Signature: (item: Pipetask, idx: number) => React.ReactNode
     */
    onRender?: (item: Pipetask, idx: number) => React.ReactNode;
    /**
     * Whether to show the icon-based fallback control for manual moves.
     * Default: true
     */
    showIconFallback?: boolean;
    loading?: boolean;
};

export default function DraggableTasksList({ tasks, onReorder, onRender, showIconFallback = true, loading = false }: Props) {
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const dragOverIndexRef = useRef<number | null>(null);
    const theme = useContext(ThemeContext)
    function moveItem(from: number, to: number) {
        if (from < 0 || to < 0 || from === to) return;
        const updated = [...tasks];
        const [moved] = updated.splice(from, 1);
        // When moving downward the insert index should account for removal
        const insertIndex = from < to ? to : to;
        updated.splice(insertIndex, 0, moved);
        // update step numbers
        updated.forEach((t, idx) => (t.step = idx));
        onReorder(updated);
    }

    function moveUpByIcon(index: number) {
        if (!tasks || tasks.length === 0) return;
        if (index > 0) {
            moveItem(index, index - 1);
        } else {
            // wrap-around: move first item to the bottom
            moveItem(index, tasks.length - 1);
        }
    }

    function handleDragStart(e: React.DragEvent, index: number) {
        setDraggingIndex(index);
        e.dataTransfer.effectAllowed = "move";
        try {
            e.dataTransfer.setData("text/plain", String(index));
        } catch (err) {
            // ignore
        }
    }

    function handleDragOver(e: React.DragEvent, index: number) {
        e.preventDefault(); // allow drop
        if (dragOverIndexRef.current !== index) {
            dragOverIndexRef.current = index;
        }
    }

    function handleDrop(e: React.DragEvent, index: number) {
        e.preventDefault();
        const from = draggingIndex ?? parseInt(e.dataTransfer.getData("text/plain") || "-1", 10);
        const to = index;
        if (from < 0 || to < 0 || from === to) {
            setDraggingIndex(null);
            dragOverIndexRef.current = null;
            return;
        }
        moveItem(from, to);
        setDraggingIndex(null);
        dragOverIndexRef.current = null;
    }

    function handleDragEnd() {
        setDraggingIndex(null);
        dragOverIndexRef.current = null;
    }

    if (loading) {
        return <Spinner style={{
            marginTop: 20
        }} />

    }

    return (
        <div style={{ width: "100%" }}>
            {tasks.map((task, idx) => {
                const content = onRender ? onRender(task, idx) : (
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div style={{ padding: 6, marginRight: 12, cursor: 'grab' }} aria-hidden>☰</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{task.name}{!task.active ? ' (Disabled)' : ''}</div>
                            <div style={{ fontSize: 13, color: '#666' }}>{task.taskVariantName} ({task.taskTypeName})</div>
                        </div>
                    </div>
                );

                return (
                    <VBox>
                        <div
                            key={task.name}
                            draggable
                            data-index={idx}
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={(e) => handleDrop(e, idx)}
                            onDragEnd={handleDragEnd}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: draggingIndex === idx ? theme.colors.background : theme.colors.transparent,
                                cursor: 'grab'
                            }}
                        >
                            <div style={{ flex: 1 }}>{content}</div>

                            {showIconFallback && (
                                <div style={{ marginLeft: 12 }}>
                                    <button
                                        aria-label="Move up"
                                        title="Move up"
                                        onClick={(ev) => { ev.stopPropagation(); moveUpByIcon(idx); }}
                                        style={{
                                            marginRight: theme.dimens.space.md,
                                            border: `1px solid ${theme.colors.accent}`,
                                            borderRadius: 6,
                                            background: theme.colors.transparent,
                                            padding: "4px 8px",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            boxShadow: `0 1px 3px ${theme.colors.caption}`,
                                        }}
                                    >
                                        <Icon name="arrow-up" color={theme.colors.accent} />
                                    </button>

                                </div>
                            )}
                        </div>
                    </VBox>
                );
            })}
        </div>
    );
}

/*
Integration (inside your PipelaneView):

1) Keep your original `onRender` function (the one that returned the HBox/Link/Icon etc.)
   and pass it as the `onRender` prop so existing visuals remain identical.

<DraggableTasksList
  tasks={pipe.tasks || []}
  onRender={(item, idx) => (
    // your existing onRender body - return the same JSX you used in SimpleDatalistView
  )}
  onReorder={(newTasks) => {
    setPipe({ ...pipe, tasks: newTasks });
  }}
/>

2) The component will show a small arrow button (⬆) as a fallback when drag doesn't work.
   You can set `showIconFallback={false}` to hide it.

3) If you want the exact same `Icon` component from `react-native-boxes` instead of the
   textual arrow, use that component inside your `onRender` (you already had it) and wire
   its onPress to call the `moveUpByIcon(idx)` helper — because `onRender` runs inside
   the parent scope it can call a handler you provide. Example:

// inside PipelaneView
const onRender = (item: Pipetask, idx: number) => (
  <HBox ...>
    ...
    <Icon onPress={() => moveUpByIcon(idx)} name="arrow-up" />
  </HBox>
)

// then pass it to DraggableTasksList

Note: If you need keyboard / accessibility / mobile-touch parity, I can port this
implementation to `dnd-kit` (recommended). That will give smooth touch support,
keyboard dragging, and better aria attributes.
*/