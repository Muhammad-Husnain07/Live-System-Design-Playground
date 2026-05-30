import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground {
    elevated: string;
  }
  interface Palette {
    borderColor: Palette['primary'];
  }
  interface PaletteOptions {
    borderColor?: PaletteOptions['primary'];
  }
}

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#09090b',
      paper: '#18181b',
      elevated: '#27272a',
    },
    divider: '#3f3f46',
    borderColor: {
      main: '#3f3f46',
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
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
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
