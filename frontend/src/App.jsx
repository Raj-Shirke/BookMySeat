import React, { useState, useEffect } from "react";
import {
  Film,
  Search,
  MapPin,
  Star,
  Clock,
  Ticket,
  BarChart3,
  User,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Download,
  Play,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  X,
  Calendar,
  CreditCard,
  TrendingUp,
  Building2,
  Flame,
  ChevronRight,
  Lock,
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

const DEFAULT_FALLBACK_POSTER =
  "https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg";

const TITLE_POSTER_MAP = {
  pushpa:
    "https://upload.wikimedia.org/wikipedia/en/1/11/Pushpa_2-_The_Rule.jpg",
  stree: "https://upload.wikimedia.org/wikipedia/en/a/a1/Stree_2.jpg",
  dune: "https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
  kalki: "https://upload.wikimedia.org/wikipedia/en/4/4c/Kalki_2898_AD.jpg",
  jawan: "https://upload.wikimedia.org/wikipedia/en/3/39/Jawan_film_poster.jpg",
  oppenheimer:
    "https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
  interstellar:
    "https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
  batman: "https://image.tmdb.org/t/p/w780/74xTEgt7R36Fpooo50r9T25onhq.jpg",
  avengers: "https://image.tmdb.org/t/p/w780/or06FN3Dka5tukK1e9sl16pB3iy.jpg",
  spider: "https://image.tmdb.org/t/p/w780/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg",
  singham:
    "https://upload.wikimedia.org/wikipedia/en/f/f2/Singham_Again_poster.jpg",
  bhool:
    "https://upload.wikimedia.org/wikipedia/en/6/6f/Bhool_Bhulaiyaa_3_poster.jpg",
  chhaava: "https://upload.wikimedia.org/wikipedia/en/7/75/Chhaava_poster.jpg",
  animal:
    "https://upload.wikimedia.org/wikipedia/en/9/90/Animal_%282023_film%29_poster.jpg",
  leo: "https://upload.wikimedia.org/wikipedia/en/7/75/Leo_%282023_Indian_film%29.jpg",
};

const getMoviePoster = (movie, customUrl = null) => {
  if (customUrl && !customUrl.includes("unsplash.com")) return customUrl;
  const primary = movie?.posters?.[0]?.image_url;
  if (primary && !primary.includes("unsplash.com")) return primary;
  const titleLower = (movie?.title || "").toLowerCase();
  for (const [key, url] of Object.entries(TITLE_POSTER_MAP)) {
    if (titleLower.includes(key)) return url;
  }
  return primary || DEFAULT_FALLBACK_POSTER;
};

const handleImgError = (e) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = DEFAULT_FALLBACK_POSTER;
};

