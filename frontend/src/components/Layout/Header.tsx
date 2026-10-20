// frontend/src/components/Layout/Header.tsx
import type { ReactNode } from 'react';
import { AppBar, Box, Toolbar, Typography } from '@mui/material';
import { tokens } from '../../theme';

interface HeaderProps {
    /** Дополнительные элементы справа от заголовка (например, переключатель вида). */
    actions?: ReactNode;
}

export const Header = ({ actions }: HeaderProps) => {
    return (
        <AppBar
            position="static"
            sx={{
                height: '64px',
                backgroundColor: tokens.color.surface,
                color: tokens.color.ink,
                boxShadow: tokens.shadow.sm,
                justifyContent: 'center',
                padding: '0 24px',
            }}
        >
            <Toolbar
                disableGutters
                sx={{
                    minHeight: '64px !important',
                    padding: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                {/* Заголовок слева */}
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 600,
                        color: tokens.color.ink,
                        fontSize: '1.125rem',
                        letterSpacing: '-0.01em',
                    }}
                >
                    Расчет заказа
                </Typography>

                {/* Действия справа */}
                {actions && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {actions}
                    </Box>
                )}
            </Toolbar>
        </AppBar>
    );
};