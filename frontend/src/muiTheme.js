import { createTheme } from "@mui/material/styles";

const muiTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#141414",
      paper: "#1e1e1e",
    },
    primary: {
      main: "#ffffff",
      contrastText: "#141414",
    },
    text: {
      primary: "#ffffff",
      secondary: "#aaaaaa",
    },
    divider: "#2e2e2e",
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#0f0f0f",
          backgroundImage: "none",
          borderBottom: "1px solid #2e2e2e",
          boxShadow: "none",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: "#2e2e2e",
        },
        head: {
          color: "#aaaaaa",
          fontWeight: 500,
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontSize: "0.7rem",
          height: 22,
        },
      },
    },
  },
});

export default muiTheme;