export default function App() {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem("bms_auth");
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState("discover");
  const [toast, setToast] = useState(null);
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Task 1 State: Discovery, Filters & Recommendations
  const [movies, setMovies] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [recommended, setRecommended] = useState([]);
  const [recStrategy, setRecStrategy] = useState("popular_fallback");
  const [meta, setMeta] = useState({
    genres: [],
    languages: [],
    cities: [],
    theaters: [],
  });
  const [filters, setFilters] = useState({
    search: "",
    genre: "",
    language: "",
    city: "",
    theater: "",
    min_rating: "",
    show_window: "",
    ordering: "-total_bookings_count",
  });

  // Task 3 State: Selected Movie Details, Poster Preview & Reviews
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activePoster, setActivePoster] = useState("");
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [isEditingReview, setIsEditingReview] = useState(false);

  // Task 5 & 4 State: Live Seat Map, 2-Min Hold & Payment
  const [seatLayout, setSeatLayout] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [countdown, setCountdown] = useState(0);

  // Task 4 & 2 State: User Bookings & PDF Download
  const [myBookings, setMyBookings] = useState([]);

  // Task 6 State: Admin Analytics
  const [analytics, setAnalytics] = useState(null);
  const [dateRange, setDateRange] = useState({ start_date: "", end_date: "" });

  // Auth Form
  const [authForm, setAuthForm] = useState({
    action: "login",
    username: "",
    password: "",
    email: "",
  });

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const authHeaders = () => {
    const h = { "Content-Type": "application/json" };
    if (auth?.token) h["Authorization"] = `Token ${auth.token}`;
    return h;
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  useEffect(() => {
    fetch(`${API_BASE}/movies/filters-metadata/`)
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/movies/recommendations/`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setRecommended(d.results || []);
        setRecStrategy(d.strategy || "popular_fallback");
      })
      .catch(() => {});
  }, [auth]);

  useEffect(() => {
    setLoadingMovies(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    fetch(`${API_BASE}/movies/discover/?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setMovies(d.results || []);
        setTotalMatches(d.total_matching_movies || 0);
      })
      .catch(() => {})
      .finally(() => setLoadingMovies(false));
  }, [filters]);

  useEffect(() => {
    if (!countdown || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          notify(
            "2-minute seat hold expired! Seats automatically released.",
            "error",
          );
          if (seatLayout) openSeatMap(seatLayout.showtime_id);
          setActiveBooking(null);
          setPaymentOrder(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const resetFilters = () => {
    setFilters({
      search: "",
      genre: "",
      language: "",
      city: "",
      theater: "",
      min_rating: "",
      show_window: "",
      ordering: "-total_bookings_count",
    });
  };

  const openMovieDetail = async (movieId) => {
    const res = await fetch(`${API_BASE}/movies/${movieId}/`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    setSelectedMovie(data);
    setActivePoster(getMoviePoster(data));
    const existingMyReview = data.reviews?.find(
      (r) => r.username === auth?.username,
    );
    if (existingMyReview) {
      setReviewForm({
        rating: existingMyReview.rating,
        comment: existingMyReview.comment,
      });
      setIsEditingReview(true);
    } else {
      setReviewForm({ rating: 5, comment: "" });
      setIsEditingReview(false);
    }
    setActiveTab("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!auth) return setActiveTab("login");
    const method = isEditingReview ? "PUT" : "POST";
    const res = await fetch(`${API_BASE}/movies/${selectedMovie.id}/reviews/`, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(reviewForm),
    });
    const data = await res.json();
    if (res.ok) {
      notify(
        isEditingReview
          ? "Your verified review was updated!"
          : "Verified review submitted!",
      );
      openMovieDetail(selectedMovie.id);
    } else {
      notify(data.detail || "Could not submit review.", "error");
    }
  };

  const handleReportReview = async (reviewId) => {
    if (!auth) return setActiveTab("login");
    const res = await fetch(`${API_BASE}/reviews/${reviewId}/report/`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ reason: "Flagged by user as inappropriate" }),
    });
    if (res.ok) {
      notify("Review flagged and hidden for admin moderation.");
      openMovieDetail(selectedMovie.id);
    }
  };

  const openSeatMap = async (showtimeId) => {
    const res = await fetch(`${API_BASE}/showtimes/${showtimeId}/seats/`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    setSeatLayout(data);
    setSelectedSeats([]);
    setActiveBooking(null);
    setPaymentOrder(null);
    setActiveTab("seats");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSeatSelection = (rowLabel, seatNum, status) => {
    if (status !== "AVAILABLE") return;
    const code = `${rowLabel}${seatNum}`;
    setSelectedSeats((prev) =>
      prev.some((s) => s.code === code)
        ? prev.filter((s) => s.code !== code)
        : [...prev, { row_label: rowLabel, seat_number: seatNum, code }],
    );
  };

  const handleReserveSeats = async () => {
    if (!auth) return setActiveTab("login");
    if (selectedSeats.length === 0)
      return notify("Select at least 1 seat.", "error");

    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/showtimes/${seatLayout.showtime_id}/reserve/`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            seats: selectedSeats.map(({ row_label, seat_number }) => ({
              row_label,
              seat_number,
            })),
            booking_id: activeBooking?.booking_id || null,
          }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        setActiveBooking(data);
        setCountdown(data.remaining_seconds || 120);
        notify(`Locked ${selectedSeats.length} seat(s) for 2 minutes!`);
        const orderRes = await fetch(`${API_BASE}/payments/create-order/`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ booking_id: data.booking_id }),
        });
        const orderData = await orderRes.json();
        if (orderRes.ok) setPaymentOrder(orderData);
      } else {
        notify(data.detail || "Seat reservation conflict!", "error");
        openSeatMap(seatLayout.showtime_id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseHold = async () => {
    if (!activeBooking) return;
    const res = await fetch(
      `${API_BASE}/bookings/${activeBooking.booking_id}/release/`,
      {
        method: "POST",
        headers: authHeaders(),
      },
    );
    if (res.ok) {
      setCountdown(0);
      setActiveBooking(null);
      setPaymentOrder(null);
      notify("Seat hold released.");
      openSeatMap(seatLayout.showtime_id);
    }
  };

  const handleVerifyPayment = async (outcome = "SUCCESS") => {
    if (!paymentOrder) return;
    setSubmitting(true);
    try {
      const payload = {
        ...paymentOrder.test_verification_payload,
        payment_outcome: outcome,
      };
      const res = await fetch(`${API_BASE}/payments/verify/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setCountdown(0);
        notify("Payment Confirmed! PDF Ticket & QR Email Dispatched.");
        fetchMyBookings();
        setActiveTab("bookings");
      } else {
        setCountdown(0);
        setActiveBooking(null);
        setPaymentOrder(null);
        notify(
          data.detail || "Payment failed. Seats automatically released.",
          "error",
        );
        openSeatMap(seatLayout.showtime_id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fetchMyBookings = async () => {
    if (!auth) return;
    const res = await fetch(`${API_BASE}/users/my-bookings/`, {
      headers: authHeaders(),
    });
    if (res.ok) setMyBookings(await res.json());
  };

  const handleDownloadTicket = async (bookingId) => {
    const res = await fetch(
      `${API_BASE}/bookings/${bookingId}/download-ticket/`,
      {
        headers: authHeaders(),
      },
    );
    if (!res.ok) return notify("Could not download PDF ticket.", "error");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BookMySeat_Ticket_${bookingId.slice(0, 8)}.pdf`;
    a.click();
    notify("Downloaded Official PDF Ticket!");
  };

  const fetchAnalytics = async () => {
    const params = new URLSearchParams();
    if (dateRange.start_date) params.append("start_date", dateRange.start_date);
    if (dateRange.end_date) params.append("end_date", dateRange.end_date);
    const res = await fetch(
      `${API_BASE}/admin/analytics/?${params.toString()}`,
      {
        headers: authHeaders(),
      },
    );
    if (res.ok) {
      setAnalytics(await res.json());
    } else {
      notify("Admin access required to view analytics.", "error");
    }
  };

  const handleExportCSV = async () => {
    const params = new URLSearchParams();
    if (dateRange.start_date) params.append("start_date", dateRange.start_date);
    if (dateRange.end_date) params.append("end_date", dateRange.end_date);
    const res = await fetch(
      `${API_BASE}/admin/analytics/export-csv/?${params.toString()}`,
      {
        headers: authHeaders(),
      },
    );
    if (!res.ok) return notify("Admin permission required.", "error");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "BookMySeat_Analytics_Report.csv";
    a.click();
    notify("Analytics CSV Exported!");
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/auth/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authForm),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("bms_auth", JSON.stringify(data));
      setAuth(data);
      notify(`Welcome back, ${data.username}!`);
      setActiveTab("discover");
    } else {
      notify(data.detail || "Authentication failed", "error");
    }
  };

  const featuredMovie = movies[0] || recommended[0];
  const hasActiveFilters = Boolean(
    filters.search ||
    filters.genre ||
    filters.language ||
    filters.city ||
    filters.min_rating ||
    filters.show_window,
  );

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md text-sm font-semibold transition-all duration-300 ${
            toast.type === "error"
              ? "bg-rose-950/95 border-rose-500/80 text-rose-100"
              : "bg-emerald-950/95 border-emerald-500/80 text-emerald-100"
          }`}
        >
          {toast.type === "error" ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-[#090D16]/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => setActiveTab("discover")}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-600/30 group-hover:scale-105 transition">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-white">
                BookMy<span className="text-rose-500">Seat</span>
              </span>
              <span className="block text-[10px] uppercase tracking-widest text-slate-400 -mt-1">
                IMAX & Multiplex Ticketing
              </span>
            </div>
          </button>

          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={() => setActiveTab("discover")}
              className={`px-3.5 py-2 rounded-xl font-semibold transition cursor-pointer ${
                activeTab === "discover"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-600/25"
                  : "text-slate-300 hover:bg-slate-800/70"
              }`}
            >
              Movies
            </button>

            {auth && (
              <button
                onClick={() => {
                  fetchMyBookings();
                  setActiveTab("bookings");
                }}
                className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "bookings"
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-600/25"
                    : "text-slate-300 hover:bg-slate-800/70"
                }`}
              >
                <Ticket className="w-4 h-4" /> My Tickets
              </button>
            )}

            {auth?.is_staff && (
              <button
                onClick={() => {
                  fetchAnalytics();
                  setActiveTab("analytics");
                }}
                className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "analytics"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                    : "text-indigo-300 bg-indigo-950/40 border border-indigo-800/50 hover:bg-indigo-900/50"
                }`}
              >
                <BarChart3 className="w-4 h-4" /> Analytics
              </button>
            )}

            {auth ? (
              <div className="flex items-center gap-2 pl-3 ml-1 border-l border-slate-800">
                <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-rose-400" />
                  <span>{auth.username}</span>
                  {auth.is_staff && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold">
                      ADMIN
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem("bms_auth");
                    setAuth(null);
                    setActiveTab("discover");
                  }}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab("login")}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold shadow-lg shadow-rose-600/20 transition cursor-pointer"
              >
                Sign In
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {activeTab === "discover" && (
          <div className="space-y-8">
            {featuredMovie && !hasActiveFilters && (
              <div className="relative rounded-3xl overflow-hidden border border-slate-800/80 bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950/40 shadow-2xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 items-center p-6 sm:p-8 lg:p-10 gap-6">
                  <div className="lg:col-span-8 space-y-4 z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
                      <Flame className="w-3.5 h-3.5 fill-current" /> #1 Trending
                      Blockbuster
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                      {featuredMovie.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      <span className="bg-amber-400 text-slate-950 font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-current" />{" "}
                        {featuredMovie.average_rating} / 5
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 font-semibold">
                        {featuredMovie.age_certification}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700">
                        {featuredMovie.duration_minutes} mins
                      </span>
                      <span className="text-slate-400">
                        {featuredMovie.genres?.map((g) => g.name).join(" • ")}
                      </span>
                    </div>
                    <div className="pt-2 flex flex-wrap gap-3">
                      <button
                        onClick={() => openMovieDetail(featuredMovie.id)}
                        className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex items-center gap-2 shadow-xl shadow-rose-600/30 transition cursor-pointer"
                      >
                        <Ticket className="w-4 h-4" /> Book Tickets & Watch
                        Trailer
                      </button>
                    </div>
                  </div>
                  <div className="lg:col-span-4 flex justify-center lg:justify-end">
                    <img
                      src={getMoviePoster(featuredMovie)}
                      onError={handleImgError}
                      alt={featuredMovie.title}
                      onClick={() => openMovieDetail(featuredMovie.id)}
                      className="w-48 sm:w-56 aspect-[2/3] object-cover rounded-2xl shadow-2xl border-2 border-slate-700/60 hover:scale-105 transition duration-300 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Search & Filters */}
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="sm:col-span-2 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search movie title, actor, or keyword..."
                    value={filters.search}
                    onChange={(e) =>
                      setFilters({ ...filters, search: e.target.value })
                    }
                    className="w-full pl-10 pr-8 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:border-rose-500 outline-none"
                  />
                  {filters.search && (
                    <button
                      onClick={() => setFilters({ ...filters, search: "" })}
                      className="absolute right-3 top-3 text-slate-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <select
                  value={filters.genre}
                  onChange={(e) =>
                    setFilters({ ...filters, genre: e.target.value })
                  }
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-500"
                >
                  <option value="">All Genres</option>
                  {meta.genres.map((g) => (
                    <option key={g.id} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.language}
                  onChange={(e) =>
                    setFilters({ ...filters, language: e.target.value })
                  }
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-500"
                >
                  <option value="">All Languages</option>
                  {meta.languages.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.city}
                  onChange={(e) =>
                    setFilters({ ...filters, city: e.target.value })
                  }
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-500"
                >
                  <option value="">All Cities</option>
                  {meta.cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.ordering}
                  onChange={(e) =>
                    setFilters({ ...filters, ordering: e.target.value })
                  }
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-500"
                >
                  <option value="-total_bookings_count">
                    Sort: Popularity
                  </option>
                  <option value="-release_date">Sort: Newest Releases</option>
                  <option value="-average_rating">Sort: Top Rated</option>
                  <option value="min_ticket_price">
                    Sort: Price (Low to High)
                  </option>
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 font-medium">
                    Show Window:
                  </span>
                  {[
                    { id: "", label: "All Times" },
                    { id: "morning", label: "Morning" },
                    { id: "afternoon", label: "Afternoon" },
                    { id: "evening", label: "Evening" },
                    { id: "night", label: "Night" },
                  ].map((w) => (
                    <button
                      key={w.id}
                      onClick={() =>
                        setFilters({ ...filters, show_window: w.id })
                      }
                      className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                        filters.show_window === w.id
                          ? "bg-rose-600 text-white"
                          : "bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Clear Filters
                    </button>
                  )}
                  <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 font-bold text-rose-400">
                    {totalMatches} Matching{" "}
                    {totalMatches === 1 ? "Movie" : "Movies"}
                  </span>
                </div>
              </div>
            </div>

            {/* Movie Grid */}
            <section className="space-y-4">
              <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                <Film className="w-5 h-5 text-rose-500" /> Now Showing in
                Cinemas
              </h2>

              {loadingMovies ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-96 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse"
                    />
                  ))}
                </div>
              ) : movies.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                  <Film className="w-10 h-10 text-slate-500 mx-auto" />
                  <h3 className="text-lg font-bold">
                    No Movies Match Your Filter Criteria
                  </h3>
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 bg-rose-600 rounded-xl text-xs font-bold text-white"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {movies.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => openMovieDetail(m.id)}
                      className="group bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden cursor-pointer hover:border-rose-500/60 hover:-translate-y-1 transition-all duration-300 shadow-lg flex flex-col"
                    >
                      <div className="aspect-[2/3] bg-slate-800 relative overflow-hidden">
                        <img
                          src={getMoviePoster(m)}
                          onError={handleImgError}
                          alt={m.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                        <span className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-extrabold">
                          {m.age_certification}
                        </span>
                        <span className="absolute bottom-3 right-3 bg-amber-400 text-slate-950 px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 shadow-md">
                          <Star className="w-3.5 h-3.5 fill-current" />{" "}
                          {m.average_rating}
                        </span>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h3 className="font-bold text-base text-white group-hover:text-rose-400 transition line-clamp-1">
                            {m.title}
                          </h3>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {m.genres?.map((g) => (
                              <span
                                key={g.id}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium"
                              >
                                {g.name}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5">
                            {m.languages?.map((l) => l.name).join(" • ")}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />{" "}
                            {m.duration_minutes}m
                          </span>
                          <span className="font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
                            From ₹{m.min_ticket_price || "200"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {recommended.length > 0 && (
              <section className="pt-6 border-t border-slate-800/80 space-y-4">
                <div>
                  <h2 className="text-xl font-extrabold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" /> Recommended
                    for You
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {recStrategy === "personalized_history"
                      ? "Tailored from your confirmed bookings and recently viewed movies"
                      : "Top trending picks across BookMySeat cinemas"}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {recommended.slice(0, 4).map((m) => (
                    <div
                      key={m.id}
                      onClick={() => openMovieDetail(m.id)}
                      className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl cursor-pointer hover:border-amber-500/50 transition flex items-center gap-3.5 shadow-md"
                    >
                      <img
                        src={getMoviePoster(m)}
                        onError={handleImgError}
                        alt={m.title}
                        className="w-16 h-24 object-cover rounded-xl flex-shrink-0 border border-slate-700"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold">
                          ★ {m.average_rating} Rated
                        </span>
                        <h4 className="font-bold text-sm text-white truncate">
                          {m.title}
                        </h4>
                        <p className="text-xs text-slate-400 truncate">
                          {m.genres?.map((g) => g.name).join(", ")}
                        </p>
                        <p className="text-xs font-bold text-rose-400 flex items-center gap-0.5">
                          View Showtimes{" "}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Movie Details */}
        {activeTab === "detail" && selectedMovie && (
          <div className="space-y-8">
            <button
              onClick={() => setActiveTab("discover")}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
            >
              ← Back to Movie Discovery
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
              <div className="lg:col-span-4 space-y-4">
                <img
                  src={getMoviePoster(selectedMovie, activePoster)}
                  onError={handleImgError}
                  alt={selectedMovie.title}
                  className="w-full aspect-[2/3] rounded-2xl object-cover shadow-2xl border border-slate-700"
                />
                {selectedMovie.posters?.length > 1 && (
                  <div className="flex gap-2.5 overflow-x-auto pb-1">
                    {selectedMovie.posters.map((p) => (
                      <img
                        key={p.id}
                        src={p.image_url}
                        onError={handleImgError}
                        alt="Poster thumbnail"
                        onClick={() => setActivePoster(p.image_url)}
                        className={`w-16 h-24 object-cover rounded-xl cursor-pointer border-2 transition ${
                          activePoster === p.image_url
                            ? "border-rose-500 scale-105"
                            : "border-slate-800 opacity-60"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-8 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-4xl font-black text-white">
                      {selectedMovie.title}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedMovie.genres?.map((g) => g.name).join(" • ")} |{" "}
                      {selectedMovie.languages?.map((l) => l.name).join(", ")}
                    </p>
                  </div>
                  <div className="bg-amber-400 text-slate-950 px-4 py-2 rounded-2xl font-black text-sm flex items-center gap-1.5 shadow-lg">
                    <Star className="w-4 h-4 fill-current" />{" "}
                    {selectedMovie.average_rating} / 5.0
                  </div>
                </div>

                <p className="text-slate-300 text-sm leading-relaxed">
                  {selectedMovie.description}
                </p>

                <div className="flex flex-wrap gap-2.5 text-xs font-semibold">
                  <span className="bg-slate-950 border border-slate-800 px-3.5 py-1.5 rounded-xl">
                    Certification:{" "}
                    <strong className="text-rose-400">
                      {selectedMovie.age_certification}
                    </strong>
                  </span>
                  <span className="bg-slate-950 border border-slate-800 px-3.5 py-1.5 rounded-xl">
                    Duration:{" "}
                    <strong>{selectedMovie.duration_minutes} mins</strong>
                  </span>
                  <span className="bg-slate-950 border border-slate-800 px-3.5 py-1.5 rounded-xl">
                    Release Date: <strong>{selectedMovie.release_date}</strong>
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                    Featured Cast & Crew
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {selectedMovie.cast?.map((c) => (
                      <div
                        key={c.id}
                        className="bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2"
                      >
                        <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center">
                          {c.name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-white">{c.name}</p>
                          <p className="text-[11px] text-slate-400">
                            as {c.role_name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedMovie.secure_trailer_embed_url && (
                  <div className="pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <Play className="w-4 h-4 text-rose-500 fill-current" />{" "}
                      Official Trailer (Privacy-Enhanced Embed)
                    </h3>
                    <div className="aspect-video w-full rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-xl">
                      <iframe
                        src={selectedMovie.secure_trailer_embed_url}
                        title={selectedMovie.title}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-rose-500" /> Available
                Showtimes — Select to Reserve Seats
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedMovie.showtimes?.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => openSeatMap(st.id)}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-rose-500 text-left transition group flex items-center justify-between cursor-pointer"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-white group-hover:text-rose-400 transition">
                        {st.theater_name}
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" /> {st.city}{" "}
                        • {st.screen_name}
                      </p>
                      <p className="text-xs text-emerald-400 font-semibold pt-1">
                        {new Date(st.start_time).toLocaleString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="bg-rose-600/15 border border-rose-500/40 text-rose-300 px-3 py-1.5 rounded-xl text-xs font-extrabold block">
                        ₹{st.ticket_price}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Select Seats →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Verified Reviews */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" /> Verified
                  Viewer Reviews ({selectedMovie.reviews?.length || 0})
                </h3>
                {selectedMovie.reviews?.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6">
                    No reviews yet. Book and watch this movie to post the first
                    verified viewer review!
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {selectedMovie.reviews?.map((rv) => (
                      <div
                        key={rv.id}
                        className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm flex items-center gap-2">
                            {rv.username}
                            {rv.is_verified_viewer && (
                              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-700/70 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Verified
                                Viewer
                              </span>
                            )}
                          </span>
                          <span className="text-xs font-black bg-amber-400/15 text-amber-300 px-2.5 py-1 rounded-lg">
                            ★ {rv.rating} / 5
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {rv.comment}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-slate-500">
                            {new Date(rv.created_at).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => handleReportReview(rv.id)}
                            className="text-[11px] text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            Report inappropriate content
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={handleReviewSubmit}
                className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 self-start"
              >
                <h3 className="text-lg font-extrabold">
                  {isEditingReview
                    ? "Edit Your Verified Review"
                    : "Post a Verified Review"}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Verified Viewer Policy: Only registered users with a confirmed
                  post-show booking can submit or edit a review.
                </p>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Select Star Rating
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() =>
                          setReviewForm({ ...reviewForm, rating: star })
                        }
                        className={`flex-1 py-2 rounded-xl font-bold text-xs border transition cursor-pointer ${
                          reviewForm.rating >= star
                            ? "bg-amber-400 text-slate-950 border-amber-300"
                            : "bg-slate-950 text-slate-400 border-slate-800"
                        }`}
                      >
                        ★ {star}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Your Review
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={reviewForm.comment}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, comment: e.target.value })
                    }
                    placeholder="What did you think about the direction, visuals, and sound?"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-rose-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-sm shadow-lg shadow-rose-600/20 cursor-pointer"
                >
                  {isEditingReview
                    ? "Update My Verified Review"
                    : "Submit Verified Review"}
                </button>
              </form>
            </div>

            {selectedMovie.similar_movies?.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <h3 className="text-lg font-extrabold">
                  Similar Movies You Might Like
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                  {selectedMovie.similar_movies.map((sm) => (
                    <div
                      key={sm.id}
                      onClick={() => openMovieDetail(sm.id)}
                      className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-rose-500 transition"
                    >
                      <img
                        src={getMoviePoster(sm)}
                        onError={handleImgError}
                        alt={sm.title}
                        className="w-full aspect-[2/3] object-cover"
                      />
                      <div className="p-2.5">
                        <p className="font-bold text-xs truncate">{sm.title}</p>
                        <p className="text-[11px] text-amber-400 mt-0.5">
                          ★ {sm.average_rating}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Seat Selection */}
        {activeTab === "seats" && seatLayout && (
          <div className="space-y-6 pb-16">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
              <div>
                <button
                  onClick={() => setActiveTab("detail")}
                  className="text-xs text-slate-400 hover:text-white mb-1 block cursor-pointer"
                >
                  ← Change Showtime
                </button>
                <h2 className="text-xl font-black text-white">
                  {seatLayout.movie_title}
                </h2>
                <p className="text-xs text-slate-400">
                  {seatLayout.theater_name} • {seatLayout.screen_name} •{" "}
                  <span className="text-emerald-400 font-bold">
                    ₹{seatLayout.ticket_price} per seat
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-md bg-slate-950 border border-slate-600 inline-block" />{" "}
                  Available ({seatLayout.summary.available_seats})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-md bg-emerald-500 inline-block" />{" "}
                  Selected ({selectedSeats.length})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-md bg-amber-500/30 border border-amber-500 inline-block" />{" "}
                  Held 2m ({seatLayout.summary.reserved_seats})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-md bg-rose-900/60 border border-rose-700 inline-block" />{" "}
                  Booked ({seatLayout.summary.booked_seats})
                </span>
              </div>
            </div>

            <div className="text-center space-y-2 py-2">
              <div className="w-3/4 max-w-2xl mx-auto h-3 bg-gradient-to-r from-transparent via-rose-500 to-transparent rounded-full shadow-[0_12px_35px_rgba(244,63,94,0.6)]" />
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400 font-semibold">
                IMAX Laser Projection Screen — All Eyes This Way
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 overflow-x-auto shadow-inner">
              <div className="min-w-[640px] space-y-2.5 flex flex-col items-center">
                {seatLayout.seat_map.map((row) => (
                  <div key={row.row_label} className="flex items-center gap-2">
                    <span className="w-6 text-xs font-extrabold text-slate-400 text-center">
                      {row.row_label}
                    </span>
                    {row.seats.map((s, idx) => {
                      const isSelected = selectedSeats.some(
                        (sel) => sel.code === s.seat_code,
                      );
                      let btnClass =
                        "bg-slate-950 border-slate-700 text-slate-300 hover:border-rose-400 hover:scale-105 cursor-pointer";
                      if (s.status === "BOOKED")
                        btnClass =
                          "bg-rose-950/60 border-rose-800/70 text-rose-400/50 cursor-not-allowed";
                      else if (s.status === "RESERVED")
                        btnClass =
                          "bg-amber-500/20 border-amber-500 text-amber-300 cursor-not-allowed";
                      else if (isSelected)
                        btnClass =
                          "bg-emerald-500 border-emerald-300 text-slate-950 font-black scale-105 shadow-md shadow-emerald-500/30 cursor-pointer";

                      return (
                        <React.Fragment key={s.seat_code}>
                          {idx === 6 && <span className="w-5" />}
                          <button
                            onClick={() =>
                              toggleSeatSelection(
                                s.row_label,
                                s.seat_number,
                                s.status,
                              )
                            }
                            disabled={
                              s.status !== "AVAILABLE" || Boolean(activeBooking)
                            }
                            className={`w-8 h-8 rounded-t-xl rounded-b-md border text-[11px] transition-all ${btnClass}`}
                          >
                            {s.seat_number}
                          </button>
                        </React.Fragment>
                      );
                    })}
                    <span className="w-6 text-xs font-extrabold text-slate-400 text-center">
                      {row.row_label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-bold">
                  Selected Seats:{" "}
                  <span className="text-emerald-400 font-black">
                    {selectedSeats.map((s) => s.code).join(", ") ||
                      "Click available seats above"}
                  </span>
                </p>
                <p className="text-xs text-slate-400">
                  Total Payable:{" "}
                  <strong className="text-white text-base">
                    ₹
                    {(
                      selectedSeats.length * seatLayout.ticket_price
                    ).toLocaleString()}
                  </strong>
                </p>
              </div>

              {!activeBooking ? (
                <button
                  onClick={handleReserveSeats}
                  disabled={submitting || selectedSeats.length === 0}
                  className="px-6 py-3 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 disabled:opacity-40 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-xl shadow-rose-600/25 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  {submitting
                    ? "Locking Seats..."
                    : "Lock Seats (2-Min Hold) & Proceed to Pay"}
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-4 py-2 rounded-2xl bg-amber-950 border border-amber-500 text-amber-300 text-xs font-black flex items-center gap-2">
                    <Clock className="w-4 h-4 animate-spin" /> Hold Expires in{" "}
                    {formatTime(countdown)}
                  </span>
                  <button
                    onClick={() => handleVerifyPayment("SUCCESS")}
                    disabled={submitting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold text-xs text-white flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" /> Pay ₹
                    {activeBooking.total_amount} (Razorpay Success)
                  </button>
                  <button
                    onClick={() => handleVerifyPayment("FAILED")}
                    disabled={submitting}
                    className="px-4 py-2.5 bg-rose-950 border border-rose-700 hover:bg-rose-900 rounded-2xl font-bold text-xs text-rose-200 cursor-pointer"
                  >
                    Simulate Payment Failure
                  </button>
                  <button
                    onClick={handleReleaseHold}
                    className="px-3 py-2.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel Hold
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Bookings */}
        {activeTab === "bookings" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black">
                  My Digital Tickets & Payment History
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Download official PDF tickets with entry QR codes or inspect
                  transaction logs
                </p>
              </div>
              <button
                onClick={fetchMyBookings}
                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold flex items-center gap-1.5 hover:border-slate-700 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {myBookings.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
                <Ticket className="w-10 h-10 text-slate-500 mx-auto" />
                <h3 className="text-lg font-bold">No Bookings Found</h3>
                <p className="text-xs text-slate-400">
                  Reserve seats on any showtime to generate your digital ticket.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myBookings.map((b) => (
                  <div
                    key={b.booking_id}
                    className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between"
                  >
                    <div className="p-6 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase tracking-widest text-rose-400 font-bold">
                            {b.city || "Multiplex E-Ticket"}
                          </span>
                          <h3 className="font-black text-lg text-white">
                            {b.movie_title}
                          </h3>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                            b.status === "CONFIRMED"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-700"
                              : "bg-rose-950 text-rose-400 border border-rose-800"
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 font-medium">
                        {b.theater_name} •{" "}
                        <span className="text-slate-400">{b.screen_name}</span>
                      </p>

                      <div className="grid grid-cols-2 gap-3 pt-2 text-xs bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">
                            Seats
                          </span>
                          <strong className="text-emerald-400">
                            {b.seats?.map((s) => s.seat_code).join(", ") ||
                              "Released"}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">
                            Amount Paid
                          </span>
                          <strong className="text-white">
                            ₹{b.total_amount}
                          </strong>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500 block text-[10px] uppercase">
                            Payment Ref / Order
                          </span>
                          <span className="text-slate-300 font-mono text-[11px]">
                            {b.payment_reference_id ||
                              b.payment_Order_id ||
                              "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-slate-950/90 border-t border-dashed border-slate-800 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-mono text-slate-500">
                        ID: #{b.booking_id.slice(0, 8)}
                      </span>
                      {b.status === "CONFIRMED" && (
                        <button
                          onClick={() => handleDownloadTicket(b.booking_id)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" /> Download PDF
                          Ticket (QR)
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admin Analytics */}
        {activeTab === "analytics" && analytics && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl">
              <div>
                <span className="text-[11px] uppercase tracking-widest text-indigo-400 font-bold">
                  Task 6 • High-Volume ORM Aggregation Engine
                </span>
                <h2 className="text-2xl font-black text-white mt-0.5">
                  Executive Admin Analytics Dashboard
                </h2>
                <p className="text-xs text-emerald-400 mt-1">
                  Executed across{" "}
                  <strong>
                    {analytics.cancellation_and_refund_stats.total_bookings.toLocaleString()}
                  </strong>{" "}
                  bookings in{" "}
                  <strong>{analytics.query_execution_time_ms} ms</strong> using
                  composite B-Tree indexes
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="date"
                  value={dateRange.start_date}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, start_date: e.target.value })
                  }
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                />
                <input
                  type="date"
                  value={dateRange.end_date}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, end_date: e.target.value })
                  }
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                />
                <button
                  onClick={fetchAnalytics}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Apply Filter
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <p className="text-xs text-slate-400">
                  Total Confirmed Revenue
                </p>
                <p className="text-xl font-black text-emerald-400 mt-1">
                  ₹
                  {Number(
                    analytics.revenue_insights.total_revenue,
                  ).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <p className="text-xs text-slate-400">Daily Revenue (Today)</p>
                <p className="text-xl font-black text-white mt-1">
                  ₹
                  {Number(
                    analytics.revenue_insights.daily_revenue,
                  ).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <p className="text-xs text-slate-400">Weekly Revenue (7d)</p>
                <p className="text-xl font-black text-indigo-400 mt-1">
                  ₹
                  {Number(
                    analytics.revenue_insights.weekly_revenue,
                  ).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <p className="text-xs text-slate-400">Monthly Revenue (30d)</p>
                <p className="text-xl font-black text-amber-400 mt-1">
                  ₹
                  {Number(
                    analytics.revenue_insights.monthly_revenue,
                  ).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <p className="text-xs text-slate-400">Cancellation Rate</p>
                <p className="text-xl font-black text-rose-400 mt-1">
                  {
                    analytics.cancellation_and_refund_stats
                      .cancellation_rate_percent
                  }
                  %
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Most
                  Booked Movies
                </h3>
                <div className="space-y-3 text-xs">
                  {analytics.most_booked_movies.map((m, idx) => (
                    <div
                      key={m.movie_id}
                      className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-white">
                          {m.movie_title}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-emerald-400 font-extrabold block">
                          ₹{Number(m.total_revenue).toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {m.confirmed_bookings.toLocaleString()} confirmed
                          bookings
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" /> Theater
                  Performance & Seat Occupancy
                </h3>
                <div className="space-y-3 text-xs">
                  {analytics.top_performing_theaters_and_occupancy.map((th) => (
                    <div
                      key={th.theater_id}
                      className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white">
                            {th.theater_name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {th.city} • {th.confirmed_bookings.toLocaleString()}{" "}
                            bookings
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-400 font-extrabold">
                            ₹{Number(th.total_revenue).toLocaleString()}
                          </p>
                          <p className="text-[11px] text-indigo-300 font-semibold">
                            Occupancy: {th.occupancy_percentage}%
                          </p>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                          style={{
                            width: `${Math.max(th.occupancy_percentage, 4)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Login / Register */}
        {activeTab === "login" && (
          <form
            onSubmit={handleAuthSubmit}
            className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-5 mt-8 shadow-2xl"
          >
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-black">
                {authForm.action === "login"
                  ? "Welcome Back"
                  : "Create Your Account"}
              </h2>
              <p className="text-xs text-slate-400">
                Demo Admin Credentials:{" "}
                <strong className="text-rose-400">admin</strong> /{" "}
                <strong className="text-rose-400">Admin@1234</strong>
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                required
                placeholder="Username"
                value={authForm.username}
                onChange={(e) =>
                  setAuthForm({ ...authForm, username: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-500"
              />
              {authForm.action === "register" && (
                <input
                  type="email"
                  required
                  placeholder="Email address (for PDF ticket delivery)"
                  value={authForm.email}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, email: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-500"
                />
              )}
              <input
                type="password"
                required
                placeholder="Password"
                value={authForm.password}
                onChange={(e) =>
                  setAuthForm({ ...authForm, password: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 rounded-xl font-bold text-sm shadow-lg shadow-rose-600/25 cursor-pointer"
            >
              {authForm.action === "login" ? "Sign In" : "Create Account"}
            </button>

            <button
              type="button"
              onClick={() =>
                setAuthForm({
                  ...authForm,
                  action: authForm.action === "login" ? "register" : "login",
                })
              }
              className="w-full text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              {authForm.action === "login"
                ? "New to BookMySeat? Create an account"
                : "Already have an account? Sign In"}
            </button>
          </form>
        )}
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        BookMySeat Enterprise Cinema Platform • Built with Django REST
        Framework, React, Celery & Razorpay
      </footer>
    </div>
  );
}
