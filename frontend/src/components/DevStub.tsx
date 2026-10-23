// frontend/src/components/DevStub.tsx
import { Card, Flex, Typography } from 'antd';

interface Props {
    title: string;
}

export const DevStub = ({ title }: Props) => {
    return (
        <Flex
            vertical
            align="center"
            justify="center"
            style={{ minHeight: '60vh', padding: 32 }}
        >
            <Card
                variant="outlined"
                style={{
                    border: '2px dashed #e8eaed',
                    borderRadius: 12,
                }}
                styles={{
                    body: {
                        padding: 48,
                        textAlign: 'center',
                    },
                }}
            >
                <Typography.Title
                    level={5}
                    style={{ fontWeight: 500, marginTop: 0, marginBottom: 8, color: '#202124' }}
                >
                    {title}
                </Typography.Title>
                <Typography.Text style={{ color: '#9aa0a6' }}>
                    Раздел в разработке
                </Typography.Text>
            </Card>
        </Flex>
    );
};
