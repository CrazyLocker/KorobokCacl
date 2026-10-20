// frontend/src/antdTheme.ts
// Единая тема Ant Design. Подключается один раз в main.tsx и должна
// использоваться всеми Ant Design-компонентами приложения.
import type { ThemeConfig } from 'antd';
import { tokens } from './designTokens';

export const antdTheme: ThemeConfig = {
    token: {
        colorPrimary: tokens.color.accentAntd,
        colorInfo: tokens.color.accentAntd,
        colorSuccess: tokens.color.success,
        colorWarning: tokens.color.warning,
        colorError: tokens.color.error,
        colorTextBase: tokens.color.ink,
        colorBgBase: tokens.color.surface,
        colorBgLayout: tokens.color.background,
        colorBorder: tokens.color.border,
        borderRadius: tokens.radius.field,
        fontFamily: tokens.typography.fontFamily,
        fontSize: 14,
    },
};
