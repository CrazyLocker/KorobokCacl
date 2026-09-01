// frontend/src/components/NewApp.tsx
import { Box, Typography, Paper } from '@mui/material';

/**
 * Новый UI — заглушка.
 * Здесь будет размещён обновлённый интерфейс приложения.
 */
export const NewApp = () => {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                gap: 2,
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    p: 6,
                    borderRadius: 3,
                    border: '2px dashed #e8eaed',
                    textAlign: 'center',
                }}
            >
                <Typography variant="h5" sx={{ fontWeight: 500, mb: 1 }}>
                    Новый интерфейс
                </Typography>
                <Typography variant="body2" sx={{ color: '#9aa0a6' }}>
                    Здесь будет размещён обновлённый дизайн приложения.
                </Typography>
            </Paper>
        </Box>
    );
};
