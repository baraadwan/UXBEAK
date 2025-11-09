"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";

type EvidenceAny = any;

interface AuthUserData {
  email?: string;
  name?: string;
  trackingCode?: string;
  createdAt?: string;
  [k: string]: any;
}

interface AuthContextType {
  user: User | null;
  userData: AuthUserData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<AuthUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const ensureUserDoc = useCallback(async (u: User | null) => {
    if (!u) return null;
    try {
      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data() as AuthUserData;
        setUserData(data);
        return data;
      } else {
        const trackingCode = `uxb_${Math.random().toString(36).substring(2, 9)}`;
        const newUserData: AuthUserData = {
          email: u.email ?? undefined,
          name: u.displayName ?? u.email?.split("@")[0] ?? "User",
          trackingCode,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, newUserData, { merge: true });
        setUserData(newUserData);
        return newUserData;
      }
    } catch (err) {
      console.error("ensureUserDoc error:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = onAuthStateChanged(
      auth,
      async (u) => {
        setUser(u);
        if (u) {
          await ensureUserDoc(u);
        } else {
          setUserData(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("onAuthStateChanged error:", error);
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [ensureUserDoc]);

  // Basic validators
  const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
  const isValidPassword = (pw: string) => typeof pw === "string" && pw.length >= 6;

  // Sign up (email/password)
  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      if (actionLoading) return { ok: false, error: "Another auth action in progress" };
      setActionLoading(true);

      try {
        if (!email || !password || !name) return { ok: false, error: "Email, password and name are required" };
        if (!isValidEmail(email)) return { ok: false, error: "Invalid email format" };
        if (!isValidPassword(password)) return { ok: false, error: "Password must be at least 6 characters" };

        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const u = cred.user;

        // Update displayName (client-side)
        if (u && name) {
          await updateProfile(u, { displayName: name }).catch((e) => {
            console.warn("updateProfile failed:", e);
          });
        }

        const trackingCode = `uxb_${Math.random().toString(36).substring(2, 9)}`;
        const userDoc = {
          email,
          name,
          trackingCode,
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "users", u.uid), userDoc, { merge: true });

        setActionLoading(false);
        return { ok: true };
      } catch (err: any) {
        console.error("signUp error:", err);
        const code = err?.code || err?.message || "unknown_error";
        let message = "Sign up failed";
        if (code.includes("auth/email-already-in-use")) message = "Email already in use";
        else if (code.includes("auth/invalid-email")) message = "Invalid email";
        else if (code.includes("auth/weak-password")) message = "Weak password";
        setActionLoading(false);
        return { ok: false, error: message };
      }
    },
    [actionLoading]
  );

  // Sign in (email/password)
  const signIn = useCallback(
    async (email: string, password: string) => {
      if (actionLoading) return { ok: false, error: "Another auth action in progress" };
      setActionLoading(true);

      try {
        if (!email || !password) return { ok: false, error: "Email and password are required" };
        if (!isValidEmail(email)) return { ok: false, error: "Invalid email" };
        if (!isValidPassword(password)) return { ok: false, error: "Invalid password" };

        await signInWithEmailAndPassword(auth, email, password);
        setActionLoading(false);
        return { ok: true };
      } catch (err: any) {
        console.error("signIn error:", err);
        let message = "Sign in failed";
        const code = err?.code || "";
        if (code.includes("auth/wrong-password")) message = "Incorrect password";
        else if (code.includes("auth/user-not-found")) message = "User not found";
        else if (code.includes("auth/invalid-email")) message = "Invalid email";
        setActionLoading(false);
        return { ok: false, error: message };
      }
    },
    [actionLoading]
  );

  // Google Sign-in
  const signInWithGoogle = useCallback(async () => {
    if (actionLoading) return { ok: false, error: "Another auth action in progress" };
    setActionLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const u = result.user;

      await ensureUserDoc(u);

      setActionLoading(false);
      return { ok: true };
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      let message = "Google sign-in failed";
      if (err?.code === "auth/popup-closed-by-user") message = "Popup closed before completing sign-in";
      setActionLoading(false);
      return { ok: false, error: message };
    }
  }, [actionLoading, ensureUserDoc]);

  // Logout
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      return { ok: true };
    } catch (err: any) {
      console.error("logout error:", err);
      return { ok: false, error: "Logout failed" };
    }
  }, []);

  const value: AuthContextType = {
    user,
    userData,
    loading: loading || actionLoading,
    signIn,
    signUp,
    signInWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
