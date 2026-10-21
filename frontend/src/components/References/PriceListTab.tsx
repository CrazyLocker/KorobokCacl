 // frontend/src/components/References/PriceListTab.tsx
import { useState, useEffect } from 'react';
import {
    Alert, App as AntdApp, Button, Card, Flex, Input, InputNumber,
    Select, Spin, Table, Typography,
} from 'antd';
import type { Construct, PriceListData } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';

const PRICE_RANGES = ['до 9', '10–49', '50–199', '200–499', '500–699', '700–1499', 'от 1500'];

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

export const PriceListTab = ({ onNotify }: Props) => {
    const { modal } = AntdApp.useApp();
    const [constructs, setConstructs] = useState<Construct[]>([]);
    const [selectedConstruct, setSelectedConstruct] = useState<string>('');
    const [priceCode, setPriceCode] = useState<string>('');
    const [priceData, setPriceData] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Загрузка конструкций
    useEffect(() => {
        setLoading(true);
        calculatorApi.getConstructs()
            .then((data) => {
                setConstructs(data);
                if (data.length > 0) {
                    setSelectedConstruct(data[0].id);
                }
            })
            .catch((err) => {
                setError('Ошибка загрузки: ' + err.message);
            })
            .finally(() => setLoading(false));
    }, []);

    const selectedConstructData = constructs.find((c) => c.id === selectedConstruct);

    // Загрузка прайс-листа
    useEffect(() => {
        if (!selectedConstruct) return;
        calculatorApi.getPriceList(selectedConstruct)
            .then((data) => {
                if (data) {
                    setPriceData(data.priceData || {});
                    setPriceCode(data.id);
                } else {
                    setPriceData({});
                    setPriceCode('');
                }
            })
            .catch(() => {
                setPriceData({});
                setPriceCode('');
            });
    }, [selectedConstruct]);

    // Сохранение прайс-листа
    const handleSave = async () => {
        if (!selectedConstruct) {
            onNotify('Выберите конструкцию', 'error');
            return;
        }
        setSaving(true);
        try {
            const priceListData: PriceListData = {
                id: priceCode || null,
                constructId: selectedConstruct,
                priceData,
            };
            const saved = await calculatorApi.savePriceList(priceListData);
            setPriceCode(saved.id);
            onNotify('Прайс-лист сохранён', 'success');
        } catch (err: any) {
            onNotify('Ошибка сохранения: ' + (err.response?.data?.message || err.message), 'error');
        } finally {
            setSaving(false);
        }
    };

    // Удаление прайс-листа
    const handleDelete = () => {
        if (!selectedConstruct || !priceCode) {
            onNotify('Прайс-лист не найден', 'error');
            return;
        }
        modal.confirm({
            title: 'Удалить прайс-лист?',
            content: `Удалить прайс-лист для "${selectedConstructData?.name}"?`,
            okText: 'Удалить',
            okButtonProps: { danger: true },
            cancelText: 'Отмена',
            onOk: async () => {
                try {
                    await calculatorApi.deletePriceList(priceCode);
                    setPriceData({});
                    setPriceCode('');
                    onNotify('Прайс-лист удалён', 'success');
                } catch (err: any) {
                    onNotify('Ошибка удаления: ' + (err.response?.data?.message || err.message), 'error');
                }
            },
        });
    };

    // Обновление цены
    const handlePriceChange = (range: string, value: number) => {
        setPriceData((prev) => ({ ...prev, [range]: value }));
    };

    return (
        <div>
            {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

            {/* Конструктор */}
            <Card
                style={{
                    marginBottom: 16,
                    borderRadius: 12,
                    border: '1px solid #e8eaed',
                    backgroundColor: '#f8f9fa',
                    boxShadow: 'none',
                }}
                styles={{ body: { padding: 16 } }}
            >
                <Typography.Text
                    style={{
                        display: 'block',
                        fontSize: 12,
                        color: '#5f6368',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                    }}
                >
                    Конструкция
                </Typography.Text>
                <Flex gap={16} wrap="wrap" align="center">
                    <Select
                        value={selectedConstruct || undefined}
                        onChange={(value) => setSelectedConstruct(value)}
                        options={constructs.map((c) => ({ value: c.id, label: c.name }))}
                        placeholder="Выберите конструкцию"
                        style={{ minWidth: 200 }}
                    />
                    <Input
                        value={priceCode}
                        onChange={(e) => setPriceCode(e.target.value)}
                        placeholder="UUID"
                        style={{ minWidth: 120, maxWidth: 180 }}
                    />
                    <Button
                        size="small"
                        onClick={handleSave}
                        loading={saving}
                        style={{
                            borderColor: '#137333',
                            color: '#137333',
                            fontSize: 12,
                            borderRadius: 20,
                        }}
                    >
                        Сохранить
                    </Button>
                    <Button
                        size="small"
                        danger
                        onClick={handleDelete}
                        disabled={!priceCode}
                        style={{
                            borderColor: '#d93025',
                            color: '#d93025',
                            fontSize: 12,
                            borderRadius: 20,
                        }}
                    >
                        Удалить
                    </Button>
                </Flex>
            </Card>

            {/* Таблица прайса */}
            <Card
                style={{ borderRadius: 12, border: '1px solid #e8eaed', overflow: 'hidden', boxShadow: 'none' }}
                styles={{ body: { padding: 0 } }}
            >
                <Flex justify="space-between" align="center" style={{ padding: 16, paddingBottom: 8, borderBottom: '1px solid #e8eaed' }}>
                    <Typography.Text
                        strong
                        style={{
                            fontSize: 14,
                            color: '#202124',
                            paddingBottom: 8,
                            borderBottom: '2px solid #1a73e8',
                            flex: 1,
                            textAlign: 'left',
                        }}
                    >
                        Прайс-лист коробок
                    </Typography.Text>
                    <Typography.Text
                        style={{
                            fontSize: 10,
                            fontWeight: 500,
                            backgroundColor: '#1a73e8',
                            color: '#fff',
                            padding: '2px 16px',
                            borderRadius: 16,
                        }}
                    >
                        {Object.keys(priceData).length} позиций
                    </Typography.Text>
                </Flex>

                {loading ? (
                    <div style={{ padding: 32, textAlign: 'center' }}>
                        <Spin />
                    </div>
                ) : !selectedConstruct ? (
                    <div style={{ padding: 32, textAlign: 'center', color: '#9aa0a6' }}>
                        Выберите конструкцию
                    </div>
                ) : (
                    <Table
                        rowKey="range"
                        size="small"
                        pagination={false}
                        dataSource={PRICE_RANGES.map((range) => ({ range, price: priceData[range] || 0 }))}
                        columns={[
                            {
                                title: 'Диапазон',
                                dataIndex: 'range',
                                key: 'range',
                                render: (range: string) => (
                                    <Typography.Text strong style={{ fontSize: 13 }}>{range}</Typography.Text>
                                ),
                            },
                            {
                                title: 'Цена (₽)',
                                dataIndex: 'price',
                                key: 'price',
                                align: 'center',
                                width: 120,
                                render: (price: number, row: { range: string; price: number }) => (
                                    <InputNumber
                                        value={price}
                                        onChange={(value) => handlePriceChange(row.range, value ?? 0)}
                                        min={0}
                                        step={1}
                                        size="small"
                                        style={{
                                            width: 50,
                                            backgroundColor: price === 0 ? '#f8f9fa' : '#fff',
                                        }}
                                    />
                                ),
                            },
                            {
                                title: '',
                                key: 'actions',
                                width: 40,
                                align: 'center',
                            },
                        ]}
                    />
                )}
            </Card>
        </div>
    );
};
