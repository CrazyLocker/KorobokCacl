// frontend/src/features/knife/ui/KnifePage.tsx
import { useState } from 'react';
import { Alert, Spin, Typography } from 'antd';
import { calculatorApi } from '../../../api/calculatorApi';

// Результат расчёта ножа (ответ /api/knife/calculate)
export interface KnifeResult {
    totalLengthPx: number;
    totalLengthMm: number;
    knifeCost: number;
    scale: number;
    details: { type: string; lengthPx: number; lengthMm: number }[];
}

/**
 * Страница "Расчет ножа": загрузка SVG → длина линий в мм → стоимость (длина × 3 + 500).
 */
export const KnifePage = () => {
    const [fileName, setFileName] = useState<string>('');
    const [result, setResult] = useState<KnifeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = async (file: File) => {
        setFileName(file.name);
        setResult(null);
        setError(null);
        setLoading(true);
        try {
            const svgContent = await file.text();
            const res = await calculatorApi.calculateKnife(svgContent);
            setResult(res);
        } catch (err: any) {
            setError('Ошибка расчёта ножа: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="knife-page-container">
            <Typography.Title
                level={4}
                style={{ marginTop: 0, marginBottom: 8, color: '#202124', textAlign: 'left', fontWeight: 600 }}
            >
                Расчет ножа
            </Typography.Title>
            <Typography.Paragraph
                style={{ fontSize: 13, color: '#5f6368', marginBottom: 16, textAlign: 'left' }}
            >
                Загрузите SVG-файл развёртки. Стоимость = длина линий (мм) × 3 + 500 ₽.
            </Typography.Paragraph>

            <div
                className="knife-dropzone"
                onClick={() => document.getElementById('knife-file-input')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFile(file);
                }}
            >
                <input
                    id="knife-file-input"
                    type="file"
                    accept=".svg,image/svg+xml"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                    }}
                />
                <Typography.Text style={{ fontSize: 14, color: '#1a73e8', fontWeight: 500 }}>
                    {fileName ? `Файл: ${fileName}` : 'Выберите или перетащите SVG-файл'}
                </Typography.Text>
                {loading && (
                    <div style={{ marginTop: 8 }}>
                        <Spin size="default" />
                    </div>
                )}
            </div>

            {error && <Alert type="error" showIcon style={{ marginTop: 16 }} title={error} />}

            {result && (
                <div style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                        <div style={{ flex: 1, minWidth: 180, padding: 16, backgroundColor: '#e8f0fe', borderRadius: 12 }}>
                            <Typography.Text style={{ fontSize: 12, color: '#5f6368' }}>Длина линий</Typography.Text>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a73e8' }}>
                                {result.totalLengthMm.toFixed(2)} мм
                            </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 180, padding: 16, backgroundColor: '#e6f4ea', borderRadius: 12 }}>
                            <Typography.Text style={{ fontSize: 12, color: '#5f6368' }}>Стоимость ножа</Typography.Text>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#137333' }}>
                                {result.knifeCost.toFixed(2)} ₽
                            </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 180, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 12 }}>
                            <Typography.Text style={{ fontSize: 12, color: '#5f6368' }}>Масштаб (мм/ед. SVG)</Typography.Text>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#202124' }}>
                                {result.scale.toFixed(4)}
                            </div>
                        </div>
                    </div>

                    {result.details.length > 0 && (
                        <>
                            <Typography.Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: '#5f6368',
                                    marginBottom: 8,
                                    display: 'block',
                                    textAlign: 'left',
                                }}
                            >
                                Элементы:
                            </Typography.Text>
                            <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 8 }}>
                                {result.details.map((d, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            padding: '8px 16px',
                                            borderBottom: '1px solid #f1f3f4',
                                        }}
                                    >
                                        <Typography.Text style={{ fontSize: 13 }}>{d.type}</Typography.Text>
                                        <Typography.Text style={{ fontSize: 13, color: '#5f6368' }}>
                                            {d.lengthMm.toFixed(2)} мм
                                        </Typography.Text>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
