// frontend/src/theme.ts
// Precision Instrument — MUI-тема переходного периода.
// Общие токены живут в designTokens.ts и используются также темой Ant Design;
// до завершения миграции часть sx-стилей компонентов может переопределять
// эти значения — это ожидаемо.
import { createTheme } from '@mui/material/styles';
import { fontFamily, tokens } from './designTokens';

export { tokens } from './designTokens';

export const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: tokens.color.accent,
            dark: tokens.color.accentHover,
            light: '#60A5FA',
            contrastText: tokens.color.onAccent,
        },
        secondary: {
            main: tokens.color.ink,
            dark: '#09090B',
            light: '#3F3F46',
            contrastText: '#FFFFFF',
        },
        background: {
            default: tokens.color.background,
            paper: tokens.color.surface,
        },
        text: {
            primary: tokens.color.ink,
            secondary: tokens.color.inkMuted,
            disabled: tokens.color.inkSubtle,
        },
        divider: tokens.color.border,
        success: {
            main: tokens.color.success,
            light: '#DCFCE7',
            dark: '#15803D',
            contrastText: '#FFFFFF',
        },
        warning: {
            main: tokens.color.warning,
            light: tokens.color.warningSoft,
            dark: '#B45309',
            contrastText: '#FFFFFF',
        },
        error: {
            main: tokens.color.error,
            light: '#FEE2E2',
            dark: '#B91C1C',
            contrastText: '#FFFFFF',
        },
        info: {
            main: tokens.color.info,
            light: '#DBEAFE',
            dark: '#1D4ED8',
            contrastText: '#FFFFFF',
        },
        action: {
            active: tokens.color.ink,
            hover: 'rgba(24, 24, 27, 0.04)',
            selected: 'rgba(37, 99, 235, 0.08)',
            disabled: tokens.color.inkSubtle,
            disabledBackground: '#F4F4F5',
            focus: 'rgba(37, 99, 235, 0.12)',
        },
    },
    shape: {
        borderRadius: tokens.radius.field,
    },
    typography: {
        fontFamily,
        fontSize: 14,
        htmlFontSize: 16,
        fontWeightLight: 400,
        fontWeightRegular: 400,
        fontWeightMedium: 500,
        fontWeightBold: 700,
        h1: {
            fontSize: '2.5rem',
            lineHeight: 1.15,
            fontWeight: 600,
            letterSpacing: '-0.03em',
        },
        h2: {
            fontSize: '2rem',
            lineHeight: 1.2,
            fontWeight: 600,
            letterSpacing: '-0.025em',
        },
        h3: {
            fontSize: '1.625rem',
            lineHeight: 1.25,
            fontWeight: 600,
            letterSpacing: '-0.02em',
        },
        h4: {
            fontSize: '1.75rem',
            lineHeight: 1.29,
            fontWeight: 600,
            letterSpacing: '-0.02em',
        },
        h5: {
            fontSize: '1.375rem',
            lineHeight: 1.36,
            fontWeight: 600,
            letterSpacing: '-0.015em',
        },
        h6: {
            fontSize: '1.125rem',
            lineHeight: 1.44,
            fontWeight: 600,
            letterSpacing: '-0.01em',
        },
        subtitle1: {
            fontSize: '0.875rem',
            lineHeight: 1.43,
            fontWeight: 500,
        },
        subtitle2: {
            fontSize: '0.8125rem',
            lineHeight: 1.38,
            fontWeight: 500,
        },
        body1: {
            fontSize: tokens.typography.bodySize,
            lineHeight: tokens.typography.bodyLineHeight,
            fontWeight: 400,
        },
        body2: {
            fontSize: '0.8125rem',
            lineHeight: 1.38,
            fontWeight: 400,
        },
        button: {
            fontSize: '0.875rem',
            lineHeight: 1.43,
            fontWeight: 500,
            letterSpacing: 0,
            textTransform: 'none',
        },
        caption: {
            fontSize: '0.75rem',
            lineHeight: 1.33,
            fontWeight: 400,
        },
        overline: {
            fontSize: '0.6875rem',
            lineHeight: 1.45,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: tokens.color.background,
                    color: tokens.color.ink,
                    fontFamily,
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                },
            },
        },
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    minHeight: 36,
                    padding: '7px 14px',
                    borderRadius: tokens.radius.field,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    lineHeight: 1.43,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: 'none',
                    },
                },
                sizeSmall: {
                    minHeight: 32,
                    padding: '5px 10px',
                    fontSize: '0.8125rem',
                },
                sizeLarge: {
                    minHeight: 40,
                    padding: '9px 18px',
                    fontSize: '0.9375rem',
                },
                contained: {
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: 'none',
                    },
                },
                outlined: {
                    borderColor: tokens.color.border,
                    '&:hover': {
                        borderColor: tokens.color.accent,
                        backgroundColor: tokens.color.accentSoft,
                    },
                },
                text: {
                    '&:hover': {
                        backgroundColor: 'rgba(24, 24, 27, 0.04)',
                    },
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    minHeight: 36,
                    borderRadius: tokens.radius.field,
                    backgroundColor: tokens.color.surface,
                    fontSize: '0.875rem',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease',
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: tokens.color.border,
                        borderWidth: 1,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: tokens.color.borderStrong,
                    },
                    '&.Mui-focused': {
                        boxShadow: `0 0 0 3px ${tokens.color.accentRing}`,
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: tokens.color.accent,
                        borderWidth: 1,
                    },
                    '&.Mui-error.Mui-focused': {
                        boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.12)',
                    },
                    '&.Mui-disabled': {
                        backgroundColor: tokens.color.surfaceSubtle,
                    },
                },
                input: {
                    padding: '8px 12px',
                    '&::placeholder': {
                        color: tokens.color.inkSubtle,
                        opacity: 1,
                    },
                },
                inputSizeSmall: {
                    padding: '6px 10px',
                    fontSize: '0.8125rem',
                },
                notchedOutline: {
                    borderColor: tokens.color.border,
                },
            },
        },
        MuiInputBase: {
            styleOverrides: {
                root: {
                    fontSize: '0.875rem',
                },
                input: {
                    '&::placeholder': {
                        color: tokens.color.inkSubtle,
                        opacity: 1,
                    },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    fontSize: '0.8125rem',
                    color: tokens.color.inkMuted,
                },
            },
        },
        MuiFormHelperText: {
            styleOverrides: {
                root: {
                    marginLeft: 0,
                    fontSize: '0.75rem',
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    minHeight: 36,
                    margin: '2px 4px',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                    '&.Mui-selected': {
                        backgroundColor: tokens.color.accentSoft,
                        color: tokens.color.accent,
                        '&:hover': {
                            backgroundColor: '#DBEAFE',
                        },
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
                rounded: {
                    borderRadius: tokens.radius.panel,
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: tokens.color.surface,
                    color: tokens.color.ink,
                    boxShadow: 'none',
                },
            },
        },
        MuiDivider: {
            styleOverrides: {
                root: {
                    borderColor: tokens.color.border,
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    padding: '8px 12px',
                    borderBottom: `1px solid ${tokens.color.border}`,
                    fontSize: '0.8125rem',
                    lineHeight: 1.45,
                    fontVariantNumeric: 'tabular-nums',
                },
                head: {
                    backgroundColor: tokens.color.surfaceSubtle,
                    borderBottom: `1px solid ${tokens.color.border}`,
                    color: tokens.color.inkMuted,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                },
                body: {
                    color: tokens.color.ink,
                },
            },
        },
        MuiToggleButtonGroup: {
            styleOverrides: {
                root: {
                    borderRadius: tokens.radius.field,
                    border: `1px solid ${tokens.color.border}`,
                    backgroundColor: tokens.color.surfaceSubtle,
                },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: {
                    border: 0,
                    borderRadius: 6,
                    color: tokens.color.inkMuted,
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    textTransform: 'none',
                    '&.Mui-selected': {
                        backgroundColor: tokens.color.surface,
                        color: tokens.color.accent,
                        '&:hover': {
                            backgroundColor: tokens.color.surface,
                        },
                    },
                },
            },
        },
        MuiAlert: {
            styleOverrides: {
                root: {
                    borderRadius: tokens.radius.field,
                    alignItems: 'center',
                    fontSize: '0.8125rem',
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: tokens.radius.panel,
                    border: `1px solid ${tokens.color.border}`,
                    backgroundImage: 'none',
                    boxShadow: tokens.shadow.lg,
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    fontSize: '1.125rem',
                    fontWeight: 600,
                },
            },
        },
        MuiMenu: {
            styleOverrides: {
                paper: {
                    marginTop: 4,
                    borderRadius: 10,
                    border: `1px solid ${tokens.color.border}`,
                    boxShadow: tokens.shadow.md,
                },
            },
        },
        MuiPopover: {
            styleOverrides: {
                paper: {
                    borderRadius: 10,
                    border: `1px solid ${tokens.color.border}`,
                    backgroundImage: 'none',
                    boxShadow: tokens.shadow.md,
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    padding: '6px 8px',
                    borderRadius: 6,
                    backgroundColor: tokens.color.ink,
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    height: 24,
                    borderRadius: 6,
                    fontSize: '0.75rem',
                },
            },
        },
        MuiLink: {
            styleOverrides: {
                root: {
                    color: tokens.color.accent,
                    textDecoration: 'none',
                    '&:hover': {
                        textDecoration: 'underline',
                    },
                },
            },
        },
    },
});

export default theme;

