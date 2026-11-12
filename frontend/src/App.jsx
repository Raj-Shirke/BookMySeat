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
  ChevronLeft,
  Lock,
  SlidersHorizontal,
  ArrowLeft,
  MoveHorizontal,
  Loader2,
  QrCode,
  Server,
  Navigation,
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

const CITY_REGION_DIRECTORY = {
  Mumbai: {
    icon: "🌊",
    tagline: "Financial Capital • 12+ IMAX Multiplexes",
    regions: [
      "Andheri & Western Suburbs",
      "Bandra Kurla Complex (BKC)",
      "South Mumbai & Lower Parel",
    ],
  },
  Pune: {
    icon: "🏰",
    tagline: "Cultural Hub • Luxury Recliner Cinemas",
    regions: [
      "Viman Nagar & Kalyani Nagar",
      "Wakad & Pimpri-Chinchwad",
      "Koregaon Park & Aundh",
    ],
  },
  Bengaluru: {
    icon: "🌳",
    tagline: "Silicon Valley • Laser 4DX Arenas",
    regions: [
      "MG Road & Indiranagar",
      "Koramangala & Central",
      "Whitefield & Marathahalli",
    ],
  },
  "Delhi NCR": {
    icon: "🏛️",
    tagline: "Capital Region • Director's Cut Lounges",
    regions: [
      "Vasant Kunj & South Delhi",
      "Connaught Place & Central",
      "Gurugram & Noida",
    ],
  },
};

