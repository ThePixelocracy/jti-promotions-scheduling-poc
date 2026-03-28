import { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useAuth, authHeaders } from "../context/AuthContext";
import JtiLogo from "../components/JtiLogo";
import CreateScheduleDialog from "../components/CreateScheduleDialog";

const STATUS_CHIP = {
  Draft: { label: "Draft", color: "default" },
  Published: { label: "Published", color: "success" },
  Archived: { label: "Archived", color: "warning" },
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("el-GR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function HomePage() {
  const { user, logout } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetch("/api/schedules/", { headers: authHeaders() })
      .then((res) => {
        if (res.status === 401) {
          logout();
          return;
        }
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then((data) => {
        if (data) setSchedules(data);
      })
      .catch(() => setError("Could not load schedules."))
      .finally(() => setLoading(false));
  }, [logout]);

  function handleScheduleCreated(newSchedule) {
    setSchedules((prev) => [newSchedule, ...prev]);
    setDialogOpen(false);
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ gap: 2 }}>
          <JtiLogo size={28} />
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {user?.username}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            color="inherit"
            onClick={logout}
            sx={{ borderColor: "divider", fontSize: "0.8rem" }}
          >
            Sign out
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 5 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Typography variant="h5" fontWeight={300} letterSpacing="0.02em">
            Schedules
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            disabled={loading}
          >
            Create schedule draft
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
            <CircularProgress color="inherit" size={32} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>POS</TableCell>
                  <TableCell>Promoters</TableCell>
                  <TableCell>Created by</TableCell>
                  <TableCell>Created at</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schedules.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      align="center"
                      sx={{ py: 6, color: "text.secondary" }}
                    >
                      No schedules yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell>{s.name}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {formatDate(s.period_start)} – {formatDate(s.period_end)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={STATUS_CHIP[s.status]?.label ?? s.status}
                          color={STATUS_CHIP[s.status]?.color ?? "default"}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{s.pos_count}</TableCell>
                      <TableCell>{s.promoter_count}</TableCell>
                      <TableCell>{s.created_by}</TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>
                        {formatDate(s.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>

      <CreateScheduleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleScheduleCreated}
        existingSchedules={schedules}
      />
    </Box>
  );
}
