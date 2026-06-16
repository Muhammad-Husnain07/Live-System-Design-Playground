import { createTheme } from "@mui/material/styles";
import { spatialTokens } from "./spatialTokens";

declare module "@mui/material/styles" {
  interface TypeBackground {
    elevated: string;
    hover: string;
  }
  interface TypeText {
    placeholder: string;
  }
  interface Palette {
    borderColor: Palette["primary"];
  }
  interface PaletteOptions {
    borderColor?: PaletteOptions["primary"];
  }
}

const { bg, text, accent } = spatialTokens;

const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: bg.void,
      paper: bg.island,
      elevated: "rgba(30, 30, 36, 0.90)",
      hover: "rgba(255, 255, 255, 0.06)",
    },
    divider: "rgba(255, 255, 255, 0.08)",
    borderColor: {
      main: "rgba(255, 255, 255, 0.08)",
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
      placeholder: text.placeholder,
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: spatialTokens.font.ui,
    fontWeightRegular: 500,
    fontWeightMedium: 600,
    fontWeightBold: 700,
  },
});

export default theme;
