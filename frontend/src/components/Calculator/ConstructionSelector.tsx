// frontend/src/components/Calculator/ConstructionSelector.tsx
import { Select, MenuItem, FormControl, Box, Typography } from '@mui/material';
import type { Construct } from '../../types';

interface Props {
    constructs: Construct[];
    value: string;
    onChange: (name: string) => void;
    additionalConstruct?: Construct;
}

export const ConstructionSelector = ({ constructs, value, onChange, additionalConstruct }: Props) => {
    const allConstructs = additionalConstruct ? [additionalConstruct, ...constructs] : constructs;
    
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
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#5f6368',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                }}
            >
                Базовая коробка
            </Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    displayEmpty
                    sx={{
                        fontSize: '12px',
                        backgroundColor: '#fff',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#dadce0' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1a73e8' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1a73e8', borderWidth: '2px' },
                    }}
                >
                    {allConstructs.map((c) => (
                        <MenuItem key={c.id} value={c.name} sx={{ fontSize: '12px' }}>
                            {c.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <Typography sx={{ fontSize: '11px', color: '#9aa0a6' }}>
                выберите конструкцию, и раскладка деталей обновится
            </Typography>
        </Box>
    );
};
