import { createTheme } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#18181b',
      paper: '#27272a',
    },
    primary: {
      main: '#22c55e',
    },
    error: {
      main: '#ef4444',
    },
    warning: {
      main: '#f97316',
    },
    text: {
      primary: '#f4f4f5',
      secondary: '#a1a1aa',
    },
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  },
  components: {
    MuiButton: {
      defaultProps: {
        variant: 'contained',
        disableElevation: true,
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
    },
  },
});

export default theme;
