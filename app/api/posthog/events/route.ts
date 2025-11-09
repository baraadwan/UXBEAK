import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";

// Firebase Admin initialization
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
    // 🔹 Verify Authorization
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const trackingCode = userDoc.data()?.trackingCode;
    if (!trackingCode) {
      return NextResponse.json({ error: "Tracking code missing" }, { status: 400 });
    }

    // 🔹 PostHog configuration
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
    const apiKey = process.env.POSTHOG_API_KEY;
    const projectId = process.env.POSTHOG_PROJECT_ID;

    if (!apiKey || !projectId) {
      console.error("❌ PostHog not configured");
      return NextResponse.json({ error: "PostHog not configured" }, { status: 500 });
    }

    const eventsUrl = `${host}/api/projects/${projectId}/events/?distinct_id=${encodeURIComponent(trackingCode)}&limit=10`;
    
    // console.log("📡 Fetching from:", eventsUrl);
    // console.log("🔑 Using Project ID:", projectId);

    const eventsResponse = await fetch(eventsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // console.log("📊 Response status:", eventsResponse.status);

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error("❌ PostHog API error:", {
        status: eventsResponse.status,
        statusText: eventsResponse.statusText,
        error: errorText
      });
      return NextResponse.json({ 
        error: "Failed to fetch events from PostHog",
        status: eventsResponse.status,
        details: errorText
      }, { status: 500 });
    }

    const eventsData = await eventsResponse.json();
    // console.log("📦 Raw PostHog data:", JSON.stringify(eventsData, null, 2));

    const events = eventsData.results || [];
    
    return NextResponse.json({
      success: true,
      trackingCode,
      totalEvents: events.length,
      events: events.map((event: any) => ({
        id: event.id,
        event: event.event,
        properties: event.properties,
        timestamp: event.timestamp,
        distinct_id: event.distinct_id,
      })),
    });

  } catch (error: any) {
    console.error("🔥 API error:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}