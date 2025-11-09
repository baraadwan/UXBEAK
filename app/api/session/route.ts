import { db } from "@/lib/firebase";
import { addDoc, collection } from "firebase/firestore";
import { type NextRequest, NextResponse } from "next/server";

// Mock session data storage (in production, use a real database)
const sessions: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const sessionData = await request.json();

    if (!sessionData.userId || !sessionData.event) {
      return NextResponse.json(
        { error: "Missing required fields (userId or event)" },
        { status: 400 }
      );
    }

    const sessionDoc = {
      ...sessionData,
      timeStamp: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, "session"), sessionDoc);

    return NextResponse.json({
      success: true,
      sessionId: docRef.id,
      message: "Session stored successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to store session data" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ sessions });
}
