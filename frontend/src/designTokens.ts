// frontend/src/designTokens.ts
// Дизайн-токены, общие для темы Ant Design (потребитель — antdTheme.ts).
// Модуль намеренно не импортирует UI-библиотеки: ни antd, ни что-либо ещё
// не должно подтягиваться только ради палитры и типографики.
export const fontFamily = [
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
].join(', ');

export const tokens = {
    color: {
        background: '#F7F8FA',
        surface: '#FFFFFF',
        surfaceSubtle: '#FAFAFA',
        ink: '#18181B',
        inkMuted: '#71717A',
        inkSubtle: '#A1A1AA',
        border: '#E4E4E7',
        borderStrong: '#D4D4D8',
        surfaceHover: '#F4F4F5',
        accent: '#2563EB',
        accentHover: '#1D4ED8',
        accentSoft: '#EFF6FF',
        accentSoftHover: '#DBEAFE',
        accentRing: 'rgba(37, 99, 235, 0.14)',
        // Основной цвет утверждённого Ant Design-пилота.
        accentAntd: '#1677FF',
        success: '#16A34A',
        warning: '#D97706',
        warningSoft: '#FEF3C7',
        error: '#DC2626',
        info: '#2563EB',
        onAccent: '#FFFFFF',
    },
    radius: {
        field: 8,
        panel: 12,
        pill: 999,
    },
    shadow: {
        xs: '0 1px 2px rgba(24, 24, 27, 0.04)',
        sm: '0 1px 3px rgba(24, 24, 27, 0.06), 0 1px 2px rgba(24, 24, 27, 0.04)',
        md: '0 8px 24px rgba(24, 24, 27, 0.08)',
        lg: '0 16px 40px rgba(24, 24, 27, 0.12)',
    },
    typography: {
        fontFamily,
        bodySize: '0.875rem', // 14px
        bodyLineHeight: 1.43, // 20px
    },
} as const;
