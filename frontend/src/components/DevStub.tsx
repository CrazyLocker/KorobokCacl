// frontend/src/components/DevStub.tsx
import { Box, Paper, Typography } from '@mui/material';

interface Props {
    title: string;
}

export const DevStub = ({ title }: Props) => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <Paper
                elevation={0}
                sx={{
                    p: 6,
                    borderRadius: 3,
                    border: '2px dashed #e8eaed',
                    textAlign: 'center',
                }}
            >
                <Typography variant="h5" sx={{ fontWeight: 500, mb: 1, color: '#202124' }}>
                    {title}
                </Typography>
                <Typography variant="body2" sx={{ color: '#9aa0a6' }}>
                    Раздел в разработке
                </Typography>
            </Paper>
        </Box>
    );
};
