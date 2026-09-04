// frontend/src/components/Layout/Sidebar.tsx
import { Box, Paper } from '@mui/material';

interface SidebarProps {
    activePage: string;
    onNavigate: (page: 'calculator' | 'knife' | 'cliche' | 'congrev' | 'silkscreen' | 'references' | 'settings') => void;
}

const navItems = [
    { key: 'calculator', label: 'Расчет коробки', dev: false },
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
                borderRadius: '16px',
                border: '1px solid #e8eaed',
                backgroundColor: '#fff',
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
                        onClick={() => onNavigate(item.key as 'calculator' | 'knife' | 'cliche' | 'congrev' | 'silkscreen' | 'references' | 'settings')}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            p: '8px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: activePage === item.key ? '#e8f0fe' : 'transparent',
                            color: activePage === item.key ? '#1a73e8' : '#5f6368',
                            fontWeight: activePage === item.key ? 500 : 400,
                            fontSize: '13px',
                            transition: 'all 0.15s ease',
                            borderLeft: activePage === item.key ? '3px solid #1a73e8' : '3px solid transparent',
                            '&:hover': {
                                backgroundColor: '#f1f3f4',
                                color: '#1a73e8',
                            },
                        }}
                    >
                        <Box sx={{ flex: 1 }}>{item.label}</Box>
                        {item.dev && (
                            <Box
                                sx={{
                                    fontSize: '9px',
                                    backgroundColor: '#e8eaed',
                                    color: '#9aa0a6',
                                    px: 1.5,
                                    py: 0.25,
                                    borderRadius: '12px',
                                    fontWeight: 400,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em',
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
