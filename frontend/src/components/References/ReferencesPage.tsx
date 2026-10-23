// frontend/src/components/References/ReferencesPage.tsx
import { useState } from 'react';
import { Badge, Card, Tabs, Typography } from 'antd';
import { ConstructionsTab } from './ConstructionsTab';
import { PriceListTab } from './PriceListTab';
import { PrintTablesTab } from './PrintTablesTab';

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

type TabValue = 'constructions' | 'prices' | 'print';

export const ReferencesPage = ({ onNotify }: Props) => {
    const [activeTab, setActiveTab] = useState<TabValue>('constructions');

    const tabsItems = [
        {
            key: 'constructions',
            label: 'Базовые коробки',
            children: <ConstructionsTab onNotify={onNotify} />,
        },
        {
            key: 'prices',
            label: 'Прайс коробок',
            children: <PriceListTab onNotify={onNotify} />,
        },
        {
            key: 'print',
            label: 'Таблица печати',
            children: <PrintTablesTab onNotify={onNotify} />,
        },
    ];

    return (
        <Card style={{ flex: 1, minWidth: 0 }}>
            <Card
                style={{
                    marginBottom: 16,
                    borderRadius: 16,
                    border: '1px solid #e8eaed',
                    backgroundColor: '#fff',
                }}
                styles={{ body: { padding: '16px 24px' } }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                    }}
                >
                    <Typography.Title level={5} style={{ margin: 0 }}>
                        Справочники
                    </Typography.Title>
                    <Badge status="success" text="Сохранено" />
                </div>
            </Card>

            <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as TabValue)}
                items={tabsItems}
                style={{ marginBottom: 16 }}
            />
        </Card>
    );
};
