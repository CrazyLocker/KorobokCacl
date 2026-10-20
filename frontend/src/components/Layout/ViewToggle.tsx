// frontend/src/components/Layout/ViewToggle.tsx
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { tokens } from '../../theme';

export type AppView = 'classic' | 'new' | 'antd';

interface ViewToggleProps {
    view: AppView;
    onChange: (event: React.MouseEvent<HTMLElement>, value: AppView | null) => void;
}

const toggleButtonSx: SxProps<Theme> = {
    minHeight: 28,
    fontSize: '0.75rem',
    fontWeight: 500,
    lineHeight: 1.5,
    textTransform: 'none',
    px: 1.75,
    py: 0.25,
    border: 0,
    borderRadius: `${tokens.radius.pill}px`,
    color: tokens.color.inkMuted,
    transition: 'background-color 150ms ease, color 150ms ease',
    '&:hover': {
        backgroundColor: tokens.color.surfaceHover,
        color: tokens.color.ink,
    },
    '&.Mui-focusVisible': {
        boxShadow: `0 0 0 3px ${tokens.color.accentRing}`,
    },
    '&.Mui-selected': {
        backgroundColor: tokens.color.accent,
        color: tokens.color.onAccent,
        '&:hover': { backgroundColor: tokens.color.accentHover },
    },
};

/** Переключатель между классическим и новым видом калькулятора. */
export const ViewToggle = ({ view, onChange }: ViewToggleProps) => {
    return (
        <ToggleButtonGroup
            value={view}
            exclusive
            onChange={onChange}
            size="small"
            sx={{
                p: '2px',
                gap: '2px',
                backgroundColor: tokens.color.surfaceSubtle,
                borderRadius: `${tokens.radius.pill}px`,
                border: `1px solid ${tokens.color.border}`,
            }}
        >
            <ToggleButton value="classic" sx={toggleButtonSx}>
                Классический
            </ToggleButton>
            <ToggleButton value="new" sx={toggleButtonSx}>
                Новый UI
            </ToggleButton>
            <ToggleButton value="antd" sx={toggleButtonSx}>
                Ant Design
            </ToggleButton>
        </ToggleButtonGroup>
    );
};
