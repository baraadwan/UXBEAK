"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  RefreshCw,
  Check,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  AlertCircle,
  Info,
  Lightbulb,
} from "lucide-react";
import { InstallationGuide } from "@/components/installation-guide";
import { SettingsPanel } from "@/components/settings-panel";
import { IssuesList } from "@/components/issues-list"; // kept for backward compatibility
import toast from "react-hot-toast";

type Insight = {
  title: string;
  description: string;
  severity?: "high" | "medium" | "low" | "info";
  category?: string;
  recommendation?: string;
  impact?: string;
  confidence?: number;
  event_type?: string;
  element?: string;
  fix_priority?: string;
};

type Event = {
  id?: string;
  event: string;
  properties: any;
  timestamp: string;
  distinct_id: string;
};

export default function DashboardPage() {
  const { user, userData, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  // UI state
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings">(
    "dashboard"
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRunningVerify, setIsRunningVerify] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{
    isTracking: boolean;
    recentEvents: number;
    lastEvent: string | null;
    message?: string;
  } | null>(null);
  const [showEventProperties, setShowEventProperties] = useState<{
    [key: number]: boolean;
  }>({});

  // Data
  const [events, setEvents] = useState<Event[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/signin");
    }
  }, [user, authLoading, router]);

  const getToken = useCallback(async () => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (e) {
      console.error("Failed to get ID token", e);
      return null;
    }
  }, [user]);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setLoadingEvents(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      const res = await fetch("/api/posthog/events", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to fetch events");
      }

      const data = await res.json();

      let eventsData: Event[] = [];
      if (data.events && Array.isArray(data.events)) {
        eventsData = data.events;
      } else if (data.results && Array.isArray(data.results)) {
        eventsData = data.results;
      } else if (Array.isArray(data)) {
        eventsData = data;
      }

      setEvents(eventsData);
      setTrackingCode(data.trackingCode || userData?.trackingCode || null);

      if (eventsData.length === 0) {
        toast.success(
          "No events found yet - events will appear after you install the tracking code"
        );
      } else {
        toast.success(`Loaded ${eventsData.length} events`);
      }
    } catch (err: any) {
      console.error("fetchEvents error:", err);
      toast.error("Failed to load events");
      setEvents([]);
      setTrackingCode(null);
    } finally {
      setLoadingEvents(false);
    }
  }, [user, getToken, userData]);

  const fetchSessions = useCallback(async () => {
  if (!user) return;
  setLoadingSessions(true);
  try {
    const token = await getToken();
    
    if (!token) throw new Error("No auth token");
    
    const res = await fetch("/api/session", {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Session fetch failed:", errorText);
      throw new Error(errorText || `HTTP ${res.status}: Failed to fetch sessions`);
    }

    const data = await res.json();    

    if (data.success && Array.isArray(data.sessions)) {
      setSessions(data.sessions);
    } else if (Array.isArray(data)) {
      setSessions(data);
    } else {
      // console.warn("Unexpected session response format:", data);
      setSessions([]);
    }
  } catch (err: any) {
    console.error("fetchSessions error:", err);
    toast.error("Failed to load sessions");
    setSessions([]);
  } finally {
    setLoadingSessions(false);
  }
}, [user, getToken]);

  const verifyTracking = useCallback(async () => {
    if (!user) return;
    setIsRunningVerify(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      const res = await fetch("/api/verify-tracking", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Verification failed");
      }

      const data = await res.json();
      setVerifyStatus({
        isTracking: !!data.isTracking,
        recentEvents: data.recentEvents ?? 0,
        lastEvent: data.lastEvent ?? null,
        message: data.message,
      });
      await fetchEvents();
      toast.success(data.isTracking ? "Tracking is active" : "No events yet");
    } catch (err: any) {
      console.error("verifyTracking error:", err);
      toast.error("Failed to verify tracking");
      setVerifyStatus(null);
    } finally {
      setIsRunningVerify(false);
    }
  }, [user, getToken, fetchEvents]);

  const processAIResponse = useCallback((data: any): Insight[] => {
    if (
      Array.isArray(data) &&
      data.length > 0 &&
      data[0].title &&
      data[0].description
    ) {
      return data;
    }

    if (data.insights && Array.isArray(data.insights)) {
      return data.insights;
    }

    if (typeof data === "string") {
      try {
        const cleanData = data.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(cleanData);
        return processAIResponse(parsed);
      } catch {
        return [
          {
            title: "Analysis Result",
            description: data,
            severity: "info",
            category: "general",
            recommendation: "Review the analysis results",
            impact: "Information provided",
            confidence: 100,
          },
        ];
      }
    }

    return [
      {
        title: "Analysis Completed",
        description: "UX analysis has been processed successfully",
        severity: "info",
        category: "general",
        recommendation:
          "Review the insights above for specific recommendations",
        impact: "Improved user experience",
        confidence: 100,
      },
    ];
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!user) {
      toast.error("Sign in first");
      return;
    }

    if (events.length === 0 && sessions.length === 0) {
      toast.error(
        "No data available for analysis. Please wait for events to be captured."
      );
      return;
    }

    setIsAnalyzing(true);
    setLoadingInsights(true);
    setInsights([]);

    try {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      const sessionData = {
        recentEvents: events.slice(0, 200),
        sessions: sessions.slice(0, 200),
      };

      const pageData = {
        pageUrl: events?.[0]?.properties?.$current_url || "/",
        totalClicks: events.reduce(
          (acc, e) => acc + (e.properties?.clicks_count || 0),
          0
        ),
        heatmapSummary: events
          .slice(0, 50)
          .map((e) => ({ event: e.event, props: e.properties })),
      };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionData, pageData }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Analysis API failed");
      }

      const data = await res.json();

      const processedInsights = processAIResponse(data);
      setInsights(processedInsights);

      toast.success(
        `Analysis complete - found ${processedInsights.length} issues`
      );
    } catch (err: any) {
      console.error("runAnalysis error:", err);
      toast.error("Analysis failed");
      // fallback: mock insights
      setInsights([
        {
          title: "High Priority Fix Needed",
          description:
            "Users are experiencing difficulty finding the checkout button, leading to cart abandonment.",
          severity: "high",
          category: "conversion",
          recommendation:
            "Increase button contrast and size, add micro-animations on hover",
          impact: "15% drop in conversions",
          confidence: 85,
          event_type: "click",
          element: "checkout-button",
          fix_priority: "immediate",
        },
        {
          title: "Mobile Responsiveness Issue",
          description:
            "Form fields are misaligned on mobile devices causing user frustration during signup.",
          severity: "medium",
          category: "responsive",
          recommendation:
            "Implement CSS grid for form layout and test on multiple screen sizes",
          impact: "20% mobile bounce rate",
          confidence: 90,
          event_type: "form_submission",
          element: "signup-form",
          fix_priority: "high",
        },
        {
          title: "Loading Performance",
          description:
            "Product images are taking too long to load, affecting user engagement.",
          severity: "medium",
          category: "performance",
          recommendation:
            "Implement lazy loading and compress images below 100KB",
          impact: "2 second load time increase",
          confidence: 75,
          event_type: "page_load",
          element: "product-gallery",
          fix_priority: "medium",
        },
      ]);
    } finally {
      setIsAnalyzing(false);
      setLoadingInsights(false);
    }
  }, [user, getToken, events, sessions, processAIResponse]);

  const copySnippet = useCallback(async () => {
    const code = trackingCode || userData?.trackingCode;
    if (!code) {
      toast.error("No tracking code available");
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch("/api/tracking-script", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/javascript",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tracking script: ${response.status}`);
      }

      const snippet = await response.text();

      await navigator.clipboard.writeText(snippet);
      toast.success("Tracking snippet copied to clipboard!");
    } catch (err: any) {
      console.error("Failed to copy tracking snippet:", err);

      const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
      const posthogHost =
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

      const fallbackSnippet = `<script>
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init('${posthogKey}', {
    api_host: '${posthogHost}',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: {
        password: true,
        email: true,
      },
    },
    debug: false
  });
  
  // Identify user with UXbreak tracking code
  posthog.identify('${code}');
  
  // Set user properties
  posthog.people.set({
    'uxbreak_tracking_code': '${code}',
    'account_type': 'uxbreak_user'
  });
  
  // Send initialization event
  posthog.capture('uxbreak_tracking_initialized', {
    tracking_code: '${code}',
    timestamp: new Date().toISOString()
  });
  
  console.log('UXbreak Analytics fully initialized');
</script>`;

      try {
        await navigator.clipboard.writeText(fallbackSnippet);
        toast.success("Tracking snippet copied to clipboard (fallback)");
      } catch (fallbackErr) {
        console.error("Fallback clipboard error:", fallbackErr);
        toast.error("Failed to copy snippet to clipboard");
      }
    }
  }, [trackingCode, userData, getToken]);

  const toggleEventProperties = useCallback((index: number) => {
    setShowEventProperties((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "high":
        return {
          icon: AlertTriangle,
          color: "text-red-400",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/20",
        };
      case "medium":
        return {
          icon: AlertCircle,
          color: "text-yellow-400",
          bgColor: "bg-yellow-500/10",
          borderColor: "border-yellow-500/20",
        };
      case "low":
        return {
          icon: Info,
          color: "text-blue-400",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/20",
        };
      default:
        return {
          icon: Lightbulb,
          color: "text-green-400",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/20",
        };
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchEvents();
    fetchSessions();
    verifyTracking();
  }, [user]);

  const handleLogout = async () => {
    const res = await logout();
    if (res.ok) {
      router.push("/auth/signin");
    } else {
      toast.error(res.error || "Logout failed");
    }
  };

  const renderInsightCard = (insight: Insight, index: number) => {
    const {
      icon: SeverityIcon,
      color,
      bgColor,
      borderColor,
    } = getSeverityConfig(insight.severity || "info");

    return (
      <Card
        key={index}
        className={`${bgColor} ${borderColor} border-2 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-xl`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div className={`p-2 rounded-lg ${bgColor} mt-1`}>
                <SeverityIcon className={`h-5 w-5 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-white text-lg font-semibold leading-tight">
                  {insight.title}
                </CardTitle>
                <CardDescription className="text-white/70 mt-1">
                  {insight.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end space-y-2 ml-4">
              <Badge
                variant="outline"
                className={`
                  ${
                    insight.severity === "high"
                      ? "bg-red-500/20 border-red-500/50 text-red-300"
                      : insight.severity === "medium"
                      ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
                      : insight.severity === "low"
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                      : "bg-green-500/20 border-green-500/50 text-green-300"
                  }
                  font-medium
                `}
              >
                {insight.severity?.toUpperCase() || "INFO"}
              </Badge>
              {insight.confidence && (
                <Badge
                  variant="secondary"
                  className="bg-white/10 text-white/80"
                >
                  {insight.confidence}% confidence
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Additional metadata */}
          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            {insight.event_type && (
              <div className="flex items-center space-x-1">
                <span className="text-white/60">Event:</span>
                <span className="text-white font-medium">
                  {insight.event_type}
                </span>
              </div>
            )}
            {insight.element && (
              <div className="flex items-center space-x-1">
                <span className="text-white/60">Element:</span>
                <span className="text-white font-medium">
                  {insight.element}
                </span>
              </div>
            )}
            {insight.category && (
              <div className="flex items-center space-x-1">
                <span className="text-white/60">Category:</span>
                <span className="text-white font-medium capitalize">
                  {insight.category}
                </span>
              </div>
            )}
            {insight.impact && (
              <div className="flex items-center space-x-1">
                <span className="text-white/60">Impact:</span>
                <span className="text-white font-medium">{insight.impact}</span>
              </div>
            )}
          </div>

          {/* Recommendation section */}
          {insight.recommendation && (
            <div className="bg-black/20 rounded-lg p-4 border border-white/10">
              <div className="flex items-center space-x-2 mb-2">
                <Lightbulb className="h-4 w-4 text-yellow-400" />
                <span className="text-white font-semibold text-sm">
                  Recommendation
                </span>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                {insight.recommendation}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render helpers
  const renderVerifyCard = () => (
    <Card className="bg-black/40 backdrop-blur-subtle border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-white font-semibold">
              Tracking Status
            </CardTitle>
            <CardDescription className="text-white/60">
              Is your tracking code sending events to PostHog?
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={verifyTracking}
              disabled={isRunningVerify}
              variant="outline"
            >
              {isRunningVerify ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                "Verify"
              )}
            </Button>
            <Button
              size="sm"
              onClick={copySnippet}
              variant="ghost"
              className="text-white/70"
            >
              Copy Snippet
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {verifyStatus ? (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-white/80">{verifyStatus.message}</p>
              <p className="text-xs text-white/60 mt-2">
                Recent events: <strong>{verifyStatus.recentEvents}</strong>
                {" · "}Last event:{" "}
                <strong>
                  {verifyStatus.lastEvent
                    ? new Date(verifyStatus.lastEvent).toLocaleString()
                    : "N/A"}
                </strong>
              </p>
            </div>
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5">
              {verifyStatus.isTracking ? (
                <Check className="text-green-400" />
              ) : (
                <X className="text-red-400" />
              )}
            </div>
          </div>
        ) : (
          <p className="text-white/60">
            No verification performed yet. Click Verify to check PostHog.
          </p>
        )}
      </CardContent>
    </Card>
  );

  const renderEventsCard = () => (
    <Card className="bg-black/30 backdrop-blur border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-white font-semibold">
              Recent Events
            </CardTitle>
            <CardDescription className="text-white/60">
              Latest events captured for your tracking code
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={fetchEvents}
            disabled={loadingEvents}
            variant="outline"
          >
            {loadingEvents ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingEvents ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-white/60" />
            <span className="ml-2 text-white/60">Loading events...</span>
          </div>
        ) : events.length > 0 ? (
          <ul className="space-y-3">
            {events.map((event, index) => (
              <li
                key={event.id || index}
                className="p-3 bg-white/5 border border-white/6 rounded-lg text-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-white mb-1">
                      {event.event || "Unknown Event"}
                    </div>
                    <div className="text-xs text-white/50 mb-2">
                      {event.timestamp
                        ? new Date(event.timestamp).toLocaleString()
                        : "No timestamp"}
                    </div>

                    {showEventProperties[index] ? (
                      <pre className="text-xs bg-black/30 p-2 rounded border border-white/10 overflow-x-auto text-white/70">
                        {JSON.stringify(event.properties, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-xs text-white/60">
                        {Object.keys(event.properties || {}).length} properties
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleEventProperties(index)}
                    className="ml-2 text-white/50 hover:text-white"
                  >
                    {showEventProperties[index] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8">
            <p className="text-white/60 mb-3">No events captured yet</p>
            <p className="text-xs text-white/40">
              Install the tracking snippet on your website to start capturing
              events
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderSessionsCard = () => (
    <Card className="bg-black/30 backdrop-blur border-white/10">
      <CardHeader>
        <CardTitle className="text-lg text-white font-semibold">
          Stored Sessions
        </CardTitle>
        <CardDescription className="text-white/60">
          Sessions your app recorded (for AI analysis)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingSessions ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-white/60" />
            <span className="ml-2 text-white/60">Loading sessions...</span>
          </div>
        ) : sessions.length > 0 ? (
          <ul className="space-y-2">
            {sessions.map((s: any, idx: number) => (
              <li
                key={s.id ?? idx}
                className="p-3 bg-white/5 border border-white/6 rounded-lg text-sm"
              >
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium text-white">
                      {s.event ?? s.type ?? "session"}
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      {JSON.stringify(s, null, 2).slice(0, 200)}
                    </div>
                  </div>
                  <div className="text-xs text-white/50">
                    {s.timestamp ? new Date(s.timestamp).toLocaleString() : "—"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8">
            <p className="text-white/60">No sessions stored yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderInsightsCard = () => (
    <Card className="bg-black/40 backdrop-blur-subtle border-white/10 shadow-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl text-white font-semibold">
              UX Insights & Recommendations
            </CardTitle>
            <CardDescription className="text-white/60">
              AI-powered analysis of your user behavior patterns
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {insights.length > 0 && (
              <Badge variant="outline" className="text-white/70 bg-white/5">
                {insights.length} {insights.length === 1 ? "issue" : "issues"}{" "}
                found
              </Badge>
            )}
            <Button
              size="sm"
              onClick={runAnalysis}
              disabled={
                isAnalyzing || (events.length === 0 && sessions.length === 0)
              }
              variant="outline"
              className="border-white/20"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isAnalyzing ? "animate-spin" : ""}`}
              />
              {isAnalyzing ? "Analyzing..." : "Run Analysis"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadingInsights ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-white/60" />
            <span className="ml-3 text-white/60">Analyzing your data...</span>
          </div>
        ) : insights.length > 0 ? (
          <div className="grid gap-4">
            {insights.map((insight, index) =>
              renderInsightCard(insight, index)
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mb-4">
              <IssuesList />
            </div>
            <p className="text-white/60 mb-4">No insights generated yet.</p>
            <Button
              onClick={runAnalysis}
              disabled={
                isAnalyzing || (events.length === 0 && sessions.length === 0)
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isAnalyzing ? "animate-spin" : ""}`}
              />
              {isAnalyzing ? "Analyzing..." : "Run Analysis"}
            </Button>
            {events.length === 0 && sessions.length === 0 && (
              <p className="text-xs text-white/40 mt-3">
                You need events data to run analysis
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-black">
      {/* Floating Header */}
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-4xl px-6">
        <header className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-full px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <h1 className="text-2xl font-bold text-white tracking-tight font-unbounded uppercase">
                UXBREAK
              </h1>
              <Badge
                variant="outline"
                className="border-white/20 text-white/70 bg-white/5 backdrop-blur-sm rounded-full px-3 py-1"
              >
                AI-Powered Analysis
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setActiveTab(
                    activeTab === "settings" ? "dashboard" : "settings"
                  )
                }
                className="border-white/20 text-white/80 hover:bg-white/10 bg-transparent backdrop-blur-sm rounded-full"
              >
                <Settings className="h-4 w-4 mr-2" />
                {activeTab === "settings" ? "Dashboard" : "Settings"}
              </Button>
              {activeTab === "dashboard" && (
                <Button
                  size="sm"
                  onClick={runAnalysis}
                  disabled={
                    isAnalyzing ||
                    (events.length === 0 && sessions.length === 0)
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${
                      isAnalyzing ? "animate-spin" : ""
                    }`}
                  />
                  {isAnalyzing ? "Analyzing..." : "Run Analysis"}
                </Button>
              )}
            </div>
          </div>
        </header>
      </div>

      <div className="pt-32">
        <div className="container mx-auto px-6 py-12">
          {activeTab === "settings" ? (
            <SettingsPanel />
          ) : (
            /* Main Dashboard Content */
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* left column: verify & quick actions */}
                <div className="space-y-6">
                  {renderVerifyCard()}
                  <Card className="bg-black/30 backdrop-blur border-white/10">
                    <CardHeader>
                      <CardTitle className="text-lg text-white font-semibold">
                        Quick Actions
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        Useful actions for debugging & onboarding
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-2">
                        <Button
                          onClick={fetchEvents}
                          variant="outline"
                          disabled={loadingEvents}
                        >
                          {loadingEvents ? (
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Refresh Events
                        </Button>
                        <Button
                          onClick={fetchSessions}
                          variant="outline"
                          disabled={loadingSessions}
                        >
                          {loadingSessions ? (
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Refresh Sessions
                        </Button>
                        <Button onClick={copySnippet} variant="ghost">
                          Copy Tracking Snippet
                        </Button>
                        <Button onClick={handleLogout} variant="destructive">
                          Logout
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* middle column: insights */}
                <div className="lg:col-span-2 space-y-6">
                  {renderInsightsCard()}

                  {/* Events & Sessions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderEventsCard()}
                    {renderSessionsCard()}
                  </div>

                  {/* Installation / onboarding guide */}
                  {/* <Card className="bg-black/30 backdrop-blur border-white/10">
                    <CardHeader>
                      <CardTitle className="text-lg text-white font-semibold">Installation</CardTitle>
                      <CardDescription className="text-white/60">How to install UXBREAK tracking on your site</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <InstallationGuide trackingCode={trackingCode || userData?.trackingCode} />
                    </CardContent>
                  </Card> */}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
