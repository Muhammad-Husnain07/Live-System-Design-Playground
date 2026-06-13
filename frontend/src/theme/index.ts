import { createTheme } from "@mui/material/styles";
import { tokens } from "./tokens";

declare module "@mui/material/styles" {
  interface TypeBackground {
    elevated: string;
    hover: string;
  }
  interface Palette {
    borderColor: Palette["primary"];
  }
  interface PaletteOptions {
    borderColor?: PaletteOptions["primary"];
  }
}

const { bg, border, text, accent } = tokens;

const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: bg.canvas,
      paper: bg.panel,
      elevated: bg.subtle,
      hover: bg.hover,
    },
    divider: border.default,
    borderColor: {
      main: border.default,
    },
    primary: {
      main: accent.primary,
    },
    success: {
      main: accent.success,
    },
    warning: {
      main: accent.warning,
    },
    error: {
      main: accent.error,
    },
    text: {
      primary: text.primary,
      secondary: text.secondary,
    },
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    fontFamilyMonospace:
      '"JetBrains Mono", "SFMono-Regular", "Consolas", monospace',
    fontWeightRegular: 500,
    fontWeightMedium: 600,
    fontWeightBold: 700,
  },
  components: {
    MuiButton: {
      defaultProps: {
        variant: "contained",
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 6,
        },
        outlined: {
          borderColor: border.default,
          "&:hover": {
            borderColor: border.strong,
            backgroundColor: bg.hover,
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: bg.panel,
          borderColor: border.default,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        size: "small",
        InputLabelProps: {
          shrink: true,
        },
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            "& fieldset": {
              borderColor: border.default,
            },
            "&:hover fieldset": {
              borderColor: border.strong,
            },
            "&.Mui-focused fieldset": {
              borderColor: accent.primary,
            },
          },
          "& .MuiInputLabel-root": {
            color: text.secondary,
          },
          "& .MuiInputLabel-root.Mui-focused": {
            color: accent.primary,
          },
        },
      },
    },
    MuiTabs: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          textTransform: "none",
        },
        indicator: {
          backgroundColor: accent.primary,
        },
      },
    },
    MuiTab: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
        },
      },
    },
  },
});

export default theme;
