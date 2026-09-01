// frontend/src/components/References/ReferencesPage.tsx
import { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Tabs,
    Tab,
    Badge,
} from '@mui/material';
import { ConstructionsTab } from './ConstructionsTab';
import { PriceListTab } from './PriceListTab';
import { PrintTablesTab } from './PrintTablesTab';

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

type TabValue = 'constructions' | 'prices' | 'print';

export const ReferencesPage = ({ onNotify }: Props) => {
    const [activeTab, setActiveTab] = useState<TabValue>('constructions');

    const handleTabChange = (_: React.SyntheticEvent, newValue: TabValue) => {
        setActiveTab(newValue);
    };

    return (
        <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Top bar */}
            <Paper
                elevation={0}
                sx={{
                    p: '16px 24px',
                    mb: 2,
                    borderRadius: '16px',
                    border: '1px solid #e8eaed',
                    backgroundColor: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 500 }}>
                    Справочники
                </Typography>
                <Badge
                    badgeContent="Сохранено"
                    color="success"
                    sx={{
                        '& .MuiBadge-badge': {
                            fontSize: '12px',
                            height: '24px',
                            padding: '0 12px',
                        },
                    }}
                />
            </Paper>

            {/* Tabs */}
            <Box sx={{ mb: 2 }}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    sx={{
                        backgroundColor: '#f1f3f4',
                        borderRadius: '12px',
                        '& .MuiTab-root': {
                            textTransform: 'none',
                            fontWeight: 500,
                            fontSize: '13px',
                            minHeight: '44px',
                            borderRadius: '10px',
                            color: '#5f6368',
                            '&.Mui-selected': {
                                backgroundColor: '#fff',
                                color: '#1a73e8',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            },
                        },
                        '& .MuiTabs-indicator': {
                            display: 'none',
                        },
                    }}
                >
                    <Tab value="constructions" label="Базовые коробки" />
                    <Tab value="prices" label="Прайс коробок" />
                    <Tab value="print" label="Таблица печати" />
                </Tabs>
            </Box>

            {/* Tab content */}
            <Box>
                {activeTab === 'constructions' && <ConstructionsTab onNotify={onNotify} />}
                {activeTab === 'prices' && <PriceListTab onNotify={onNotify} />}
                {activeTab === 'print' && <PrintTablesTab onNotify={onNotify} />}
            </Box>
        </Box>
    );
};
