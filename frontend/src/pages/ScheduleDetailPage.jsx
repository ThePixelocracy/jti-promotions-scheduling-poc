import { useEffect, useMemo, useRef, useState } from "react";
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
  IconButton,
  Paper,
  Popover,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useAuth, authHeaders } from "../context/AuthContext";
import JtiLogo from "../components/JtiLogo";

const STATUS_CHIP = {
  Draft: { label: "Draft", color: "default" },
  Published: { label: "Published", color: "success" },
  Archived: { label: "Archived", color: "warning" },
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const GENERATING_MESSAGES = [
  "Analysing peak hours across all Points of Sale…",
  "Matching promoters to their strongest territories…",
  "Calculating optimal visit frequencies for Strategic POS…",
  "Checking morning and afternoon slot availability…",
  "Routing SOUTH TEAM promoters through Athens…",
  "Balancing workload — 2 visits per day, 5 days per week…",
  "Finding the best Saturday and Sunday coverage for the month…",
  "Scoring visit windows by historical sales performance…",
  "Resolving promoter–POS region assignments…",
  "Optimising visit spread to avoid clustering in one week…",
  "Cross-referencing Permanent and Exclusive programme types…",
  "Checking for time-slot conflicts across the promoter roster…",
  "Prioritising Strategic POS for peak-hour slots…",
  "Applying user constraints to the candidate schedule…",
  "Computing optimization score for each candidate visit…",
];

function GeneratingPlaceholder() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIndex((i) => (i + 1) % GENERATING_MESSAGES.length);
        setVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 340,
        gap: 4,
      }}
    >
      <Box sx={{ display: "flex", gap: 1.25 }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: "primary.main",
              opacity: 0.85,
              "@keyframes bounce": {
                "0%, 80%, 100%": { transform: "translateY(0)", opacity: 0.3 },
                "40%": { transform: "translateY(-10px)", opacity: 1 },
              },
              animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
            }}
          />
        ))}
      </Box>

      <Box sx={{ textAlign: "center", minHeight: 48, px: 4 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            transition: "opacity 0.4s ease",
            opacity: visible ? 1 : 0,
            fontStyle: "italic",
            letterSpacing: 0.2,
          }}
        >
          {GENERATING_MESSAGES[msgIndex]}
        </Typography>
      </Box>

      <Box sx={{ width: "60%", maxWidth: 420 }}>
        {[1, 0.6, 0.35].map((w, i) => (
          <Box
            key={i}
            sx={{
              height: 6,
              borderRadius: 3,
              mb: 1,
              width: `${w * 100}%`,
              bgcolor: "action.selected",
              overflow: "hidden",
              position: "relative",
              "&::after": {
                content: '""',
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)",
                "@keyframes shimmer": {
                  "0%": { transform: "translateX(-100%)" },
                  "100%": { transform: "translateX(100%)" },
                },
                animation: `shimmer 1.8s ease-in-out ${i * 0.3}s infinite`,
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

function ThinkingPanel({ text, stalled }) {
  const scrollBoxRef = useRef(null);
  const [stallMsgIndex, setStallMsgIndex] = useState(() =>
    Math.floor(Math.random() * GENERATING_MESSAGES.length)
  );
  const [stallVisible, setStallVisible] = useState(true);

  useEffect(() => {
    if (scrollBoxRef.current) {
      scrollBoxRef.current.scrollTop = scrollBoxRef.current.scrollHeight;
    }
  }, [text]);

  useEffect(() => {
    if (!stalled) return;
    setStallMsgIndex(Math.floor(Math.random() * GENERATING_MESSAGES.length));
    setStallVisible(true);
    const interval = setInterval(() => {
      setStallVisible(false);
      setTimeout(() => {
        setStallMsgIndex((i) => (i + 1) % GENERATING_MESSAGES.length);
        setStallVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, [stalled]);

  return (
    <Box
      sx={{
        minHeight: 340,
        maxHeight: 520,
        display: "flex",
        flexDirection: "column",
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "action.hover",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", gap: 0.75 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: "primary.main",
                opacity: 0.7,
                "@keyframes pulse": {
                  "0%, 100%": { opacity: 0.2, transform: "scale(0.85)" },
                  "50%": { opacity: 1, transform: "scale(1)" },
                },
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: "text.disabled",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Thinking
        </Typography>
      </Box>

      <Box ref={scrollBoxRef} sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2 }}>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", lineHeight: 1.75, whiteSpace: "pre-wrap" }}
        >
          {text}
          <Box
            component="span"
            sx={{
              display: "inline-block",
              width: "2px",
              height: "0.9em",
              bgcolor: "primary.main",
              ml: "2px",
              verticalAlign: "text-bottom",
              "@keyframes blink": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0 },
              },
              animation: "blink 1s step-end infinite",
            }}
          />
        </Typography>
        {stalled && (
          <Typography
            variant="body2"
            sx={{
              mt: 1.5,
              fontStyle: "italic",
              color: "text.disabled",
              transition: "opacity 0.4s ease",
              opacity: stallVisible ? 1 : 0,
              letterSpacing: 0.2,
            }}
          >
            {GENERATING_MESSAGES[stallMsgIndex]}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

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
  const [aiScore, setAiScore] = useState(null);
  const [tokenUsage, setTokenUsage] = useState(null);
  const [thinkingText, setThinkingText] = useState("");
  const [thinkingStalled, setThinkingStalled] = useState(false);
  const stallTimerRef = useRef(null);
  const generatingPanelRef = useRef(null);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const importInputRef = useRef(null);

  const [selectedWeek, setSelectedWeek] = useState(null);
  const [filterPos, setFilterPos] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterPromoter, setFilterPromoter] = useState("");

  // Reason popover
  const [popoverAnchor, setPopoverAnchor] = useState(null);
  const [popoverText, setPopoverText] = useState("");

  const weekLabels = useMemo(
    () => [...new Set(visits.map((v) => v.week_label))].filter(Boolean).sort(),
    [visits]
  );

  // Auto-select first week whenever the visits list changes
  useEffect(() => {
    setSelectedWeek(weekLabels[0] ?? null);
  }, [weekLabels]);

  const filteredVisits = useMemo(() => {
    const pos = filterPos.toLowerCase();
    const city = filterCity.toLowerCase();
    const promoter = filterPromoter.toLowerCase();
    return visits.filter((v) => {
      if (selectedWeek && v.week_label !== selectedWeek) return false;
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
  }, [visits, selectedWeek, filterPos, filterCity, filterPromoter]);

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

  useEffect(() => {
    if (generating) {
      generatingPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [generating]);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    setAiSummary(null);
    setAiScore(null);
    setTokenUsage(null);
    setThinkingText("");
    setThinkingStalled(false);
    clearTimeout(stallTimerRef.current);

    try {
      const res = await fetch(`/api/schedules/${id}/generate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...authHeaders(),
        },
        body: JSON.stringify({
          optimization_goal: optimizationGoal,
          user_prompt: userPrompt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setGenError(data.error || "Generation failed.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop();

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            console.debug("[SSE]", event.type, event);
            if (event.type === "thinking") {
              setThinkingText((prev) => prev + event.delta);
              setThinkingStalled(false);
              clearTimeout(stallTimerRef.current);
              stallTimerRef.current = setTimeout(() => setThinkingStalled(true), 7500);
            } else if (event.type === "done") {
              setVisits(event.visits);
              setAiSummary(event.summary);
              setAiScore(event.score ?? null);
              setTokenUsage(event.usage);
            } else if (event.type === "error") {
              setGenError(event.message || "Generation failed.");
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    } catch {
      setGenError("Could not reach the server.");
    } finally {
      clearTimeout(stallTimerRef.current);
      setThinkingStalled(false);
      setGenerating(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/schedules/${id}/publish/`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        setPublishError(data.error || "Could not publish schedule.");
        return;
      }
      const updated = await res.json();
      setSchedule(updated);
    } catch {
      setPublishError("Could not reach the server.");
    } finally {
      setPublishing(false);
    }
  }

  function handleExport() {
    const a = document.createElement("a");
    a.href = `/api/schedules/${id}/export/`;
    a.setAttribute("download", "");
    // Pass auth token via a query param is not ideal; use a form POST or
    // open in new tab — for a JWT-authenticated download we trigger a fetch
    // and create an object URL so the auth header is included.
    fetch(`/api/schedules/${id}/export/`, { headers: authHeaders() })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so re-selecting the same file triggers onChange again
    e.target.value = "";
    setImporting(true);
    setImportError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/schedules/${id}/import/`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || "Import failed.");
        return;
      }
      setVisits(data.visits);
      if (data.errors?.length) {
        setImportError(`Imported with ${data.errors.length} warning(s): ${data.errors[0]}`);
      }
    } catch {
      setImportError("Could not reach the server.");
    } finally {
      setImporting(false);
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
  const isDraft = schedule.status === "Draft";

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

          {/* Publish button — Draft only */}
          {schedule.status === "Draft" && (
            <Button
              variant="outlined"
              size="small"
              color="success"
              startIcon={publishing ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlineIcon fontSize="small" />}
              onClick={handlePublish}
              disabled={publishing}
              sx={{ ml: 1 }}
            >
              {publishing ? "Publishing…" : "Publish"}
            </Button>
          )}
          {publishError && (
            <Typography variant="caption" color="error">
              {publishError}
            </Typography>
          )}

          {/* Score — top right */}
          {(aiScore ?? schedule.score) != null && (
            <Box
              sx={{
                ml: "auto",
                display: "flex",
                alignItems: "baseline",
                gap: 0.75,
                px: 2,
                py: 0.75,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Score
              </Typography>
              <Tooltip title={`Based on: ${optimizationGoal}`}>
                <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1, cursor: "default" }}>
                  {(aiScore ?? schedule.score).toLocaleString()}
                </Typography>
              </Tooltip>
              <Typography variant="caption" color="text.secondary">
                pts
              </Typography>
            </Box>
          )}
        </Box>

        {/* Two-column layout */}
        <Box sx={{ display: "grid", gridTemplateColumns: isDraft ? "340px 1fr" : "1fr", gap: 3, alignItems: "start" }}>

          {/* ── Left: AI generation panel — Draft only ── */}
          {isDraft && <Paper variant="outlined" sx={{ p: 2.5, position: "sticky", top: 24 }}>
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
          </Paper>}

          {/* ── Right: thinking stream / placeholder / visit table ── */}
          <Box ref={generatingPanelRef}>
            {isDraft && generating && thinkingText ? (
              <ThinkingPanel text={thinkingText} stalled={thinkingStalled} />
            ) : isDraft && generating ? (
              <GeneratingPlaceholder />
            ) : (
              <>
                {/* Visit count + Export/Import actions */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {visits.length > 0
                      ? `${filteredVisits.length} of ${visits.length} visits`
                      : isDraft
                        ? "No visits yet — generate a schedule to get started"
                        : "No visits scheduled."}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<FileDownloadIcon fontSize="small" />}
                      onClick={handleExport}
                      disabled={visits.length === 0}
                    >
                      Export
                    </Button>
                    {isDraft && (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={importing ? <CircularProgress size={14} color="inherit" /> : <FileUploadIcon fontSize="small" />}
                          onClick={() => importInputRef.current?.click()}
                          disabled={importing}
                        >
                          {importing ? "Importing…" : "Import"}
                        </Button>
                        <input
                          ref={importInputRef}
                          type="file"
                          accept=".xlsx"
                          style={{ display: "none" }}
                          onChange={handleImport}
                        />
                      </>
                    )}
                  </Box>
                </Box>
                {isDraft && importError && (
                  <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setImportError(null)}>
                    {importError}
                  </Alert>
                )}

                {weekLabels.length > 0 && (
                  <Tabs
                    value={selectedWeek}
                    onChange={(_, v) => setSelectedWeek(v)}
                    sx={{ mb: 1.5, minHeight: 36 }}
                    TabIndicatorProps={{ sx: { height: 2 } }}
                  >
                    {weekLabels.map((w) => (
                      <Tab key={w} label={w} value={w} sx={{ minHeight: 36, py: 0.5, fontSize: "0.8rem" }} />
                    ))}
                  </Tabs>
                )}

                {visits.length > 0 && (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
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
                          <TableCell padding="checkbox" />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredVisits.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 3, color: "text.secondary" }}>
                              No visits match the current filters.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredVisits.map((v) => {
                            const d = new Date(v.date + "T00:00:00");
                            return (
                              <TableRow key={v.id} hover>
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
                                <TableCell padding="checkbox">
                                  {v.comments && (
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        setPopoverAnchor(e.currentTarget);
                                        setPopoverText(v.comments);
                                      }}
                                    >
                                      <InfoOutlinedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                                    </IconButton>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </Box>
        </Box>
      </Container>

      {/* Reason popover — shared across all rows */}
      <Popover
        open={Boolean(popoverAnchor)}
        anchorEl={popoverAnchor}
        onClose={() => setPopoverAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Box sx={{ p: 2, maxWidth: 340 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            AI reasoning
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            {popoverText}
          </Typography>
        </Box>
      </Popover>
    </Box>
  );
}
