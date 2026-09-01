// frontend/src/components/Layout/Sidebar.tsx
import { Box, Typography, Paper } from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';

interface SidebarProps {
    activePage: string;
    onNavigate: (page: 'calculator' | 'cliche' | 'congrev' | 'silkscreen' | 'references' | 'settings') => void;
}

const navItems = [
    { key: 'calculator', label: 'Расчет коробки', icon: '🧮', dev: false },
    { key: 'cliche', label: 'Расчет клише', icon: '🖼️', dev: true },
    { key: 'congrev', label: 'Расчет конгрев', icon: '✨', dev: true },
    { key: 'silkscreen', label: 'Расчет шелкография', icon: '🎨', dev: true },
    { key: 'references', label: 'Справочники', icon: '📚', dev: false },
    { key: 'settings', label: 'Настройки', icon: '⚙️', dev: true },
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
                p: 2,
                height: 'fit-content',
                position: 'sticky',
                top: 24,
            }}
        >
            {/* Logo */}
            <Box sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid #e8eaed' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalculateIcon sx={{ fontSize: 24, color: '#1a73e8' }} />
                    <Typography
                        variant="h6"
                        sx={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#1a73e8',
                        }}
                    >
                        Калькулятор
                    </Typography>
                </Box>
                <Typography sx={{ fontSize: '11px', color: '#5f6368', mt: 0.5 }}>
                    стоимости коробки
                </Typography>
            </Box>

            {/* Navigation */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {navItems.map((item) => (
                    <Box
                        key={item.key}
                        onClick={() => onNavigate(item.key as 'calculator' | 'cliche' | 'congrev' | 'silkscreen' | 'references' | 'settings')}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
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
                        <span style={{ fontSize: '16px' }}>{item.icon}</span>
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
