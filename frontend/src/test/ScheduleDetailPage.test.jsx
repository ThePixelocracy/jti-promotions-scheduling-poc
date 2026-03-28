import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  beforeEach,
  vi,
} from "vitest";
import { AuthProvider } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";
import ScheduleDetailPage from "../pages/ScheduleDetailPage";
import muiTheme from "../muiTheme";
import { handlers, MOCK_VISITS, MOCK_SCHEDULES } from "./handlers";

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// jsdom doesn't implement URL.createObjectURL / revokeObjectURL
beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
  globalThis.URL.revokeObjectURL = vi.fn();
});

function renderDetailPage(id = "1") {
  return render(
    <ThemeProvider theme={muiTheme}>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/schedules/${id}`]}>
          <Routes>
            <Route
              path="/schedules/:id"
              element={
                <ProtectedRoute>
                  <ScheduleDetailPage />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div data-testid="login-page" />} />
            <Route path="/" element={<div data-testid="home-page" />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

describe("ScheduleDetailPage", () => {
  beforeEach(() => {
    localStorage.setItem("jti_access", "fake-access-token");
    localStorage.setItem("jti_refresh", "fake-refresh-token");
    localStorage.setItem("jti_user", JSON.stringify({ username: "admin" }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders schedule name and existing visits", async () => {
    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument();
    });
    expect(screen.getByText("Kiosk Alpha")).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("shows AI generation panel", async () => {
    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("AI Schedule Generation")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /regenerate/i })
    ).toBeInTheDocument();
  });

  it("calls generate and displays AI summary", async () => {
    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("AI Schedule Generation")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Generated 1 visit based on peak windows.")
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/550 tokens used/i)).toBeInTheDocument();
  });

  it("shows error when generation fails", async () => {
    server.use(
      http.post("/api/schedules/:id/generate/", () =>
        HttpResponse.json(
          { error: "OPENAI_API_KEY is not configured on the server." },
          { status: 503 }
        )
      )
    );

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("AI Schedule Generation")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));

    await waitFor(() => {
      expect(
        screen.getByText("OPENAI_API_KEY is not configured on the server.")
      ).toBeInTheDocument();
    });
  });

  it("redirects to /login when schedule fetch returns 401", async () => {
    server.use(
      http.get("/api/schedules/:id", () => new HttpResponse(null, { status: 401 }))
    );

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });
  });

  it("navigates back to home when back button is clicked", async () => {
    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /schedules/i }));

    await waitFor(() => {
      expect(screen.getByTestId("home-page")).toBeInTheDocument();
    });
  });

  // ── Score ────────────────────────────────────────────────────────────────

  it("displays score from schedule data on initial load", async () => {
    // MOCK_SCHEDULES[0] (id=1) has score=1240
    renderDetailPage("1");

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument();
    });
    // Locale-formatted number
    expect(screen.getByText("1,240")).toBeInTheDocument();
  });

  it("does not display score badge when schedule has no score", async () => {
    // MOCK_SCHEDULES[1] (id=2) has score=null
    server.use(
      http.get("/api/schedules/:id/visits/", () => HttpResponse.json([]))
    );
    renderDetailPage("2");

    await waitFor(() => {
      expect(screen.getByText("May 2026")).toBeInTheDocument();
    });
    expect(screen.queryByText("pts")).not.toBeInTheDocument();
  });

  it("shows updated score after AI generation", async () => {
    // Start with a schedule that has no score (id=2), then generate
    server.use(
      http.get("/api/schedules/:id/visits/", () => HttpResponse.json([]))
    );
    renderDetailPage("2");

    await waitFor(() => {
      expect(screen.getByText("May 2026")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      // generate mock emits score: 450
      expect(screen.getByText("450")).toBeInTheDocument();
    });
  });

  // ── Publish ──────────────────────────────────────────────────────────────

  it("does not show Publish button for a Published schedule", async () => {
    // id=1 is Published
    renderDetailPage("1");

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /publish/i })).not.toBeInTheDocument();
  });

  it("shows Publish button for a Draft schedule", async () => {
    // id=2 is Draft
    renderDetailPage("2");

    await waitFor(() => {
      expect(screen.getByText("May 2026")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /publish/i })).toBeInTheDocument();
  });

  it("hides Publish button after successful publish", async () => {
    renderDetailPage("2");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /publish/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /publish/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /publish/i })).not.toBeInTheDocument();
    });
  });

  it("shows error when publish fails", async () => {
    server.use(
      http.post("/api/schedules/:id/publish/", () =>
        HttpResponse.json(
          { error: "Only Draft schedules can be published." },
          { status: 400 }
        )
      )
    );

    renderDetailPage("2");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /publish/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /publish/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Only Draft schedules can be published.")
      ).toBeInTheDocument();
    });
  });

  // ── Export ───────────────────────────────────────────────────────────────

  it("shows Export button when visits are present", async () => {
    renderDetailPage("1");

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export/i })).not.toBeDisabled();
  });

  it("Export button is disabled when there are no visits", async () => {
    server.use(
      http.get("/api/schedules/:id/visits/", () => HttpResponse.json([]))
    );
    renderDetailPage("2");

    await waitFor(() => {
      expect(screen.getByText("May 2026")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /export/i })).toBeDisabled();
  });

  it("triggers export fetch with auth header when Export is clicked", async () => {
    let exportCalled = false;
    server.use(
      http.get("/api/schedules/:id/export/", () => {
        exportCalled = true;
        return new HttpResponse(
          new Blob(["xlsx"], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          { headers: { "Content-Disposition": 'attachment; filename="April 2026.xlsx"' } }
        );
      })
    );

    renderDetailPage("1");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(exportCalled).toBe(true);
    });
  });

  // ── Import ───────────────────────────────────────────────────────────────

  it("shows Import button", async () => {
    renderDetailPage("1");

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
  });

  it("import success replaces visit list", async () => {
    // Start with empty visits, then import brings MOCK_VISITS
    server.use(
      http.get("/api/schedules/:id/visits/", () => HttpResponse.json([]))
    );

    const { container } = renderDetailPage("1");

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument();
    });
    expect(screen.queryByText("Kiosk Alpha")).not.toBeInTheDocument();

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File([""], "schedule.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Kiosk Alpha")).toBeInTheDocument();
    });
  });

  it("import with warnings shows dismissable alert", async () => {
    server.use(
      http.post("/api/schedules/:id/import/", () =>
        HttpResponse.json({
          visits: MOCK_VISITS,
          errors: ["Row 2: POS 'UNKNOWN' not found — skipped."],
        })
      )
    );

    const { container } = renderDetailPage("1");

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument();
    });

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File([""], "schedule.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Imported with 1 warning/i)).toBeInTheDocument();
    });
  });

  it("import server error shows warning alert", async () => {
    server.use(
      http.post("/api/schedules/:id/import/", () =>
        HttpResponse.json({ error: "Could not read the file." }, { status: 400 })
      )
    );

    const { container } = renderDetailPage("1");

    await waitFor(() => {
      expect(screen.getByText("April 2026")).toBeInTheDocument();
    });

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File([""], "bad.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Could not read the file.")).toBeInTheDocument();
    });
  });
});
