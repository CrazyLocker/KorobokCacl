// frontend/src/components/NewApp/ImportExportBlock.tsx
import { Box, Button, Typography } from '@mui/material';

interface Props {
    onImport: () => void;
    onExport: () => void;
}

export const ImportExportBlock = ({ onImport, onExport }: Props) => {
    return (
        <Box
            sx={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #e8eaed',
                p: 2,
                mt: 2,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    flexWrap: 'wrap',
                }}
            >
                <Typography sx={{ fontSize: '14px', color: '#5f6368' }}>
                    Импорт/экспорт расчетов:
                </Typography>
                <Button
                    variant="outlined"
                    onClick={onImport}
                    sx={{
                        fontSize: '12px',
                        textTransform: 'none',
                        borderColor: '#e37400',
                        color: '#e37400',
                        borderRadius: '8px',
                        '&:hover': { backgroundColor: '#fff3e0', borderColor: '#e37400' },
                    }}
                >
                    Импорт
                </Button>
                <Button
                    variant="outlined"
                    onClick={onExport}
                    sx={{
                        fontSize: '12px',
                        textTransform: 'none',
                        borderColor: '#137333',
                        color: '#137333',
                        borderRadius: '8px',
                        '&:hover': { backgroundColor: '#e8f5e9', borderColor: '#137333' },
                    }}
                >
                    Экспорт
                </Button>
                <Typography sx={{ fontSize: '13px', color: '#137333', fontWeight: 500, ml: 'auto' }}>
                    Сохранено
                </Typography>
            </Box>
        </Box>
    );
};
