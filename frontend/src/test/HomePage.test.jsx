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
} from "vitest";
import { AuthProvider } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";
import HomePage from "../pages/HomePage";
import muiTheme from "../muiTheme";
import { handlers, MOCK_SCHEDULES } from "./handlers";

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderHomePage() {
  return render(
    <ThemeProvider theme={muiTheme}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div data-testid="login-page" />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    localStorage.setItem("jti_access", "fake-access-token");
    localStorage.setItem("jti_refresh", "fake-refresh-token");
    localStorage.setItem("jti_user", JSON.stringify({ username: "admin" }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders the schedule list on success", async () => {
    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText(MOCK_SCHEDULES[0].name)).toBeInTheDocument();
    });
    expect(screen.getByText(MOCK_SCHEDULES[1].name)).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows empty state when no schedules exist", async () => {
    server.use(http.get("/api/schedules/", () => HttpResponse.json([])));

    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText("No schedules yet.")).toBeInTheDocument();
    });
  });

  it("redirects to /login when API returns 401", async () => {
    server.use(
      http.get("/api/schedules/", () => new HttpResponse(null, { status: 401 }))
    );

    renderHomePage();

    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });
    expect(localStorage.getItem("jti_access")).toBeNull();
  });

  it("shows an error alert when the API returns a server error", async () => {
    server.use(
      http.get("/api/schedules/", () => new HttpResponse(null, { status: 500 }))
    );

    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText("Could not load schedules.")).toBeInTheDocument();
    });
  });

  it("opens the create dialog when the button is clicked", async () => {
    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText(MOCK_SCHEDULES[0].name)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /create schedule draft/i }));

    await waitFor(() => {
      expect(screen.getByText("Create Schedule Draft")).toBeInTheDocument();
    });
  });

  it("adds the new schedule to the list after successful creation", async () => {
    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText(MOCK_SCHEDULES[0].name)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /create schedule draft/i }));

    await waitFor(() => {
      expect(screen.getByText("Create Schedule Draft")).toBeInTheDocument();
    });

    // Wait for POS + promoters to load in the dialog
    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /create draft/i }));

    await waitFor(() => {
      expect(screen.getByText("June 2026")).toBeInTheDocument();
    });
  });

  // ── Score column ─────────────────────────────────────────────────────────

  it("renders a Score column header", async () => {
    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText(MOCK_SCHEDULES[0].name)).toBeInTheDocument();
    });
    expect(screen.getByRole("columnheader", { name: /score/i })).toBeInTheDocument();
  });

  it("displays the score value for schedules that have one", async () => {
    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText(MOCK_SCHEDULES[0].name)).toBeInTheDocument();
    });
    // MOCK_SCHEDULES[0].score = 1240
    expect(screen.getByText("1,240")).toBeInTheDocument();
  });

  it("displays a dash for schedules with no score", async () => {
    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText(MOCK_SCHEDULES[1].name)).toBeInTheDocument();
    });
    // MOCK_SCHEDULES[1].score = null → "—"
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
