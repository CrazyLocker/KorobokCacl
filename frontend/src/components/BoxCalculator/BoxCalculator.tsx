// frontend/src/components/BoxCalculator/BoxCalculator.tsx
import React, { useState } from 'react';
import {
    Box,
    Typography,
    Select,
    MenuItem,
    Button,
    FormControl,
    InputLabel,
    Divider,
    Paper,
    Stack
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

// Типы для деталей и конструкций
interface Part {
    id: string;
    name: string;
}

interface Construct {
    id: string;
    name: string;
    parts: Part[];
}

// Временные данные (потом будут из БД)
const mockConstructs: Construct[] = [
    {
        id: '1',
        name: 'Крышка-дно Паллена 6',
        parts: [{ id: 'p1', name: 'Дно' }, { id: 'p2', name: 'Крышка' }]
    },
    {
        id: '2',
        name: 'Пенал',
        parts: [{ id: 'p3', name: 'Основа' }, { id: 'p4', name: 'Крышка' }]
    }
];

export const BoxCalculator: React.FC = () => {
    // Состояния
    const [selectedConstruct, setSelectedConstruct] = useState<string>('');
    const [parts, setParts] = useState<Part[]>([{ id: '1', name: 'Деталь 1' }]);
    const [partCounter, setPartCounter] = useState<number>(2);

    // Выбранная конструкция
    const currentConstruct = mockConstructs.find(c => c.id === selectedConstruct);

    // Добавление детали
    const addPart = () => {
        const newPart = { id: String(partCounter), name: `Деталь ${partCounter}` };
        setParts([...parts, newPart]);
        setPartCounter(prev => prev + 1);
    };

    // Удаление детали (нельзя удалить первую)
    const removePart = (id: string) => {
        if (parts.length <= 1) return;
        setParts(parts.filter(p => p.id !== id));
    };

    return (
        <Paper elevation={0} sx={{ p: 3, maxWidth: 800, mx: 'auto', mt: 4 }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                Конструктор коробок
            </Typography>

            {/* Вид коробки */}
            <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Вид коробки</InputLabel>
                <Select
                    value={selectedConstruct}
                    onChange={(e) => setSelectedConstruct(e.target.value)}
                    label="Вид коробки"
                >
                    {mockConstructs.map((c) => (
                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            {/* Список деталей */}
            <Stack spacing={2} sx={{ mb: 2 }}>
                {parts.map((part, index) => (
                    <Box key={part.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>{part.name}</InputLabel>
                            <Select
                                value=""
                                label={part.name}
                                disabled={!selectedConstruct}
                            >
                                {currentConstruct?.parts.map((p) => (
                                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {index > 0 && (
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={() => removePart(part.id)}
                                startIcon={<DeleteIcon />}
                                sx={{ minWidth: 'auto', px: 2 }}
                            >
                                Удалить
                            </Button>
                        )}
                    </Box>
                ))}
            </Stack>

            {/* Кнопка + Деталь */}
            <Button
                variant="text"
                startIcon={<AddIcon />}
                onClick={addPart}
                sx={{ mb: 3 }}
            >
                + Деталь
            </Button>

            <Divider sx={{ my: 3 }} />

            {/* Блок результата (заглушка) */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button variant="outlined">Сохранить</Button>
                <Button variant="contained" disabled={!selectedConstruct}>
                    Рассчитать
                </Button>
            </Box>
        </Paper>
    );
};