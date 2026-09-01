// frontend/src/components/Layout/Header.tsx
import { AppBar, Toolbar, Typography } from '@mui/material';

export const Header = () => {
    return (
        <AppBar
            position="static"
            sx={{
                height: '64px',
                backgroundColor: '#fff',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
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
                        color: '#1a73e8',
                        fontSize: '18px',
                        letterSpacing: '0.02em',
                    }}
                >
                    Расчет заказа
                </Typography>
            </Toolbar>
        </AppBar>
    );
};