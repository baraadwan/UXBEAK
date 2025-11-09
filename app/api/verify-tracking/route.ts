import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await admin.auth().verifyIdToken(token);

    // 🔹 Call internal PostHog events API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://uxbeak.vercel.app";
    const res = await fetch(`${baseUrl}/api/posthog/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("PostHog verify error:", text);
      return NextResponse.json({ isTracking: false, message: "PostHog check failed" });
    }

    const data = await res.json();
    const hasEvents = data.totalEvents > 0;

    return NextResponse.json({
      isTracking: hasEvents,
      recentEvents: data.totalEvents,
      lastEvent: data.lastEvent,
      message: hasEvents
        ? "PostHog tracking is working!"
        : "No events detected yet. Install the tracking script and generate some traffic.",
    });
  } catch (error: any) {
    console.error("Verify tracking error:", error);
    return NextResponse.json(
      { error: error.message || "Verification failed", isTracking: false },
      { status: 500 }
    );
  }
}
