import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import muiTheme from "./muiTheme";

export default function App() {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
