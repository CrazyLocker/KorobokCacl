// frontend/src/components/NotificationSnackbar.tsx
import { Snackbar, Alert } from '@mui/material';

interface NotificationSnackbarProps {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
    onClose: () => void;
}

export const NotificationSnackbar = ({ open, message, severity, onClose }: NotificationSnackbarProps) => {
    return (
        <Snackbar
            open={open}
            autoHideDuration={3000}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
            <Alert onClose={onClose} severity={severity} sx={{ width: '100%' }}>
                {message}
            </Alert>
        </Snackbar>
    );
};
