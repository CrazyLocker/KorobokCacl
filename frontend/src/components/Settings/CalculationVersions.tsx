// frontend/src/components/Settings/CalculationVersions.tsx
import { useEffect, useState } from 'react';
import { Alert, Flex, Spin, Typography } from 'antd';
import type { CalculationVersion } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';
import { VersionTree } from './VersionTree';

interface Props {
    /** Корень дерева — идентификатор расчёта из списка. */
    rootId: string;
    /** Открыть версию в «Виде расчёта». */
    onOpen: (id: string) => void;
}

/**
 * Дерево версий под строкой списка расчётов: грузится только при раскрытии
 * строки, чтобы список не тянул историю всех расчётов сразу.
 */
export const CalculationVersions = ({ rootId, onOpen }: Props) => {
    const [versions, setVersions] = useState<CalculationVersion[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setVersions(null);
        setError(null);

        calculatorApi.getCalculationVersions(rootId)
            .then((data) => {
                if (!cancelled) setVersions(data);
            })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить версии');
            });

        return () => {
            cancelled = true;
        };
    }, [rootId]);

    if (error) return <Alert type="error" showIcon message={error} />;

    if (!versions) {
        return (
            <Flex justify="center" style={{ padding: 12 }}>
                <Spin size="small" />
            </Flex>
        );
    }

    return (
        <Flex vertical gap={6} style={{ padding: '4px 8px' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Клик по версии открывает её в «Виде расчёта»
            </Typography.Text>
            <VersionTree versions={versions} selectedId={null} onSelect={onOpen} />
        </Flex>
    );
};
