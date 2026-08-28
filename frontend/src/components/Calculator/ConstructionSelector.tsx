// frontend/src/components/Calculator/ConstructionSelector.tsx
import { Select, MenuItem, FormControl, Box, Typography } from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';
import type { Construct } from '../../types';

interface Props {
    constructs: Construct[];
    value: string;
    onChange: (name: string) => void;
}

export const ConstructionSelector = ({ constructs, value, onChange }: Props) => {
    return (
        <Box
            sx={{
                backgroundColor: '#f8f9fa',
                borderRadius: '12px',
                padding: '16px 24px',
                marginBottom: '28px',
                border: '1px solid #e8eaed',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
            }}
        >
            <Typography
                sx={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#5f6368',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                }}
            >
                <LayersIcon sx={{ fontSize: 20, color: '#1a73e8' }} />
                Базовая коробка
            </Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    displayEmpty
                    sx={{
                        fontSize: '14px',
                        backgroundColor: '#fff',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#dadce0' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1a73e8' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1a73e8', borderWidth: '2px' },
                    }}
                >
                    {constructs.map((c) => (
                        <MenuItem key={c.id} value={c.name}>
                            {c.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <Typography sx={{ fontSize: '13px', color: '#9aa0a6' }}>
                выберите конструкцию, и раскладка деталей обновится
            </Typography>
        </Box>
    );
};
