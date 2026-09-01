// frontend/src/components/NewApp/ImportDataBlock.tsx
import { Box, Chip, Typography } from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';

interface Props {
    onImportConstructs: () => void;
    onImportPrice: () => void;
    onImportPrint: () => void;
}

export const ImportDataBlock = ({ onImportConstructs, onImportPrice, onImportPrint }: Props) => {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mb: 2,
                flexWrap: 'wrap',
            }}
        >
            <Typography sx={{ fontSize: '14px', color: '#5f6368' }}>
                Импорт данных:
            </Typography>
            <Chip
                icon={<FileUploadIcon sx={{ fontSize: 16 }} />}
                label="Коробки"
                onClick={onImportConstructs}
                sx={{
                    fontSize: '12px',
                    height: '28px',
                    border: '1px solid #e37400',
                    color: '#e37400',
                    backgroundColor: '#fff8e1',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#ffecb3' },
                }}
            />
            <Chip
                icon={<FileUploadIcon sx={{ fontSize: 16 }} />}
                label="Прайс коробки"
                onClick={onImportPrice}
                sx={{
                    fontSize: '12px',
                    height: '28px',
                    border: '1px solid #e37400',
                    color: '#e37400',
                    backgroundColor: '#fff8e1',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#ffecb3' },
                }}
            />
            <Chip
                icon={<FileUploadIcon sx={{ fontSize: 16 }} />}
                label="Прайс печати"
                onClick={onImportPrint}
                sx={{
                    fontSize: '12px',
                    height: '28px',
                    border: '1px solid #e37400',
                    color: '#e37400',
                    backgroundColor: '#fff8e1',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#ffecb3' },
                }}
            />
            <Typography sx={{ fontSize: '13px', color: '#137333', fontWeight: 500, ml: 'auto' }}>
                Загружено
            </Typography>
        </Box>
    );
};