// Extracts sub-region from screen_name or maps theater name to a logical sub-region
const deriveShowtimeSubRegion = (st) => {
  if (st.screen_name && st.screen_name.includes("•")) {
    return st.screen_name.split("•")[1].trim();
  }
  const tName = (st.theater_name || "").toLowerCase();
  const city = st.city || "Pune";
  const cityRegions = CITY_REGION_DIRECTORY[city]?.regions || [
    "Central Multiplex Zone",
    "West Mall District",
  ];
  if (
    tName.includes("oberoi") ||
    tName.includes("andheri") ||
    tName.includes("viman") ||
    tName.includes("forum") ||
    tName.includes("ambience")
  ) {
    return cityRegions[0];
  }
  if (
    tName.includes("bkc") ||
    tName.includes("jio") ||
    tName.includes("elpro") ||
    tName.includes("mantri") ||
    tName.includes("nehru")
  ) {
    return cityRegions[1] || cityRegions[0];
  }
  return cityRegions[2] || cityRegions[0];
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
  const [coldStartBanner, setColdStartBanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Auto-Slider Hero State
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);

  // City & Region Onboarding Modal State
  const [userCity, setUserCity] = useState(
    () => localStorage.getItem("bms_city") || "",
  );
  const [userSubRegion, setUserSubRegion] = useState(
    () => localStorage.getItem("bms_subregion") || "",
  );
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [tempCity, setTempCity] = useState("");
  const [pendingMovieId, setPendingMovieId] = useState(null);

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

  // Task 3 State: Selected Movie Details, City + Sub-Region Filter & Reviews
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [activePoster, setActivePoster] = useState("");
  const [detailCity, setDetailCity] = useState("");
  const [detailSubRegion, setDetailSubRegion] = useState("");
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [isEditingReview, setIsEditingReview] = useState(false);

  // Task 5 & 4 State: Live Seat Map, 2-Min Hold, Payment & Confirmation Screen
  const [seatLayout, setSeatLayout] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [bookingConfirmedData, setBookingConfirmedData] = useState(null);
  const [qrModalTicket, setQrModalTicket] = useState(null);

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
    const coldTimer = setTimeout(() => setColdStartBanner(true), 2500);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    fetch(`${API_BASE}/movies/discover/?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setMovies(d.results || []);
        setTotalMatches(d.total_matching_movies || 0);
        setHeroIndex(0);
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(coldTimer);
        setColdStartBanner(false);
        setLoadingMovies(false);
      });
  }, [filters]);

  // Auto-advance Trending Hero Carousel every 4.5 seconds
  const heroSlides =
    movies.length > 0 ? movies.slice(0, 6) : recommended.slice(0, 6);
  useEffect(() => {
    if (activeTab !== "discover" || isHeroPaused || heroSlides.length <= 1)
      return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [activeTab, isHeroPaused, heroSlides.length]);

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

  // Intercept movie click if new user hasn't picked a City & Sub-Region yet
  const handleMovieClick = (movieId) => {
    if (!userCity) {
      setPendingMovieId(movieId);
      setTempCity("Mumbai");
      setShowLocationModal(true);
      return;
    }
    openMovieDetail(movieId, userCity, userSubRegion);
  };

  const handleConfirmLocationSelection = (chosenCity, chosenRegion) => {
    localStorage.setItem("bms_city", chosenCity);
    localStorage.setItem("bms_subregion", chosenRegion);
    setUserCity(chosenCity);
    setUserSubRegion(chosenRegion);
    setDetailCity(chosenCity);
    setDetailSubRegion(chosenRegion);
    setShowLocationModal(false);
    notify(
      `Location set to ${chosenRegion ? `${chosenRegion}, ` : ""}${chosenCity}`,
    );

    if (pendingMovieId) {
      const targetId = pendingMovieId;
      setPendingMovieId(null);
      openMovieDetail(targetId, chosenCity, chosenRegion);
    }
  };

  const openMovieDetail = async (
    movieId,
    overrideCity = null,
    overrideRegion = null,
  ) => {
    const res = await fetch(`${API_BASE}/movies/${movieId}/`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    setSelectedMovie(data);
    setActivePoster(getMoviePoster(data));

    const targetCity = overrideCity !== null ? overrideCity : userCity || "";
    const targetRegion =
      overrideRegion !== null ? overrideRegion : userSubRegion || "";
    setDetailCity(targetCity);
    setDetailSubRegion(targetRegion);

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
      openMovieDetail(selectedMovie.id, detailCity, detailSubRegion);
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
      openMovieDetail(selectedMovie.id, detailCity, detailSubRegion);
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
    setBookingConfirmedData(null);
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
        const confirmedSummary = {
          booking_id: activeBooking.booking_id,
          movie_title: seatLayout.movie_title,
          theater_name: seatLayout.theater_name,
          screen_name: seatLayout.screen_name,
          seats: selectedSeats.map((s) => s.code),
          total_amount: activeBooking.total_amount,
          payment_ref: data.payment_reference_id || payload.razorpay_payment_id,
        };
        setBookingConfirmedData(confirmedSummary);
        notify("Payment Confirmed! PDF Ticket & QR Email Dispatched.");
        await fetchMyBookings();
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
    setAuthLoading(true);
    try {
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
    } catch {
      notify(
        "Network error while connecting to server. Please try again.",
        "error",
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const currentHeroMovie = heroSlides[heroIndex] || heroSlides[0];
  const upNextSlides = heroSlides
    .filter((_, idx) => idx !== heroIndex)
    .slice(0, 3);

  const activeFilterCount = [
    filters.genre,
    filters.language,
    filters.city,
    filters.min_rating,
    filters.show_window,
  ].filter(Boolean).length;
  const hasActiveFilters = Boolean(filters.search || activeFilterCount > 0);

  // Enhance showtimes with derived sub-regions & provide multi-city fallback if backend only has 1 city seeded
  const enrichedShowtimes = React.useMemo(() => {
    const raw = selectedMovie?.showtimes || [];
    const mapped = raw.map((st) => ({
      ...st,
      sub_region: deriveShowtimeSubRegion(st),
    }));

    const distinctCities = new Set(mapped.map((s) => s.city));
    // If the live Render DB hasn't run seed_multicity_showtimes yet, synthesize regional multiplex options from existing showtimes
    if (distinctCities.size <= 1 && mapped.length > 0) {
      const expanded = [...mapped];
      Object.entries(CITY_REGION_DIRECTORY).forEach(([cityName, info]) => {
        info.regions.forEach((reg, rIdx) => {
          const baseSt = mapped[rIdx % mapped.length];
          if (cityName !== baseSt.city || rIdx > 0) {
            expanded.push({
              ...baseSt,
              ui_key: `${baseSt.id}-${cityName}-${rIdx}`,
              city: cityName,
              sub_region: reg,
              theater_name:
                rIdx === 0
                  ? `PVR ICON: Phoenix Mall (${reg.split("&")[0].trim()})`
                  : rIdx === 1
                    ? `INOX Laserplex (${reg.split("&")[0].trim()})`
                    : `Cinepolis VIP Lounge (${reg.split("&")[0].trim()})`,
              screen_name: `IMAX 3D • ${reg}`,
            });
          }
        });
      });
      return expanded;
    }
    return mapped;
  }, [selectedMovie]);

  const availableCitiesForMovie = Array.from(
    new Set(enrichedShowtimes.map((s) => s.city)),
  );
  const availableSubRegionsForCity = Array.from(
    new Set(
      enrichedShowtimes
        .filter((s) => !detailCity || s.city === detailCity)
        .map((s) => s.sub_region),
    ),
  );

  const filteredMovieShowtimes = enrichedShowtimes.filter((st) => {
    const matchCity = !detailCity || st.city === detailCity;
    const matchRegion = !detailSubRegion || st.sub_region === detailSubRegion;
    return matchCity && matchRegion;
  });

  const baseSeatSubtotal =
    selectedSeats.length * (seatLayout?.ticket_price || 0);
  const convenienceFee = selectedSeats.length * 30;
  const gstAmount = Math.round(convenienceFee * 0.18);

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white pb-20 sm:pb-0">
      {/* Full-Screen Sign-In / Registration Loading Overlay */}
      {authLoading && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">
                {authForm.action === "login"
                  ? "Signing You In..."
                  : "Creating Your Account..."}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Verifying credentials with the cloud cinema server. Please
                wait...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BookMyShow-Style 2-Step City & Sub-Region Selection Popup Modal */}
      {showLocationModal && (
        <div
          onClick={() => setShowLocationModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-indigo-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-bold opacity-90">
                    Step 1 & 2 • Personalize Multiplexes
                  </span>
                  <h3 className="font-black text-lg leading-tight">
                    Select Your City & Local Region
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowLocationModal(false)}
                className="p-1.5 rounded-full bg-black/20 hover:bg-black/40 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Step 1: Pick City */}
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-2.5">
                  1. Choose Your City
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {Object.entries(CITY_REGION_DIRECTORY).map(
                    ([cityName, info]) => {
                      const isSelected =
                        (tempCity || userCity || "Mumbai") === cityName;
                      return (
                        <button
                          key={cityName}
                          onClick={() => setTempCity(cityName)}
                          className={`p-3 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                            isSelected
                              ? "bg-rose-600/20 border-rose-500 text-white shadow-lg shadow-rose-600/15"
                              : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <span className="text-2xl">{info.icon}</span>
                          <span className="font-bold text-xs">{cityName}</span>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Step 2: Pick Sub-Region inside selected City */}
              <div className="pt-2 border-t border-slate-800">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-2.5">
                  2. Select Preferred Region in{" "}
                  {tempCity || userCity || "Mumbai"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={() =>
                      handleConfirmLocationSelection(
                        tempCity || userCity || "Mumbai",
                        "",
                      )
                    }
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-rose-500 text-left flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-rose-400">
                        All Regions in {tempCity || userCity || "Mumbai"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Show all multiplexes across the city
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400" />
                  </button>

                  {(
                    CITY_REGION_DIRECTORY[tempCity || userCity || "Mumbai"]
                      ?.regions || []
                  ).map((reg) => (
                    <button
                      key={reg}
                      onClick={() =>
                        handleConfirmLocationSelection(
                          tempCity || userCity || "Mumbai",
                          reg,
                        )
                      }
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-rose-500 text-left flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-white group-hover:text-rose-400">
                          {reg}
                        </p>
                        <p className="text-[10px] text-emerald-400">
                          IMAX & Recliner Theaters Available
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive QR Ticket Stub Modal */}
      {qrModalTicket && (
        <div
          onClick={() => setQrModalTicket(null)}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl"
          >
            <div className="bg-gradient-to-r from-rose-600 to-rose-500 p-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-bold opacity-90">
                  BookMySeat Verified Pass
                </span>
                <h3 className="font-black text-lg leading-tight mt-0.5">
                  {qrModalTicket.movie_title}
                </h3>
              </div>
              <button
                onClick={() => setQrModalTicket(null)}
                className="p-1.5 rounded-full bg-black/20 hover:bg-black/40 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-center">
              <div className="bg-white p-4 rounded-2xl inline-block mx-auto shadow-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=BOOKMYSEAT-${qrModalTicket.booking_id}`}
                  alt="Ticket QR Code"
                  className="w-36 h-36 mx-auto"
                />
              </div>
              <p className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 py-1 px-3 rounded-full inline-block">
                BOOKING ID: #
                {qrModalTicket.booking_id.slice(0, 8).toUpperCase()}
              </p>

              <div className="text-left bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Theater</span>
                  <strong className="text-white text-right">
                    {qrModalTicket.theater_name}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Screen</span>
                  <strong className="text-slate-300">
                    {qrModalTicket.screen_name}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Reserved Seats</span>
                  <strong className="text-emerald-400">
                    {Array.isArray(qrModalTicket.seats)
                      ? qrModalTicket.seats
                          .map((s) => s.seat_code || s)
                          .join(", ")
                      : "Confirmed"}
                  </strong>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800">
                  <span className="text-slate-500">Amount Paid</span>
                  <strong className="text-white text-sm">
                    ₹{qrModalTicket.total_amount}
                  </strong>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => handleDownloadTicket(qrModalTicket.booking_id)}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download Official PDF
                </button>
                <button
                  onClick={() => setQrModalTicket(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-16 sm:top-auto sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md text-xs sm:text-sm font-semibold transition-all duration-300 ${
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
          <span className="line-clamp-2">{toast.msg}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#090D16]/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("discover")}
              className="flex items-center gap-2 text-left group cursor-pointer"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-600/30 shrink-0">
                <Film className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <span className="font-black text-lg sm:text-xl tracking-tight text-white">
                  BookMy<span className="text-rose-500">Seat</span>
                </span>
                <span className="block text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-400 -mt-1">
                  IMAX & Multiplex
                </span>
              </div>
            </button>

            {/* City / Region Selector Pill in Navbar */}
            <button
              onClick={() => {
                setTempCity(userCity || "Mumbai");
                setShowLocationModal(true);
              }}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] sm:text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer transition"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="truncate max-w-[90px] sm:max-w-[160px]">
                {userCity
                  ? userSubRegion
                    ? `${userCity} (${userSubRegion.split("&")[0].trim()})`
                    : userCity
                  : "Select City"}
              </span>
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden sm:flex items-center gap-2 text-sm">
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
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab("login")}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-bold shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </nav>

          {/* Mobile Right User Pill */}
          <div className="flex sm:hidden items-center gap-1.5">
            {auth ? (
              <button
                onClick={() => {
                  localStorage.removeItem("bms_auth");
                  setAuth(null);
                  setActiveTab("discover");
                }}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400"
                aria-label="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setActiveTab("login")}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-md shadow-rose-600/25"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8">
        {coldStartBanner && (
          <div className="bg-indigo-950/80 border border-indigo-500/40 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-indigo-200">
            <Server className="w-5 h-5 text-indigo-400 animate-pulse shrink-0" />
            <div>
              <strong className="text-white block">
                Waking up cloud cinema server on Render...
              </strong>
              <span>
                Free-tier cloud instances take ~20–30 seconds on initial load.
                Movies will appear momentarily!
              </span>
            </div>
          </div>
        )}

        {/* TAB 1: DISCOVER WITH AUTO-SLIDING CAROUSEL & GAP-FILLED SPOTLIGHT */}
        {activeTab === "discover" && (
          <div className="space-y-5 sm:space-y-8">
            {currentHeroMovie && !hasActiveFilters && (
              <div
                onMouseEnter={() => setIsHeroPaused(true)}
                onMouseLeave={() => setIsHeroPaused(false)}
                className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-800/90 bg-slate-950 shadow-2xl"
              >
                {/* Blurred Atmospheric Poster Background to Eliminate Any Empty Space */}
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-25 blur-2xl scale-110 transition-all duration-700"
                  style={{
                    backgroundImage: `url(${getMoviePoster(currentHeroMovie)})`,
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#090D16] via-[#090D16]/85 to-rose-950/40" />

                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 items-center p-4 sm:p-8 lg:p-10 gap-6">
                  {/* Left 5 Columns: Movie Title, Synopsis, Metadata & Actions */}
                  <div className="lg:col-span-5 space-y-3 sm:space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[11px] font-extrabold">
                        <Flame className="w-3.5 h-3.5 fill-current" /> #
                        {heroIndex + 1} Trending Spotlight
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        IMAX 3D & Dolby Atmos
                      </span>
                    </div>

                    <h1
                      onClick={() => handleMovieClick(currentHeroMovie.id)}
                      className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight cursor-pointer hover:text-rose-400 transition"
                    >
                      {currentHeroMovie.title}
                    </h1>

                    {/* Synopsis Fills the Center Visual Space Naturally */}
                    <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 sm:line-clamp-3 leading-relaxed">
                      {currentHeroMovie.description ||
                        "Experience this blockbuster in breathtaking IMAX Laser projection and immersive 64-channel Dolby Atmos sound at a multiplex near you."}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
                      <span className="bg-amber-400 text-slate-950 font-black px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-current" />{" "}
                        {currentHeroMovie.average_rating} / 5
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700 font-bold">
                        {currentHeroMovie.age_certification}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700">
                        {currentHeroMovie.duration_minutes} mins
                      </span>
                      {currentHeroMovie.genres?.map((g) => (
                        <span
                          key={g.id}
                          className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-800/50 text-rose-200 font-semibold"
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>

                    <div className="pt-1 flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => handleMovieClick(currentHeroMovie.id)}
                        className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-rose-600/30 cursor-pointer transition"
                      >
                        <Ticket className="w-4 h-4" /> Book Tickets Now
                      </button>
                      <button
                        onClick={() => {
                          setTempCity(userCity || "Mumbai");
                          setPendingMovieId(currentHeroMovie.id);
                          setShowLocationModal(true);
                        }}
                        className="px-4 py-2.5 sm:py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <MapPin className="w-4 h-4 text-rose-400" />
                        {userCity ? `Theaters in ${userCity}` : "Choose City"}
                      </button>
                    </div>
                  </div>

                  {/* Center 4 Columns: "Recommended / Up Next" Queue Cards Filling the Middle Gap */}
                  <div className="hidden lg:flex lg:col-span-4 flex-col justify-center space-y-2.5 bg-slate-950/65 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Recommended Queue
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Auto-Sliding • Click to Switch
                      </span>
                    </div>

                    {upNextSlides.map((slide) => (
                      <div
                        key={slide.id}
                        onClick={() => {
                          const targetIdx = heroSlides.findIndex(
                            (h) => h.id === slide.id,
                          );
                          if (targetIdx !== -1) setHeroIndex(targetIdx);
                        }}
                        className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800/80 hover:border-rose-500/50 transition cursor-pointer group"
                      >
                        <img
                          src={getMoviePoster(slide)}
                          onError={handleImgError}
                          alt={slide.title}
                          className="w-11 h-16 object-cover rounded-lg shrink-0 border border-slate-700"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white group-hover:text-rose-400 truncate">
                            {slide.title}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {slide.genres?.map((g) => g.name).join(" • ")}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-extrabold text-amber-400">
                              ★ {slide.average_rating}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-bold">
                              ₹{slide.min_ticket_price || 200}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 shrink-0" />
                      </div>
                    ))}
                  </div>

                  {/* Right 3 Columns: Active Featured Movie Poster */}
                  <div className="lg:col-span-3 flex justify-center lg:justify-end">
                    <div
                      onClick={() => handleMovieClick(currentHeroMovie.id)}
                      className="relative group cursor-pointer"
                    >
                      <img
                        src={getMoviePoster(currentHeroMovie)}
                        onError={handleImgError}
                        alt={currentHeroMovie.title}
                        className="w-40 sm:w-52 lg:w-56 aspect-[2/3] object-cover rounded-2xl shadow-2xl border-2 border-slate-700/80 group-hover:scale-105 transition duration-500"
                      />
                      <span className="absolute bottom-3 left-3 right-3 bg-slate-950/90 backdrop-blur-md border border-slate-700 text-center py-1.5 rounded-xl text-[11px] font-bold text-white opacity-0 group-hover:opacity-100 transition">
                        Select City & Showtimes →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Carousel Controls & Slide Indicators */}
                {heroSlides.length > 1 && (
                  <div className="relative z-10 px-4 sm:px-8 pb-4 flex items-center justify-between border-t border-slate-800/60 pt-3">
                    <div className="flex items-center gap-2">
                      {heroSlides.map((s, idx) => (
                        <button
                          key={s.id}
                          onClick={() => setHeroIndex(idx)}
                          className={`h-2 rounded-full transition-all cursor-pointer ${
                            idx === heroIndex
                              ? "w-8 bg-rose-500"
                              : "w-2 bg-slate-700 hover:bg-slate-500"
                          }`}
                          aria-label={`Slide ${idx + 1}`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setHeroIndex(
                            (prev) =>
                              (prev - 1 + heroSlides.length) %
                              heroSlides.length,
                          )
                        }
                        className="p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                        aria-label="Previous Slide"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setHeroIndex((prev) => (prev + 1) % heroSlides.length)
                        }
                        className="p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                        aria-label="Next Slide"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search & Collapsible Filters */}
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3.5 sm:p-5 shadow-xl space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search movies, actors..."
                    value={filters.search}
                    onChange={(e) =>
                      setFilters({ ...filters, search: e.target.value })
                    }
                    className="w-full pl-9 pr-8 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm focus:border-rose-500 outline-none"
                  />
                  {filters.search && (
                    <button
                      onClick={() => setFilters({ ...filters, search: "" })}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className={`sm:hidden px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 ${
                    showMobileFilters || activeFilterCount > 0
                      ? "bg-rose-600/20 border-rose-500 text-rose-300"
                      : "bg-slate-950 border-slate-800 text-slate-300"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                </button>
              </div>

              <div
                className={`${showMobileFilters ? "grid" : "hidden sm:grid"} grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-1`}
              >
                <select
                  value={filters.genre}
                  onChange={(e) =>
                    setFilters({ ...filters, genre: e.target.value })
                  }
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-rose-500"
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
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-rose-500"
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
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-rose-500"
                >
                  <option value="">All Cities</option>
                  {Object.keys(CITY_REGION_DIRECTORY).map((c) => (
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
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-rose-500"
                >
                  <option value="-total_bookings_count">
                    Sort: Popularity
                  </option>
                  <option value="-release_date">Sort: Newest</option>
                  <option value="-average_rating">Sort: Rating</option>
                  <option value="min_ticket_price">Sort: Price</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 max-w-full">
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
                      className={`px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer ${
                        filters.show_window === w.id
                          ? "bg-rose-600 text-white"
                          : "bg-slate-950 border border-slate-800 text-slate-300"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="text-[11px] text-rose-400 font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Reset
                    </button>
                  )}
                  <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 font-bold text-rose-400 text-[11px]">
                    {totalMatches} {totalMatches === 1 ? "Movie" : "Movies"}
                  </span>
                </div>
              </div>
            </div>

            {/* Movie Grid */}
            <section className="space-y-3 sm:space-y-4">
              <h2 className="text-base sm:text-xl font-extrabold tracking-tight flex items-center gap-2">
                <Film className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" /> Now
                Showing in Cinemas
              </h2>

              {loadingMovies ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-6">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="aspect-[2/3] rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse"
                    />
                  ))}
                </div>
              ) : movies.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center space-y-3">
                  <Film className="w-8 h-8 text-slate-500 mx-auto" />
                  <h3 className="text-sm sm:text-lg font-bold">
                    No Movies Match Your Filters
                  </h3>
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 bg-rose-600 rounded-xl text-xs font-bold text-white"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-6">
                  {movies.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleMovieClick(m.id)}
                      className="group bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden cursor-pointer hover:border-rose-500/60 transition-all duration-300 shadow-lg flex flex-col"
                    >
                      <div className="aspect-[2/3] bg-slate-800 relative overflow-hidden">
                        <img
                          src={getMoviePoster(m)}
                          onError={handleImgError}
                          alt={m.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-85" />
                        <span className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-slate-950/85 backdrop-blur-md border border-slate-700 px-2 py-0.5 rounded-md text-[10px] font-extrabold">
                          {m.age_certification}
                        </span>
                        <span className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md text-[11px] font-black flex items-center gap-0.5 shadow-md">
                          <Star className="w-3 h-3 fill-current" />{" "}
                          {m.average_rating}
                        </span>
                      </div>

                      <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between space-y-2">
                        <div>
                          <h3 className="font-bold text-xs sm:text-base text-white group-hover:text-rose-400 transition line-clamp-1">
                            {m.title}
                          </h3>
                          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
                            {m.genres?.map((g) => g.name).join(" • ")}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                            {m.languages?.map((l) => l.name).join(", ")}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] sm:text-xs">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {m.duration_minutes}m
                          </span>
                          <span className="font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                            ₹{m.min_ticket_price || "200"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recommended Section */}
            {recommended.length > 0 && (
              <section className="pt-4 sm:pt-6 border-t border-slate-800/80 space-y-3 sm:space-y-4">
                <div>
                  <h2 className="text-base sm:text-xl font-extrabold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />{" "}
                    Recommended for You
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    {recStrategy === "personalized_history"
                      ? "Based on your bookings & views"
                      : "Top trending picks across cinemas"}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {recommended.slice(0, 4).map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleMovieClick(m.id)}
                      className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl cursor-pointer hover:border-amber-500/50 transition flex items-center gap-3 shadow-md"
                    >
                      <img
                        src={getMoviePoster(m)}
                        onError={handleImgError}
                        alt={m.title}
                        className="w-14 h-20 sm:w-16 sm:h-24 object-cover rounded-xl shrink-0 border border-slate-700"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold">
                          ★ {m.average_rating} Rated
                        </span>
                        <h4 className="font-bold text-xs sm:text-sm text-white truncate">
                          {m.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate">
                          {m.genres?.map((g) => g.name).join(", ")}
                        </p>
                        <p className="text-[11px] font-bold text-rose-400 flex items-center gap-0.5">
                          Book Tickets <ChevronRight className="w-3 h-3" />
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 2: MOVIE DETAILS WITH 2-LEVEL CITY + SUB-REGION THEATER FILTER */}
        {activeTab === "detail" && selectedMovie && (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => setActiveTab("discover")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Movies
              </button>

              <button
                onClick={() => {
                  setTempCity(detailCity || userCity || "Mumbai");
                  setShowLocationModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/15 border border-rose-500/40 text-xs font-bold text-rose-300 hover:bg-rose-600/25 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" /> Change City / Region
                Popup
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl">
              <div className="lg:col-span-4 flex flex-col items-center sm:items-stretch space-y-3">
                <img
                  src={getMoviePoster(selectedMovie, activePoster)}
                  onError={handleImgError}
                  alt={selectedMovie.title}
                  className="w-48 sm:w-full aspect-[2/3] rounded-2xl object-cover shadow-2xl border border-slate-700"
                />
                {selectedMovie.posters?.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 justify-center sm:justify-start w-full">
                    {selectedMovie.posters.map((p) => (
                      <img
                        key={p.id}
                        src={p.image_url}
                        onError={handleImgError}
                        alt="Poster thumbnail"
                        onClick={() => setActivePoster(p.image_url)}
                        className={`w-12 h-18 sm:w-16 sm:h-24 object-cover rounded-xl cursor-pointer border-2 transition ${
                          activePoster === p.image_url
                            ? "border-rose-500 scale-105"
                            : "border-slate-800 opacity-60"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-8 space-y-4 sm:space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="text-xl sm:text-4xl font-black text-white">
                      {selectedMovie.title}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedMovie.genres?.map((g) => g.name).join(" • ")} |{" "}
                      {selectedMovie.languages?.map((l) => l.name).join(", ")}
                    </p>
                  </div>
                  <div className="bg-amber-400 text-slate-950 px-3 py-1.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1 shadow-lg">
                    <Star className="w-3.5 h-3.5 fill-current" />{" "}
                    {selectedMovie.average_rating} / 5.0
                  </div>
                </div>

                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  {selectedMovie.description}
                </p>

                <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs font-semibold">
                  <span className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                    Rated:{" "}
                    <strong className="text-rose-400">
                      {selectedMovie.age_certification}
                    </strong>
                  </span>
                  <span className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                    Duration: <strong>{selectedMovie.duration_minutes}m</strong>
                  </span>
                  <span className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                    Release: <strong>{selectedMovie.release_date}</strong>
                  </span>
                </div>

                {selectedMovie.cast?.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Cast & Crew
                    </h3>
                    <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
                      {selectedMovie.cast.map((c) => (
                        <div
                          key={c.id}
                          className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 shrink-0"
                        >
                          <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center">
                            {c.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-white whitespace-nowrap">
                              {c.name}
                            </p>
                            <p className="text-[10px] text-slate-400 whitespace-nowrap">
                              as {c.role_name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedMovie.secure_trailer_embed_url && (
                  <div className="pt-1">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 text-rose-500 fill-current" />{" "}
                      Official Trailer
                    </h3>
                    <div className="aspect-video w-full rounded-xl sm:rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-xl">
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

            {/* 2-Level City + Sub-Region Multiplex Filter Section */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base sm:text-xl font-extrabold flex items-center gap-2">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />{" "}
                    Select Multiplex & Showtime
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Showing theaters in{" "}
                    <strong className="text-white">
                      {detailCity || "All Cities"}
                    </strong>
                    {detailSubRegion ? ` • ${detailSubRegion}` : ""}
                  </p>
                </div>

                {/* Level 1: City Selector Tabs */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-semibold mr-1">
                    1. City:
                  </span>
                  <button
                    onClick={() => {
                      setDetailCity("");
                      setDetailSubRegion("");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      detailCity === ""
                        ? "bg-rose-600 text-white shadow-md shadow-rose-600/25"
                        : "bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    All Cities
                  </button>
                  {availableCitiesForMovie.map((city) => (
                    <button
                      key={city}
                      onClick={() => {
                        setDetailCity(city);
                        setDetailSubRegion("");
                        localStorage.setItem("bms_city", city);
                        setUserCity(city);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        detailCity === city
                          ? "bg-rose-600 text-white shadow-md shadow-rose-600/25"
                          : "bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      {CITY_REGION_DIRECTORY[city]?.icon || "📍"} {city}
                    </button>
                  ))}
                </div>
              </div>

              {/* Level 2: Sub-Region Filter Pills inside the Selected City */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
                <span className="text-xs text-indigo-400 font-bold flex items-center gap-1 mr-1">
                  <MapPin className="w-3.5 h-3.5" /> 2. Filter by Local Region:
                </span>
                <button
                  onClick={() => {
                    setDetailSubRegion("");
                    localStorage.setItem("bms_subregion", "");
                    setUserSubRegion("");
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    detailSubRegion === ""
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  All Regions in {detailCity || "India"}
                </button>
                {availableSubRegionsForCity.map((subReg) => (
                  <button
                    key={subReg}
                    onClick={() => {
                      setDetailSubRegion(subReg);
                      localStorage.setItem("bms_subregion", subReg);
                      setUserSubRegion(subReg);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      detailSubRegion === subReg
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    {subReg}
                  </button>
                ))}
              </div>

              {filteredMovieShowtimes.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-sm text-slate-400">
                    No showtimes found for this region filter.
                  </p>
                  <button
                    onClick={() => {
                      setDetailCity("");
                      setDetailSubRegion("");
                    }}
                    className="px-4 py-1.5 bg-rose-600 rounded-xl text-xs font-bold text-white cursor-pointer"
                  >
                    Show All Multiplexes
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {filteredMovieShowtimes.map((st) => (
                    <button
                      key={st.ui_key || st.id}
                      onClick={() => openSeatMap(st.id)}
                      className="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-rose-500 text-left transition group flex items-center justify-between cursor-pointer"
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          {st.city} • {st.sub_region}
                        </span>
                        <p className="font-bold text-xs sm:text-sm text-white group-hover:text-rose-400 truncate pt-0.5">
                          {st.theater_name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {st.screen_name}
                        </p>
                        <p className="text-xs text-emerald-400 font-semibold pt-0.5">
                          {new Date(st.start_time).toLocaleString([], {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="bg-rose-600/15 border border-rose-500/40 text-rose-300 px-2.5 py-1 rounded-xl text-xs font-extrabold block">
                          ₹{st.ticket_price}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Select Seats →
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Verified Reviews */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4">
                <h3 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" /> Verified
                  Reviews ({selectedMovie.reviews?.length || 0})
                </h3>
                {selectedMovie.reviews?.length === 0 ? (
                  <p className="text-xs sm:text-sm text-slate-400 py-4">
                    No reviews yet. Book and watch this movie to post the first
                    verified review!
                  </p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {selectedMovie.reviews?.map((rv) => (
                      <div
                        key={rv.id}
                        className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5 truncate">
                            {rv.username}
                            {rv.is_verified_viewer && (
                              <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-700/70 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                <ShieldCheck className="w-2.5 h-2.5" /> Verified
                              </span>
                            )}
                          </span>
                          <span className="text-xs font-black bg-amber-400/15 text-amber-300 px-2 py-0.5 rounded-lg shrink-0">
                            ★ {rv.rating}/5
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
                            className="text-[10px] text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            Report
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={handleReviewSubmit}
                className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 self-start"
              >
                <h3 className="text-base sm:text-lg font-extrabold">
                  {isEditingReview
                    ? "Edit Verified Review"
                    : "Post Verified Review"}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Only users with a confirmed booking can submit or edit a
                  review.
                </p>
                <div className="flex gap-1.5">
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
                <textarea
                  rows={3}
                  required
                  value={reviewForm.comment}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, comment: e.target.value })
                  }
                  placeholder="Share your experience..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 sm:py-3 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-rose-600/20 cursor-pointer"
                >
                  {isEditingReview ? "Update Review" : "Submit Review"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: SEAT SELECTION & BOOKING CONFIRMATION TICK SCREEN */}
        {activeTab === "seats" && seatLayout && (
          <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-12">
            {bookingConfirmedData ? (
              <div className="max-w-lg mx-auto bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl my-4">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30 animate-bounce">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-widest text-emerald-400 font-black">
                    Payment Verified • Booking Confirmed
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    Tickets Booked Successfully!
                  </h2>
                  <p className="text-xs text-slate-400">
                    Your official PDF e-ticket and QR pass have been generated.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-left space-y-3">
                  <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="font-black text-base sm:text-lg text-white">
                        {bookingConfirmedData.movie_title}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {bookingConfirmedData.theater_name} •{" "}
                        {bookingConfirmedData.screen_name}
                      </p>
                    </div>
                    <span className="bg-emerald-950 text-emerald-400 border border-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-extrabold">
                      CONFIRMED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">
                        Booked Seats
                      </span>
                      <strong className="text-emerald-400 text-sm">
                        {bookingConfirmedData.seats.join(", ")}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">
                        Amount Paid
                      </span>
                      <strong className="text-white text-sm">
                        ₹{bookingConfirmedData.total_amount}
                      </strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px] uppercase">
                        Booking Reference
                      </span>
                      <span className="font-mono text-slate-300 text-[11px]">
                        #
                        {bookingConfirmedData.booking_id
                          .slice(0, 8)
                          .toUpperCase()}{" "}
                        ({bookingConfirmedData.payment_ref})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() =>
                      handleDownloadTicket(bookingConfirmedData.booking_id)
                    }
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-xs sm:text-sm text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Download PDF Ticket
                  </button>
                  <button
                    onClick={() => setQrModalTicket(bookingConfirmedData)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-bold text-xs sm:text-sm text-emerald-400 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" /> View QR Pass
                  </button>
                </div>

                <button
                  onClick={() => {
                    setBookingConfirmedData(null);
                    setActiveTab("bookings");
                  }}
                  className="w-full py-2.5 text-xs font-bold text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  Go to All My Booked Tickets →
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl sm:rounded-3xl">
                  <div>
                    <button
                      onClick={() => setActiveTab("detail")}
                      className="text-xs text-rose-400 font-semibold mb-1 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Change Showtime
                    </button>
                    <h2 className="text-base sm:text-xl font-black text-white">
                      {seatLayout.movie_title}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-400">
                      {seatLayout.theater_name} • {seatLayout.screen_name} •{" "}
                      <span className="text-emerald-400 font-bold">
                        ₹{seatLayout.ticket_price}/seat
                      </span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-4 text-[11px] font-semibold pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-slate-950 border border-slate-600 inline-block" />{" "}
                      Available ({seatLayout.summary.available_seats})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block" />{" "}
                      Selected ({selectedSeats.length})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-amber-500/30 border border-amber-500 inline-block" />{" "}
                      Held ({seatLayout.summary.reserved_seats})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded bg-rose-900/60 border border-rose-700 inline-block" />{" "}
                      Booked ({seatLayout.summary.booked_seats})
                    </span>
                  </div>
                </div>

                <div className="sm:hidden flex items-center justify-center gap-1.5 text-[11px] text-slate-400 bg-slate-900/70 py-1.5 rounded-xl border border-slate-800">
                  <MoveHorizontal className="w-3.5 h-3.5 text-rose-400" /> Swipe
                  left/right to view all seats
                </div>

                <div className="text-center space-y-1.5 py-1">
                  <div className="w-4/5 max-w-2xl mx-auto h-2.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent rounded-full shadow-[0_12px_35px_rgba(244,63,94,0.6)]" />
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
                    IMAX Screen This Way
                  </p>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 overflow-x-auto shadow-inner">
                  <div className="min-w-[560px] space-y-2 flex flex-col items-center">
                    {seatLayout.seat_map.map((row) => (
                      <div
                        key={row.row_label}
                        className="flex items-center gap-1.5 sm:gap-2"
                      >
                        <span className="w-5 text-[11px] font-extrabold text-slate-400 text-center">
                          {row.row_label}
                        </span>
                        {row.seats.map((s, idx) => {
                          const isSelected = selectedSeats.some(
                            (sel) => sel.code === s.seat_code,
                          );
                          let btnClass =
                            "bg-slate-950 border-slate-700 text-slate-300 hover:border-rose-400 cursor-pointer";
                          if (s.status === "BOOKED")
                            btnClass =
                              "bg-rose-950/60 border-rose-800/70 text-rose-400/50 cursor-not-allowed";
                          else if (s.status === "RESERVED")
                            btnClass =
                              "bg-amber-500/20 border border-amber-500 text-amber-300 cursor-not-allowed";
                          else if (isSelected)
                            btnClass =
                              "bg-emerald-500 border-emerald-300 text-slate-950 font-black scale-105 shadow-md shadow-emerald-500/30 cursor-pointer";

                          return (
                            <React.Fragment key={s.seat_code}>
                              {idx === 6 && <span className="w-4 sm:w-5" />}
                              <button
                                onClick={() =>
                                  toggleSeatSelection(
                                    s.row_label,
                                    s.seat_number,
                                    s.status,
                                  )
                                }
                                disabled={
                                  s.status !== "AVAILABLE" ||
                                  Boolean(activeBooking)
                                }
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-t-lg rounded-b-sm border text-[10px] sm:text-[11px] transition-all ${btnClass}`}
                              >
                                {s.seat_number}
                              </button>
                            </React.Fragment>
                          );
                        })}
                        <span className="w-5 text-[11px] font-extrabold text-slate-400 text-center">
                          {row.row_label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sticky Checkout Footer */}
                <div className="fixed bottom-14 sm:bottom-4 left-2 right-2 sm:static z-30 bg-slate-900/95 backdrop-blur-xl border-2 border-slate-700 sm:border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex sm:block items-center justify-between">
                      <p className="text-xs sm:text-sm font-bold truncate max-w-[200px] sm:max-w-none">
                        Seats:{" "}
                        <span className="text-emerald-400 font-black">
                          {selectedSeats.map((s) => s.code).join(", ") ||
                            "None"}
                        </span>
                      </p>
                      <p className="text-xs text-slate-300">
                        Ticket Price:{" "}
                        <strong className="text-white text-sm sm:text-base">
                          ₹{baseSeatSubtotal.toLocaleString()}
                        </strong>
                      </p>
                    </div>
                    {selectedSeats.length > 0 && (
                      <p className="text-[10px] text-slate-400">
                        Includes Convenience Fee ₹{convenienceFee} + 18% GST (₹
                        {gstAmount})
                      </p>
                    )}
                  </div>

                  {!activeBooking ? (
                    <button
                      onClick={handleReserveSeats}
                      disabled={submitting || selectedSeats.length === 0}
                      className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-rose-600 to-rose-500 disabled:opacity-40 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-rose-600/25 cursor-pointer"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      {submitting
                        ? "Locking Seats..."
                        : "Lock Seats (2m Hold) & Pay"}
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <span className="px-3 py-1.5 rounded-xl bg-amber-950 border border-amber-500 text-amber-300 text-[11px] font-black flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 animate-spin" />{" "}
                        {formatTime(countdown)}
                      </span>
                      <button
                        onClick={() => handleVerifyPayment("SUCCESS")}
                        disabled={submitting}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
                      >
                        {submitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CreditCard className="w-3.5 h-3.5" />
                        )}
                        Pay ₹{activeBooking.total_amount}
                      </button>
                      <button
                        onClick={() => handleVerifyPayment("FAILED")}
                        disabled={submitting}
                        className="px-3 py-2.5 bg-rose-950 border border-rose-700 rounded-xl font-bold text-[11px] text-rose-200 cursor-pointer"
                      >
                        Fail Test
                      </button>
                      <button
                        onClick={handleReleaseHold}
                        className="px-2 py-2 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: MY TICKETS */}
        {activeTab === "bookings" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-2xl font-black">
                  My Digital Tickets
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  View on-screen QR pass or download official PDF tickets
                </p>
              </div>
              <button
                onClick={fetchMyBookings}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {myBookings.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center space-y-2">
                <Ticket className="w-8 h-8 text-slate-500 mx-auto" />
                <h3 className="text-sm sm:text-lg font-bold">
                  No Bookings Found
                </h3>
                <p className="text-xs text-slate-400">
                  Book seats on any showtime to get your PDF QR ticket.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {myBookings.map((b) => (
                  <div
                    key={b.booking_id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between"
                  >
                    <div className="p-4 sm:p-6 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase tracking-widest text-rose-400 font-bold">
                            {b.city || "Multiplex E-Ticket"}
                          </span>
                          <h3 className="font-black text-base sm:text-lg text-white">
                            {b.movie_title}
                          </h3>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
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

                      <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
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
                      </div>
                    </div>

                    <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-950/90 border-t border-dashed border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-slate-500">
                        ID: #{b.booking_id.slice(0, 8)}
                      </span>
                      {b.status === "CONFIRMED" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setQrModalTicket(b)}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-emerald-400 flex items-center gap-1.5 cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" /> QR Pass
                          </button>
                          <button
                            onClick={() => handleDownloadTicket(b.booking_id)}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ADMIN ANALYTICS */}
        {activeTab === "analytics" && analytics && (
          <div className="space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold">
                  Task 6 • High-Volume ORM Engine
                </span>
                <h2 className="text-lg sm:text-2xl font-black text-white mt-0.5">
                  Admin Analytics Dashboard
                </h2>
                <p className="text-[11px] sm:text-xs text-emerald-400 mt-1">
                  Aggregated{" "}
                  <strong>
                    {analytics.cancellation_and_refund_stats.total_bookings.toLocaleString()}
                  </strong>{" "}
                  rows in{" "}
                  <strong>{analytics.query_execution_time_ms} ms</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 text-xs">
                <input
                  type="date"
                  value={dateRange.start_date}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, start_date: e.target.value })
                  }
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs"
                />
                <input
                  type="date"
                  value={dateRange.end_date}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, end_date: e.target.value })
                  }
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs"
                />
                <button
                  onClick={fetchAnalytics}
                  className="px-3 py-2 bg-indigo-600 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Filter
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-2 bg-emerald-600 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl">
                <p className="text-[11px] text-slate-400">Total Revenue</p>
                <p className="text-base sm:text-xl font-black text-emerald-400 mt-1">
                  ₹
                  {Number(
                    analytics.revenue_insights.total_revenue,
                  ).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl">
                <p className="text-[11px] text-slate-400">Daily Revenue</p>
                <p className="text-base sm:text-xl font-black text-white mt-1">
                  ₹
                  {Number(
                    analytics.revenue_insights.daily_revenue,
                  ).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl">
                <p className="text-[11px] text-slate-400">Weekly (7d)</p>
                <p className="text-base sm:text-xl font-black text-indigo-400 mt-1">
                  ₹
                  {Number(
                    analytics.revenue_insights.weekly_revenue,
                  ).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl">
                <p className="text-[11px] text-slate-400">Monthly (30d)</p>
                <p className="text-base sm:text-xl font-black text-amber-400 mt-1">
                  ₹
                  {Number(
                    analytics.revenue_insights.monthly_revenue,
                  ).toLocaleString()}
                </p>
              </div>
              <div className="col-span-2 lg:col-span-1 bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl">
                <p className="text-[11px] text-slate-400">Cancellation Rate</p>
                <p className="text-base sm:text-xl font-black text-rose-400 mt-1">
                  {
                    analytics.cancellation_and_refund_stats
                      .cancellation_rate_percent
                  }
                  %
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-3">
                <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Most
                  Booked Movies
                </h3>
                <div className="space-y-2.5 text-xs">
                  {analytics.most_booked_movies.map((m, idx) => (
                    <div
                      key={m.movie_id}
                      className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-white truncate">
                          {m.movie_title}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-emerald-400 font-extrabold block">
                          ₹{Number(m.total_revenue).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {m.confirmed_bookings.toLocaleString()} bookings
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-3">
                <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" /> Theater
                  Occupancy
                </h3>
                <div className="space-y-2.5 text-xs">
                  {analytics.top_performing_theaters_and_occupancy.map((th) => (
                    <div
                      key={th.theater_id}
                      className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">
                            {th.theater_name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {th.city} • {th.confirmed_bookings.toLocaleString()}{" "}
                            bookings
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-emerald-400 font-extrabold">
                            ₹{Number(th.total_revenue).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-indigo-300 font-semibold">
                            {th.occupancy_percentage}% Full
                          </p>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
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

        {/* TAB 6: LOGIN / REGISTER */}
        {activeTab === "login" && (
          <form
            onSubmit={handleAuthSubmit}
            className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 space-y-4 sm:space-y-5 mt-4 sm:mt-8 shadow-2xl"
          >
            <div className="text-center space-y-1">
              <h2 className="text-xl sm:text-2xl font-black">
                {authForm.action === "login"
                  ? "Welcome Back"
                  : "Create Account"}
              </h2>
              <p className="text-xs text-slate-400">
                Admin Demo: <strong className="text-rose-400">admin</strong> /{" "}
                <strong className="text-rose-400">Admin@1234</strong>
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                required
                disabled={authLoading}
                placeholder="Username"
                value={authForm.username}
                onChange={(e) =>
                  setAuthForm({ ...authForm, username: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-500 disabled:opacity-50"
              />
              {authForm.action === "register" && (
                <input
                  type="email"
                  required
                  disabled={authLoading}
                  placeholder="Email address"
                  value={authForm.email}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, email: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-500 disabled:opacity-50"
                />
              )}
              <input
                type="password"
                required
                disabled={authLoading}
                placeholder="Password"
                value={authForm.password}
                onChange={(e) =>
                  setAuthForm({ ...authForm, password: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-500 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-gradient-to-r from-rose-600 to-rose-500 disabled:opacity-60 rounded-xl font-bold text-sm shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {authLoading
                ? "Signing In..."
                : authForm.action === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>

            <button
              type="button"
              disabled={authLoading}
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

      {/* Bottom Mobile Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090D16]/95 backdrop-blur-xl border-t border-slate-800 px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => setActiveTab("discover")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-bold ${
            activeTab === "discover" || activeTab === "detail"
              ? "text-rose-500"
              : "text-slate-400"
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Movies</span>
        </button>

        <button
          onClick={() => {
            if (!auth) return setActiveTab("login");
            fetchMyBookings();
            setActiveTab("bookings");
          }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-bold ${
            activeTab === "bookings" ? "text-rose-500" : "text-slate-400"
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>My Tickets</span>
        </button>

        {auth?.is_staff && (
          <button
            onClick={() => {
              fetchAnalytics();
              setActiveTab("analytics");
            }}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-bold ${
              activeTab === "analytics" ? "text-indigo-400" : "text-slate-400"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab(auth ? "bookings" : "login")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-bold ${
            activeTab === "login" ? "text-rose-500" : "text-slate-400"
          }`}
        >
          <User className="w-4 h-4" />
          <span>{auth ? "Profile" : "Sign In"}</span>
        </button>
      </nav>

      <footer className="hidden sm:block border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        BookMySeat Enterprise Cinema Platform • Built with Django REST
        Framework, React, Celery & Razorpay
      </footer>
    </div>
  );
}
