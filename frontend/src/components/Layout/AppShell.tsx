// frontend/src/components/Layout/AppShell.tsx
// Ant Design shell: боковая навигация, шапка и контент.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
    AppstoreOutlined,
    BgColorsOutlined,
    BookOutlined,
    CalculatorOutlined,
    FireOutlined,
    HighlightOutlined,
    MenuOutlined,
    SaveOutlined,
    ScissorOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import {
    Button,
    Drawer,
    Flex,
    Grid,
    Layout,
    Menu,
    Space,
    Tag,
    Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import { NAV_ITEMS } from '../../navigation';
import type { PageType } from '../../navigation';
import { tokens } from '../../designTokens';

const { Sider, Header, Content } = Layout;
const { Text, Title } = Typography;

const NAV_ICONS: Record<PageType, ReactNode> = {
    calculator: <CalculatorOutlined />,
    layout: <AppstoreOutlined />,
    knife: <ScissorOutlined />,
    cliche: <HighlightOutlined />,
    congrev: <FireOutlined />,
    silkscreen: <BgColorsOutlined />,
    references: <BookOutlined />,
    settings: <SettingOutlined />,
};

const menuItems: MenuProps['items'] = NAV_ITEMS.map((item) => ({
    key: item.key,
    icon: NAV_ICONS[item.key],
    label: item.dev ? (
        <Space size={6}>
            <span>{item.label}</span>
            <Tag style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: '16px' }}>dev</Tag>
        </Space>
    ) : item.label,
}));

const Brand = () => (
    <Flex align="center" gap={10} style={{ padding: '18px 20px 14px' }}>
        <div
            aria-hidden
            style={{
                width: 34,
                height: 34,
                borderRadius: tokens.radius.field,
                background: tokens.color.accentAntd,
                color: tokens.color.onAccent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0,
            }}
        >
            K
        </div>
        <div style={{ minWidth: 0 }}>
            <Text strong style={{ display: 'block', lineHeight: 1.25 }}>Korobok</Text>
            <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.25 }}>WebCalc</Text>
        </div>
    </Flex>
);

interface AppShellProps {
    activePage: PageType;
    onNavigate: (page: PageType) => void;
    onSave: () => void;
    children: ReactNode;
}

/** Общая оболочка приложения. MUI-страницы временно рендерятся внутри Content. */
export const AppShell = ({ activePage, onNavigate, onSave, children }: AppShellProps) => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.md;
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    useEffect(() => {
        if (!isMobile) setMobileNavOpen(false);
    }, [isMobile]);

    const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
        onNavigate(key as PageType);
        setMobileNavOpen(false);
    };

    const navigation = (
        <Menu
            mode="inline"
            selectedKeys={[activePage]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ borderInlineEnd: 0, padding: '0 10px 16px' }}
        />
    );

    return (
        <Layout style={{ minHeight: '100vh', background: tokens.color.background }}>
            {!isMobile && (
                <Sider
                    width={236}
                    theme="light"
                    style={{
                        background: tokens.color.surface,
                        borderRight: `1px solid ${tokens.color.border}`,
                        position: 'sticky',
                        top: 0,
                        height: '100vh',
                        overflow: 'auto',
                    }}
                >
                    <Brand />
                    {navigation}
                </Sider>
            )}

            <Layout style={{ background: tokens.color.background }}>
                <Header
                    style={{
                        height: 64,
                        lineHeight: 'normal',
                        background: tokens.color.surface,
                        borderBottom: `1px solid ${tokens.color.border}`,
                        padding: '0 16px 0 24px',
                        display: 'flex',
                        alignItems: 'center',
                        position: 'sticky',
                        top: 0,
                        zIndex: 20,
                    }}
                >
                    <Flex align="center" justify="space-between" gap={12} style={{ width: '100%' }}>
                        <Flex align="center" gap={10} style={{ minWidth: 0 }}>
                            {isMobile && (
                                <Button
                                    type="text"
                                    icon={<MenuOutlined />}
                                    aria-label="Открыть навигацию"
                                    onClick={() => setMobileNavOpen(true)}
                                />
                            )}
                            <Title
                                level={4}
                                style={{
                                    margin: 0,
                                    fontSize: isMobile ? 17 : 20,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                Расчет заказа
                            </Title>
                        </Flex>

                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={onSave}
                            aria-label="Сохранить расчёт"
                            data-testid="save-calculation-button"
                        >
                            {!isMobile && 'Сохранить расчёт'}
                        </Button>
                    </Flex>
                </Header>

                <Content style={{ padding: isMobile ? 12 : 24 }}>
                    <div
                        data-testid="app-content"
                        style={{
                            width: '100%',
                            maxWidth: 1600,
                            margin: '0 auto',
                            boxSizing: 'border-box',
                        }}
                    >
                        {children}
                    </div>
                </Content>
            </Layout>

            <Drawer
                open={mobileNavOpen}
                onClose={() => setMobileNavOpen(false)}
                placement="left"
                size={264}
                styles={{ body: { padding: 0 } }}
            >
                <Brand />
                {navigation}
            </Drawer>
        </Layout>
    );
};
