// frontend/src/features/knife/ui/KnifePage.tsx
import { useState } from 'react';
import { Alert, Checkbox, Space, Spin, Table, Typography } from 'antd';
import type { TableProps } from 'antd';
import { calculatorApi } from '../../../api/calculatorApi';
import type { KnifeElement, KnifeOptions, KnifeResult } from '../../../types';
import { KNIFE_DEFAULT_OPTIONS } from '../../../utils/knifeRequest';

/** Колонки таблицы элементов контура — как в прототипе (№, тип, px, мм, transform). */
const elementColumns: TableProps<KnifeElement>['columns'] = [
    {
        title: '№',
        key: 'index',
        width: 56,
        render: (_value, _record, index) => index + 1,
    },
    { title: 'Тип', dataIndex: 'type', key: 'type' },
    {
        title: 'Длина, px',
        dataIndex: 'lengthPx',
        key: 'lengthPx',
        align: 'right',
        render: (value: number) => value.toFixed(2),
    },
    {
        title: 'Длина, мм',
        dataIndex: 'lengthMm',
        key: 'lengthMm',
        align: 'right',
        render: (value: number) => value.toFixed(2),
    },
    {
        title: 'transform',
        dataIndex: 'hasTransform',
        key: 'hasTransform',
        align: 'center',
        render: (value: boolean) => (value ? 'да' : '—'),
    },
];

/** Элементы из ответа: новое поле elements, иначе устаревшее details. */
const toElements = (result: KnifeResult): KnifeElement[] =>
    result.elements ??
    (result.details ?? []).map((d) => ({ ...d, hasTransform: false }));

/** Текст ошибки из axios/Error без использования `any`. */
const errorText = (err: unknown): string => {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    return e?.response?.data?.message || e?.message || String(err);
};

/**
 * Страница "Расчет ножа": загрузка SVG → длина линий в мм → стоимость (длина × 3 + 500).
 * Геометрия считается на бэкенде (SvgLengthCalculator — порт прототипа);
 * фронт только передаёт флаги режима (по умолчанию оба включены) и показывает результат.
 */
export const KnifePage = () => {
    const [fileName, setFileName] = useState<string>('');
    const [svgContent, setSvgContent] = useState<string>('');
    const [options, setOptions] = useState<KnifeOptions>(KNIFE_DEFAULT_OPTIONS);
    const [result, setResult] = useState<KnifeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const calculate = async (content: string, nextOptions: KnifeOptions) => {
        setLoading(true);
        setError(null);
        try {
            const res = await calculatorApi.calculateKnife(content, nextOptions);
            setResult(res);
        } catch (err) {
            setResult(null);
            setError('Ошибка расчёта ножа: ' + errorText(err));
        } finally {
            setLoading(false);
        }
    };

    const handleFile = async (file: File) => {
        setFileName(file.name);
        setResult(null);
        setError(null);
        try {
            const content = await file.text();
            setSvgContent(content);
            await calculate(content, options);
        } catch (err) {
            setError('Не удалось прочитать файл: ' + errorText(err));
        }
    };

    /** Переключение чекбокса сразу пересчитывает загруженный файл (как в прототипе). */
    const handleOptionChange = (patch: Partial<KnifeOptions>) => {
        const next = { ...options, ...patch };
        setOptions(next);
        if (svgContent) void calculate(svgContent, next);
    };

    const elements = result ? toElements(result) : [];
    // Разбор не удался (битый XML, DTD): бэкенд вернул причину вместо молчаливых нулей.
    const parseError = result?.parseError ?? null;
    // Валидный SVG без поддерживаемой геометрии: <use>/<text>/<image>/clipPath и т.п.
    const hasElements = elements.length > 0;

    return (
        <div className="knife-page-container">
            <Typography.Title
                level={4}
                style={{ marginTop: 0, marginBottom: 8, color: '#202124', textAlign: 'left', fontWeight: 600 }}
            >
                Расчет ножа
            </Typography.Title>
            <Typography.Paragraph
                style={{ fontSize: 13, color: '#5f6368', marginBottom: 12, textAlign: 'left' }}
            >
                Загрузите SVG-файл развёртки. Стоимость = длина линий (мм) × 3 + 500 ₽.
            </Typography.Paragraph>

            <Space size={24} style={{ marginBottom: 12 }}>
                <Checkbox
                    checked={options.useTransform}
                    onChange={(e) => handleOptionChange({ useTransform: e.target.checked })}
                >
                    Учитывать трансформации
                </Checkbox>
                <Checkbox
                    checked={options.useUnits}
                    onChange={(e) => handleOptionChange({ useUnits: e.target.checked })}
                >
                    Учитывать единицы измерения
                </Checkbox>
            </Space>

            {/* Почему нативный input + onDrop, а не AntD Upload.Dragger:
                сохраняем текущий UX (клик по всей зоне, drag-n-drop, скрытый input);
                Upload.Dragger меняет разметку и подпись — кандидат на будущий рефакторинг. */}
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

            {/* Разбор не удался: показываем причину, а не карточки с нулями. */}
            {result && parseError && (
                <Alert
                    type="error"
                    showIcon
                    style={{ marginTop: 16 }}
                    title={`Не удалось разобрать SVG: ${parseError}`}
                />
            )}

            {/* SVG разобран, но поддерживаемой геометрии нет — это не ошибка разбора. */}
            {result && !parseError && !hasElements && (
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 16 }}
                    title="В SVG нет линий и фигур"
                    description={
                        'Учитываются line, rect, circle, ellipse, polyline, polygon и path. ' +
                        'Контуры, заданные через <use>, <text>, <image> или clipPath, не поддерживаются.'
                    }
                />
            )}

            {result && !parseError && hasElements && (
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
                            <Typography.Text style={{ fontSize: 12, color: '#5f6368' }}>
                                Масштаб (мм/{result.unit ?? 'ед. SVG'})
                            </Typography.Text>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#202124' }}>
                                {result.scale.toFixed(4)}
                            </div>
                            {result.scaleSource && (
                                <Typography.Text style={{ fontSize: 11, color: '#5f6368' }}>
                                    источник: {result.scaleSource}
                                </Typography.Text>
                            )}
                        </div>
                    </div>

                    {hasElements && (
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
                                Элементы: {elements.length}
                            </Typography.Text>
                            <Table<KnifeElement>
                                size="small"
                                columns={elementColumns}
                                dataSource={elements}
                                pagination={false}
                                scroll={{ y: 300 }}
                                rowKey={(_record, index) => String(index ?? 0)}
                            />
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
