// frontend/src/components/Layout/Header.tsx
import { AppBar, Tabs, Tab, Toolbar, Typography, Box } from '@mui/material';

interface HeaderProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const tabs = [
    'Расчет коробки',
    'Расчет клише',
    'Расчет конгрев',
    'Расчет шелкография',
    'Справочники',
    'Настройки',
];

export const Header = ({ activeTab, onTabChange }: HeaderProps) => {
    return (
        <AppBar
            position="static"
            sx={{
                height: '64px',
                backgroundColor: '#fff',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
                justifyContent: 'center',
                padding: '0 24px',
            }}
        >
            <Toolbar
                disableGutters
                sx={{
                    minHeight: '64px !important',
                    padding: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                {/* Заголовок слева */}
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 600,
                        color: '#1a73e8',
                        fontSize: '18px',
                        letterSpacing: '0.02em',
                    }}
                >
                    Калькулятор расчета коробки
                </Typography>

                {/* Вкладки справа */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Tabs
                        value={activeTab}
                        onChange={(_, value) => onTabChange(value)}
                        textColor="primary"
                        indicatorColor="primary"
                        sx={{
                            '& .MuiTab-root': {
                                textTransform: 'none',
                                fontWeight: 400,
                                fontSize: '14px',
                                color: '#666',
                                padding: '20px 16px 18px',
                                minHeight: '58px',
                                minWidth: '100px',
                            },
                            '& .Mui-selected': {
                                color: '#1a73e8 !important',
                                fontWeight: 600,
                            },
                            '& .MuiTabs-indicator': {
                                backgroundColor: '#1a73e8',
                                height: '3px',
                            },
                        }}
                    >
                        {tabs.map((tab) => (
                            <Tab key={tab} label={tab} value={tab} />
                        ))}
                    </Tabs>
                </Box>
            </Toolbar>
        </AppBar>
    );
};