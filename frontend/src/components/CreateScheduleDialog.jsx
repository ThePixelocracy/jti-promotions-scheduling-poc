import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  InputAdornment,
  Paper,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { authHeaders } from "../context/AuthContext";

// ── helpers ────────────────────────────────────────────────────────────────

function getDefaultPeriod(schedules) {
  const covered = new Set(
    schedules.map((s) => s.period_start.slice(0, 7)) // "YYYY-MM"
  );
  const today = new Date();
  let candidate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  for (let i = 0; i < 24; i++) {
    const key = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}`;
    if (!covered.has(key)) break;
    candidate = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 1);
  }
  const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0);
  return {
    name: candidate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    periodStart: candidate.toISOString().slice(0, 10),
    periodEnd: lastDay.toISOString().slice(0, 10),
  };
}

// ── ChecklistField ──────────────────────────────────────────────────────────

function ChecklistField({ label, items, selected, onChange, getLabel, getId }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      items.filter((item) =>
        getLabel(item).toLowerCase().includes(search.toLowerCase())
      ),
    [items, search, getLabel]
  );

  const allFilteredSelected = filtered.every((item) =>
    selected.has(getId(item))
  );

  function toggleItem(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  }

  function toggleAll() {
    const next = new Set(selected);
    if (allFilteredSelected) {
      filtered.forEach((item) => next.delete(getId(item)));
    } else {
      filtered.forEach((item) => next.add(getId(item)));
    }
    onChange(next);
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
        }}
      >
        <Typography variant="body2" fontWeight={500}>
          {label}
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ ml: 1 }}
          >
            ({selected.size} / {items.length})
          </Typography>
        </Typography>
        <Button size="small" onClick={toggleAll} sx={{ fontSize: "0.75rem" }}>
          {allFilteredSelected ? "Deselect all" : "Select all"}
        </Button>
      </Box>

      <TextField
        size="small"
        fullWidth
        placeholder={`Search ${label.toLowerCase()}…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 1 }}
      />

      <Paper
        variant="outlined"
        sx={{ maxHeight: 260, overflowY: "auto", px: 1 }}
      >
        {filtered.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ py: 2, textAlign: "center" }}
          >
            No results
          </Typography>
        ) : (
          filtered.map((item) => (
            <FormControlLabel
              key={getId(item)}
              control={
                <Checkbox
                  size="small"
                  checked={selected.has(getId(item))}
                  onChange={() => toggleItem(getId(item))}
                />
              }
              label={
                <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
                  {getLabel(item)}
                </Typography>
              }
              sx={{ display: "flex", mx: 0, py: 0.25 }}
            />
          ))
        )}
      </Paper>
    </Box>
  );
}

// ── CreateScheduleDialog ────────────────────────────────────────────────────

const STEPS = ["Schedule Parameters", "Review (coming soon)"];

export default function CreateScheduleDialog({ open, onClose, onCreated, existingSchedules }) {
  const defaults = useMemo(
    () => getDefaultPeriod(existingSchedules),
    [existingSchedules]
  );

  const [name, setName] = useState(defaults.name);
  const [periodStart, setPeriodStart] = useState(defaults.periodStart);
  const [periodEnd, setPeriodEnd] = useState(defaults.periodEnd);

  const [posList, setPosList] = useState([]);
  const [promoterList, setPromoterList] = useState([]);
  const [selectedPos, setSelectedPos] = useState(new Set());
  const [selectedPromoters, setSelectedPromoters] = useState(new Set());

  const [loadingScope, setLoadingScope] = useState(true);
  const [scopeError, setScopeError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Reset form when dialog opens with fresh defaults
  useEffect(() => {
    if (!open) return;
    const d = getDefaultPeriod(existingSchedules);
    setName(d.name);
    setPeriodStart(d.periodStart);
    setPeriodEnd(d.periodEnd);
    setSubmitError(null);
  }, [open, existingSchedules]);

  // Load POS + Promoters once
  useEffect(() => {
    if (!open) return;
    setLoadingScope(true);
    setScopeError(null);

    Promise.all([
      fetch("/api/pos/", { headers: authHeaders() }).then((r) => r.json()),
      fetch("/api/promoters/", { headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([pos, promoters]) => {
        setPosList(pos);
        setPromoterList(promoters);
        setSelectedPos(new Set(pos.map((p) => p.id)));
        setSelectedPromoters(new Set(promoters.map((p) => p.id)));
      })
      .catch(() => setScopeError("Could not load POS and promoters."))
      .finally(() => setLoadingScope(false));
  }, [open]);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/schedules/", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name,
          period_start: periodStart,
          period_end: periodEnd,
          included_pos: [...selectedPos],
          included_promoters: [...selectedPromoters],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data?.non_field_errors?.[0] ||
          data?.name?.[0] ||
          data?.period_start?.[0] ||
          data?.period_end?.[0] ||
          "Failed to create schedule.";
        setSubmitError(msg);
        return;
      }
      onCreated(data);
    } catch {
      setSubmitError("Failed to create schedule.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Create Schedule Draft</DialogTitle>

      <Divider />

      <Box sx={{ px: 3, pt: 2.5 }}>
        <Stepper activeStep={0} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent sx={{ pt: 3 }}>
        {submitError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {submitError}
          </Alert>
        )}

        {/* Period section */}
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ display: "block", mb: 1.5 }}
        >
          Period
        </Typography>

        <TextField
          label="Schedule name"
          fullWidth
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
          <TextField
            label="Start date"
            type="date"
            required
            fullWidth
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="End date"
            type="date"
            required
            fullWidth
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Scope section */}
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ display: "block", mb: 2 }}
        >
          Scope
        </Typography>

        {loadingScope ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} color="inherit" />
          </Box>
        ) : scopeError ? (
          <Alert severity="error">{scopeError}</Alert>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
            <ChecklistField
              label="Points of Sale"
              items={posList}
              selected={selectedPos}
              onChange={setSelectedPos}
              getId={(p) => p.id}
              getLabel={(p) => `${p.cdb_code} – ${p.name}`}
            />
            <ChecklistField
              label="Promoters"
              items={promoterList}
              selected={selectedPromoters}
              onChange={setSelectedPromoters}
              getId={(p) => p.id}
              getLabel={(p) => `${p.first_name} ${p.last_name} (${p.programme_type})`}
            />
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || loadingScope || !name || !periodStart || !periodEnd}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {submitting ? "Creating…" : "Create Draft"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
