import { createTheme } from "@mui/material";

export const newStoreAdminColors = {
  bg: "#050706",
  surface: "#0D100E",
  surfaceAlt: "#121612",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(103,194,58,0.45)",
  text: "#F5F7F5",
  muted: "rgba(245,247,245,0.72)",
  green: "#67C23A",
  greenStrong: "#7CFF6B",
};

export function createNewStoreAdminTheme(extra = {}) {
  return createTheme({
    palette: {
      mode: "dark",
      primary: { main: newStoreAdminColors.green, contrastText: "#061006" },
      success: { main: newStoreAdminColors.greenStrong },
      warning: { main: "#D6A100" },
      error: { main: "#EF6F6C" },
      info: { main: "#7DB7FF" },
      background: {
        default: newStoreAdminColors.bg,
        paper: newStoreAdminColors.surface,
      },
      text: {
        primary: newStoreAdminColors.text,
        secondary: newStoreAdminColors.muted,
      },
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
      h5: { letterSpacing: 0, fontWeight: 900 },
      subtitle1: { letterSpacing: 0 },
      button: { letterSpacing: 0, fontWeight: 800, textTransform: "none" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: newStoreAdminColors.bg,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: "#080A09",
            borderBottom: `1px solid ${newStoreAdminColors.border}`,
            boxShadow: "0 12px 28px rgba(0,0,0,0.22)",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            borderColor: newStoreAdminColors.border,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 52,
            padding: 4,
            borderRadius: 14,
            backgroundColor: "#090C0A",
          },
          indicator: {
            display: "none",
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 11,
            margin: 3,
            paddingInline: 16,
            color: "rgba(245,247,245,0.66)",
            border: "1px solid transparent",
            fontWeight: 800,
            textTransform: "none",
            transition: "background-color 140ms ease, border-color 140ms ease, color 140ms ease",
            "&:hover": {
              color: newStoreAdminColors.text,
              backgroundColor: "rgba(103,194,58,0.08)",
              borderColor: "rgba(103,194,58,0.22)",
            },
            "&.Mui-selected": {
              color: newStoreAdminColors.greenStrong,
              backgroundColor: "rgba(103,194,58,0.13)",
              borderColor: newStoreAdminColors.borderStrong,
            },
            "&.Mui-focusVisible": {
              outline: `2px solid ${newStoreAdminColors.green}`,
              outlineOffset: 2,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            boxShadow: "none",
            textTransform: "none",
            fontWeight: 800,
          },
          containedPrimary: {
            backgroundColor: newStoreAdminColors.green,
            color: "#061006",
            "&:hover": {
              backgroundColor: newStoreAdminColors.greenStrong,
              boxShadow: "0 0 0 1px rgba(124,255,107,0.24)",
            },
          },
          outlined: {
            borderColor: "rgba(103,194,58,0.40)",
            color: newStoreAdminColors.text,
            "&:hover": {
              borderColor: newStoreAdminColors.green,
              backgroundColor: "rgba(103,194,58,0.08)",
            },
          },
          text: {
            color: newStoreAdminColors.greenStrong,
            "&:hover": {
              backgroundColor: "rgba(103,194,58,0.08)",
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: "#080B09",
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(255,255,255,0.14)",
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(103,194,58,0.55)",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: newStoreAdminColors.green,
              borderWidth: 1,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: "rgba(245,247,245,0.68)",
            "&.Mui-focused": { color: newStoreAdminColors.greenStrong },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            backgroundColor: "#0A0E0B",
            color: "rgba(245,247,245,0.82)",
            borderBottomColor: "rgba(103,194,58,0.26)",
            fontWeight: 900,
          },
          body: {
            borderBottomColor: "rgba(255,255,255,0.08)",
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&.MuiTableRow-hover:hover": {
              backgroundColor: "rgba(103,194,58,0.06)",
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 800,
          },
        },
      },
    },
    ...extra,
  });
}

export const adminTabsPaperSx = {
  borderRadius: 3,
  mb: 2,
  p: 0.5,
  bgcolor: newStoreAdminColors.surface,
  borderColor: "rgba(103,194,58,0.22)",
};

export const adminPanelPaperSx = {
  bgcolor: newStoreAdminColors.surface,
  borderColor: newStoreAdminColors.border,
  boxShadow: "0 14px 36px rgba(0,0,0,0.24)",
};
