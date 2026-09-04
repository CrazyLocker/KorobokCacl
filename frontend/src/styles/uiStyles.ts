// frontend/src/styles/uiStyles.ts
// Единые стили UI-элементов по образцу экрана «Расчет коробки»:
// - Select — по образцу выпадашки «Базовая коробка» (NewApp)
// - числовые поля — по образцу поля «Работа/деталь» (CostBlock)
import type { SxProps, Theme } from '@mui/material';

/** Общий стиль для всех выпадающих списков (Select) */
export const selectSx: SxProps<Theme> = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    '& .MuiSelect-select': {
        fontSize: '14px',
        py: 0.75,
    },
    '& .MuiOutlinedInput-notchedOutline': {
        borderColor: '#dadce0',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: '#1a73e8',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#1a73e8',
        borderWidth: '2px',
    },
};

/** Общий стиль для пунктов выпадающих списков (MenuItem) */
export const menuItemSx: SxProps<Theme> = {
    fontSize: '14px',
};

/** Общий стиль для числовых полей ввода (TextField) */
export const numberInputSx: SxProps<Theme> = {
    '& .MuiOutlinedInput-root': {
        borderRadius: '6px',
        backgroundColor: '#fff',
        fontSize: '12px',
    },
};

/** Общие inputProps для числовых полей ввода (TextField) */
export const numberInputProps = (step: number | string = 1) => ({
    step,
    min: 0,
    style: { textAlign: 'center', fontSize: '12px', padding: '4px 6px' } as React.CSSProperties,
});
