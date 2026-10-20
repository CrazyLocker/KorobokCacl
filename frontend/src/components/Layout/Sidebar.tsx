// frontend/src/components/Layout/Sidebar.tsx
import { Box, Paper } from '@mui/material';
import { tokens } from '../../theme';

type PageType = 'calculator' | 'knife' | 'layout' | 'cliche' | 'congrev' | 'silkscreen' | 'references' | 'settings';

interface SidebarProps {
    activePage: string;
    onNavigate: (page: PageType) => void;
}

const navItems = [
    { key: 'calculator', label: 'Расчет коробки', dev: false },
    { key: 'layout', label: 'Раскладка', dev: false },
    { key: 'knife', label: 'Расчет ножа', dev: false },
    { key: 'cliche', label: 'Расчет клише', dev: true },
    { key: 'congrev', label: 'Расчет конгрев', dev: true },
    { key: 'silkscreen', label: 'Расчет шелкография', dev: true },
    { key: 'references', label: 'Справочники', dev: false },
    { key: 'settings', label: 'Настройки', dev: false },
];

export const Sidebar = ({ activePage, onNavigate }: SidebarProps) => {
    return (
        <Paper
            elevation={0}
            sx={{
                width: 200,
                flexShrink: 0,
                borderRadius: `${tokens.radius.panel}px`,
                border: `1px solid ${tokens.color.border}`,
                backgroundColor: tokens.color.surface,
                boxShadow: tokens.shadow.xs,
                p: 1.5,
                height: 'fit-content',
                position: 'sticky',
                top: 24,
            }}
        >
            {/* Navigation */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {navItems.map((item) => (
                    <Box
                        key={item.key}
                        onClick={() => onNavigate(item.key as PageType)}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            p: '8px 12px',
                            borderRadius: `${tokens.radius.field}px`,
                            cursor: 'pointer',
                            backgroundColor: activePage === item.key ? tokens.color.accentSoft : 'transparent',
                            color: activePage === item.key ? tokens.color.accent : tokens.color.inkMuted,
                            fontWeight: activePage === item.key ? 500 : 400,
                            fontSize: '0.8125rem',
                            lineHeight: 1.45,
                            transition: 'background-color 150ms ease, color 150ms ease',
                            borderLeft: `3px solid ${activePage === item.key ? tokens.color.accent : 'transparent'}`,
                            '&:hover': {
                                backgroundColor: activePage === item.key
                                    ? tokens.color.accentSoftHover
                                    : tokens.color.surfaceHover,
                                color: activePage === item.key ? tokens.color.accent : tokens.color.ink,
                            },
                        }}
                    >
                        <Box sx={{ flex: 1 }}>{item.label}</Box>
                        {item.dev && (
                            <Box
                                sx={{
                                    fontSize: '0.625rem',
                                    backgroundColor: tokens.color.background,
                                    color: tokens.color.inkMuted,
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: `${tokens.radius.pill}px`,
                                    fontWeight: 500,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                }}
                            >
                                dev
                            </Box>
                        )}
                    </Box>
                ))}
            </Box>
        </Paper>
    );
};
