// app/api/tracking-script/route.ts
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
    const uid = decoded.uid;

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const trackingCode = userDoc.data()?.trackingCode;
    if (!trackingCode)
      return NextResponse.json({ error: "Tracking code missing" }, { status: 400 });

    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    const script = `<script>
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  
  // console.log('Initializing PostHog with host: ${posthogHost}');
  
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
  
  posthog.identify('${trackingCode}');
  
  posthog.people.set({
    'uxbreak_tracking_code': '${trackingCode}',
    'account_type': 'uxbreak_user'
  });
  
  posthog.capture('uxbreak_tracking_initialized', {
    tracking_code: '${trackingCode}',
    timestamp: new Date().toISOString()
  });
  
  console.log('UXbreak Analytics fully initialized.');
</script>`;

    return new Response(script, {
      headers: { 
        "Content-Type": "application/javascript",
        "Content-Disposition": "inline" 
      },
    });
  } catch (err: any) {
    console.error("Tracking script error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}