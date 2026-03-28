import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useAuth, authHeaders } from "../context/AuthContext";
import JtiLogo from "../components/JtiLogo";

const STATUS_CHIP = {
  Draft: { label: "Draft", color: "default" },
  Published: { label: "Published", color: "success" },
  Archived: { label: "Archived", color: "warning" },
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("el-GR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ScheduleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [schedule, setSchedule] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [pageError, setPageError] = useState(null);

  const [optimizationGoal, setOptimizationGoal] = useState(
    "sales * 10 + interviews"
  );
  const [userPrompt, setUserPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [tokenUsage, setTokenUsage] = useState(null);

  const [filterPos, setFilterPos] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterPromoter, setFilterPromoter] = useState("");

  const filteredVisits = useMemo(() => {
    const pos = filterPos.toLowerCase();
    const city = filterCity.toLowerCase();
    const promoter = filterPromoter.toLowerCase();
    return visits.filter((v) => {
      if (pos && !v.pos?.name?.toLowerCase().includes(pos)) return false;
      if (city && !v.pos?.city?.toLowerCase().includes(city)) return false;
      if (promoter) {
        const full = v.promoter
          ? `${v.promoter.first_name} ${v.promoter.last_name}`.toLowerCase()
          : "";
        if (!full.includes(promoter)) return false;
      }
      return true;
    });
  }, [visits, filterPos, filterCity, filterPromoter]);

  useEffect(() => {
    const headers = authHeaders();

    Promise.all([
      fetch(`/api/schedules/${id}/`, { headers }),
      fetch(`/api/schedules/${id}/visits/`, { headers }),
    ])
      .then(async ([schedRes, visitsRes]) => {
        if (schedRes.status === 401 || visitsRes.status === 401) {
          logout();
          return;
        }
        if (!schedRes.ok) throw new Error("Schedule not found");
        const [schedData, visitsData] = await Promise.all([
          schedRes.json(),
          visitsRes.json(),
        ]);
        setSchedule(schedData);
        setVisits(visitsData);
      })
      .catch((e) => setPageError(e.message || "Could not load schedule."))
      .finally(() => setLoadingPage(false));
  }, [id, logout]);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    setAiSummary(null);
    setTokenUsage(null);

    try {
      const res = await fetch(`/api/schedules/${id}/generate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          optimization_goal: optimizationGoal,
          user_prompt: userPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error || "Generation failed.");
        return;
      }
      setVisits(data.visits);
      setAiSummary(data.summary);
      setTokenUsage(data.usage);
    } catch {
      setGenError("Could not reach the server.");
    } finally {
      setGenerating(false);
    }
  }

  if (loadingPage) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress color="inherit" />
      </Box>
    );
  }

  if (pageError) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: 4 }}>
        <Alert severity="error">{pageError}</Alert>
      </Box>
    );
  }

  const chip = STATUS_CHIP[schedule.status] ?? { label: schedule.status, color: "default" };

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

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        {/* Header row */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/")}
            color="inherit"
            size="small"
          >
            Schedules
          </Button>
          <Divider orientation="vertical" flexItem />
          <Typography variant="h6" fontWeight={300}>
            {schedule.name}
          </Typography>
          <Chip
            label={chip.label}
            color={chip.color}
            size="small"
            variant="outlined"
          />
          <Typography variant="body2" color="text.secondary">
            {formatDate(schedule.period_start)} – {formatDate(schedule.period_end)}
          </Typography>
        </Box>

        {/* Two-column layout */}
        <Box sx={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 3, alignItems: "start" }}>

          {/* ── Left: AI generation panel ── */}
          <Paper variant="outlined" sx={{ p: 2.5, position: "sticky", top: 24 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <AutoAwesomeIcon fontSize="small" sx={{ color: "text.secondary" }} />
              <Typography variant="subtitle2">AI Schedule Generation</Typography>
            </Box>

            <TextField
              label="Optimization goal"
              fullWidth
              size="small"
              value={optimizationGoal}
              onChange={(e) => setOptimizationGoal(e.target.value)}
              sx={{ mb: 2 }}
              helperText="Formula using sales and interviews"
            />

            <TextField
              label="Constraints / instructions"
              fullWidth
              multiline
              minRows={4}
              size="small"
              placeholder={"e.g. Maria X is not available April 3–7\nPrioritise kiosks near central Athens"}
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              sx={{ mb: 2 }}
            />

            <Button
              variant="contained"
              fullWidth
              onClick={handleGenerate}
              disabled={generating || !optimizationGoal.trim()}
              startIcon={
                generating ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <AutoAwesomeIcon fontSize="small" />
                )
              }
            >
              {generating ? "Generating…" : visits.length > 0 ? "Regenerate" : "Generate"}
            </Button>

            {genError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {genError}
              </Alert>
            )}

            {aiSummary && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  AI summary
                </Typography>
                <Typography variant="body2">{aiSummary}</Typography>
              </Box>
            )}

            {tokenUsage && (
              <Tooltip
                title={`Prompt: ${tokenUsage.prompt_tokens.toLocaleString()} · Completion: ${tokenUsage.completion_tokens.toLocaleString()}`}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 1.5, cursor: "default" }}
                >
                  {tokenUsage.total_tokens.toLocaleString()} tokens used
                </Typography>
              </Tooltip>
            )}
          </Paper>

          {/* ── Right: Visit table ── */}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {visits.length > 0
                  ? `${filteredVisits.length} of ${visits.length} visits`
                  : "No visits yet — generate a schedule to get started"}
              </Typography>
            </Box>

            {visits.length > 0 && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Week</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                          <span>POS</span>
                          <TextField
                            size="small"
                            placeholder="Filter…"
                            value={filterPos}
                            onChange={(e) => setFilterPos(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            sx={{ width: 130 }}
                            slotProps={{ input: { sx: { fontSize: "0.75rem", py: 0.25 } } }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                          <span>City</span>
                          <TextField
                            size="small"
                            placeholder="Filter…"
                            value={filterCity}
                            onChange={(e) => setFilterCity(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            sx={{ width: 110 }}
                            slotProps={{ input: { sx: { fontSize: "0.75rem", py: 0.25 } } }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                          <span>Promoter</span>
                          <TextField
                            size="small"
                            placeholder="Filter…"
                            value={filterPromoter}
                            onChange={(e) => setFilterPromoter(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            sx={{ width: 140 }}
                            slotProps={{ input: { sx: { fontSize: "0.75rem", py: 0.25 } } }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>Programme</TableCell>
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredVisits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 3, color: "text.secondary" }}>
                          No visits match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : filteredVisits.map((v) => {
                      const d = new Date(v.date + "T00:00:00");
                      return (
                        <TableRow key={v.id} hover>
                          <TableCell sx={{ color: "text.secondary" }}>
                            {v.week_label}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            {DAY_SHORT[d.getDay()]} {formatDate(v.date)}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            {v.start_time?.slice(0, 5)}–{v.end_time?.slice(0, 5)}
                          </TableCell>
                          <TableCell>
                            <Tooltip title={v.pos?.cdb_code ?? ""}>
                              <span>{v.pos?.name}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{v.pos?.city}</TableCell>
                          <TableCell>
                            {v.pos?.priority && (
                              <Chip
                                label={v.pos.priority}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: "0.65rem", height: 18 }}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {v.promoter
                              ? `${v.promoter.first_name} ${v.promoter.last_name}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={v.programme_type}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: "0.65rem", height: 18 }}
                            />
                          </TableCell>
                          <TableCell
                            sx={{
                              color: "text.secondary",
                              fontSize: "0.75rem",
                              maxWidth: 260,
                            }}
                          >
                            {v.comments}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
