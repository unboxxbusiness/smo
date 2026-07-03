# Phase 1: Project Setup, Auth, & Dashboard Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the Next.js 15 project structure with TypeScript and Tailwind CSS, configure Supabase Auth (with public sign-ups disabled), configure shadcn/ui, and establish the main dashboard dashboard layout with Sidebar navigation.

**Architecture:** Monolithic Next.js 15 app router. Route handlers and Server Actions will handle authentication redirects. Navigation is managed client-side within a master Layout component that listens to Supabase session state.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4/v3, TypeScript, Supabase SSR client (`@supabase/ssr`), Lucide React, Shadcn/ui.

## Global Constraints
*   Next.js 15 (App Router)
*   Supabase Auth & Database client using `@supabase/ssr` (cookies based)
*   Tailwind CSS for styling
*   No styling placeholders; professional dark-theme palette (#09090b / #18181b / #8b5cf6) from the start

---

### Task 1: Next.js 15 Project Scaffolding

**Files:**
*   Create: `.env.local`
*   Modify: `package.json`

**Interfaces:**
*   Produces: A fresh Next.js app in the root directory.

- [ ] **Step 1: Get create-next-app help options**
  Run: `npx create-next-app --help`
  Expected: Command outputs available options.

- [ ] **Step 2: Initialize Next.js project in current directory**
  Run: `npx -y create-next-app@15.0.0 ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`
  Expected: Scaffolds the app inside `E:\social`.

- [ ] **Step 3: Setup environment variables template**
  Create `E:\social\.env.local` with the following variables:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
  NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder_anon_key
  SUPABASE_SERVICE_ROLE_KEY=placeholder_service_key
  ```

- [ ] **Step 4: Verify Next.js dev server starts**
  Run: `npm run dev` (wait for server to compile the default page, then terminate process)
  Expected: Server starts on port 3000 without errors.

- [ ] **Step 5: Commit changes**
  Run:
  ```bash
  git add .
  git commit -m "chore: scaffold Next.js 15 project"
  ```

---

### Task 2: Supabase Client and Middleware Auth Setup

**Files:**
*   Create: `src/utils/supabase/server.ts`
*   Create: `src/utils/supabase/client.ts`
*   Create: `src/utils/supabase/middleware.ts`
*   Create: `src/middleware.ts`

**Interfaces:**
*   Consumes: `@supabase/ssr` and `@supabase/supabase-js` dependencies
*   Produces: `createClient` functions for server-side and client-side Supabase operations, and Middleware that intercepts requests to redirect unauthenticated requests to `/login`.

- [ ] **Step 1: Install Supabase libraries**
  Run: `npm install @supabase/ssr @supabase/supabase-js`
  Expected: Dependencies added to `package.json`.

- [ ] **Step 2: Create Server-side Client Utility**
  Create `src/utils/supabase/server.ts` with:
  ```typescript
  import { createServerClient } from '@supabase/ssr';
  import { cookies } from 'next/headers';

  export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method can be called from a Server Component
              // which cannot write cookies. This can be ignored if you have
              // middleware refreshing sessions.
            }
          },
        },
      }
    );
  }
  ```

- [ ] **Step 3: Create Client-side Client Utility**
  Create `src/utils/supabase/client.ts` with:
  ```typescript
  import { createBrowserClient } from '@supabase/ssr';

  export function createClient() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  ```

- [ ] **Step 4: Create Middleware Client Utility**
  Create `src/utils/supabase/middleware.ts` with:
  ```typescript
  import { createServerClient } from '@supabase/ssr';
  import { NextResponse, type NextRequest } from 'next/server';

  export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
      request,
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Redirect to login if user is not logged in and is accessing a protected route
    const isLoginRoute = request.nextUrl.pathname.startsWith('/login');
    const isApiRoute = request.nextUrl.pathname.startsWith('/api');
    const isStaticAsset = request.nextUrl.pathname.includes('.') || request.nextUrl.pathname.startsWith('/_next');

    if (!user && !isLoginRoute && !isApiRoute && !isStaticAsset && request.nextUrl.pathname !== '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }
  ```

- [ ] **Step 5: Create Next.js Middleware**
  Create `src/middleware.ts` with:
  ```typescript
  import { type NextRequest } from 'next/server';
  import { updateSession } from '@/utils/supabase/middleware';

  export async function middleware(request: NextRequest) {
    return await updateSession(request);
  }

  export const config = {
    matcher: [
      '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
  };
  ```

- [ ] **Step 6: Commit changes**
  Run:
  ```bash
  git add src/utils/supabase/ src/middleware.ts
  git commit -m "feat: setup supabase auth utilities and middleware"
  ```

---

### Task 3: Shadcn UI & Styling Setup

**Files:**
*   Modify: `src/app/globals.css`
*   Modify: `tailwind.config.ts` (if Next.js template uses it) or `tailwind.config.js`
*   Create: `components.json`

**Interfaces:**
*   Produces: Shadcn/ui core components installed and structured in components directory.

- [ ] **Step 1: Install shadcn CLI and dependency tailwind-merge**
  Run: `npm install lucide-react clsx tailwind-merge class-variance-authority`
  Expected: Packages added to `package.json`.

- [ ] **Step 2: Initialize Shadcn UI**
  Create `E:\social\components.json` manually with default config:
  ```json
  {
    "$schema": "https://ui.shadcn.com/schema.json",
    "style": "default",
    "rsc": true,
    "tsx": true,
    "tailwind": {
      "config": "tailwind.config.ts",
      "css": "src/app/globals.css",
      "baseColor": "zinc",
      "cssVariables": true,
      "prefix": ""
    },
    "aliases": {
      "components": "@/components",
      "utils": "@/lib/utils",
      "ui": "@/components/ui",
      "lib": "@/lib",
      "hooks": "@/hooks"
    }
  }
  ```

- [ ] **Step 3: Create utils helper**
  Create `src/lib/utils.ts` with:
  ```typescript
  import { type ClassValue, clsx } from "clsx";
  import { twMerge } from "tailwind-merge";

  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
  }
  ```

- [ ] **Step 4: Update CSS Variables in globals.css**
  Replace `src/app/globals.css` with a sleek dark theme:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  @layer base {
    :root {
      --background: 240 10% 3.9%;
      --foreground: 0 0% 98%;
      --card: 240 10% 3.9%;
      --card-foreground: 0 0% 98%;
      --popover: 240 10% 3.9%;
      --popover-foreground: 0 0% 98%;
      --primary: 263.4 90% 50.8%;
      --primary-foreground: 210 20% 98%;
      --secondary: 240 3.7% 15.9%;
      --secondary-foreground: 0 0% 98%;
      --muted: 240 3.7% 15.9%;
      --muted-foreground: 240 5% 64.9%;
      --accent: 263.4 90% 30%;
      --accent-foreground: 0 0% 98%;
      --destructive: 0 72.2% 50.6%;
      --destructive-foreground: 0 0% 98%;
      --border: 240 3.7% 15.9%;
      --input: 240 3.7% 15.9%;
      --ring: 263.4 90% 50.8%;
      --radius: 0.75rem;
    }
  }

  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: 'Inter', sans-serif;
  }
  ```

- [ ] **Step 5: Commit styling changes**
  Run:
  ```bash
  git add components.json src/lib/utils.ts src/app/globals.css
  git commit -m "style: configure global dark theme and shadcn config"
  ```

---

### Task 4: Base Layout & Sidebar Navigation Component

**Files:**
*   Create: `src/components/Sidebar.tsx`
*   Create: `src/app/dashboard/layout.tsx`
*   Create: `src/app/dashboard/page.tsx`

**Interfaces:**
*   Produces: Sidebar structure supporting Navigation, dynamic paths, and log-out capability.

- [ ] **Step 1: Create Sidebar component**
  Create `src/components/Sidebar.tsx` with:
  ```typescript
  "use client";

  import Link from "next/link";
  import { usePathname, useRouter } from "next/navigation";
  import { createClient } from "@/utils/supabase/client";
  import { 
    LayoutDashboard, 
    Search, 
    PenTool, 
    FileText, 
    Send, 
    BarChart3, 
    Settings, 
    LogOut 
  } from "lucide-react";

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Research", href: "/dashboard/research", icon: Search },
    { name: "Content Studio", href: "/dashboard/studio", icon: PenTool },
    { name: "Draft Library", href: "/dashboard/drafts", icon: FileText },
    { name: "Publishing Queue", href: "/dashboard/publishing", icon: Send },
    { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
      await supabase.auth.signOut();
      router.push("/login");
    };

    return (
      <div className="flex h-screen w-64 flex-col bg-zinc-950 border-r border-zinc-800 text-zinc-300">
        <div className="flex h-16 items-center px-6 border-b border-zinc-800">
          <span className="text-lg font-bold text-violet-500 tracking-wide">
            AI Publisher
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-6">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-violet-950/40 text-violet-400 border border-violet-800/40" 
                    : "hover:bg-zinc-900 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create Dashboard layout wrapping Sidebar and Content panel**
  Create `src/app/dashboard/layout.tsx` with:
  ```typescript
  import Sidebar from "@/components/Sidebar";

  export default function DashboardLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <div className="flex h-screen overflow-hidden bg-zinc-950">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-zinc-900/50 p-8">
          {children}
        </main>
      </div>
    );
  }
  ```

- [ ] **Step 3: Create placeholder Dashboard landing page**
  Create `src/app/dashboard/page.tsx` with:
  ```typescript
  export default function DashboardPage() {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">Welcome back. Here is your publishing overview.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {["Opportunities Found", "Drafts Created", "Scheduled Posts", "Total Published"].map((metric) => (
            <div key={metric} className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{metric}</span>
              <p className="text-2xl font-bold text-white mt-2">0</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Commit Layout changes**
  Run:
  ```bash
  git add src/components/Sidebar.tsx src/app/dashboard/
  git commit -m "feat: add Sidebar navigation and basic dashboard layout"
  ```

---

### Task 5: Login View and Authentication Routing

**Files:**
*   Create: `src/app/login/page.tsx`
*   Modify: `src/app/page.tsx`

**Interfaces:**
*   Produces: Login UI interface that allows sign in to Supabase and routes authenticated sessions directly to `/dashboard`.

- [ ] **Step 1: Create Login page**
  Create `src/app/login/page.tsx` with:
  ```typescript
  "use client";

  import React, { useState } from "react";
  import { useRouter } from "next/navigation";
  import { createClient } from "@/utils/supabase/client";

  export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-md space-y-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 backdrop-blur-md shadow-2xl">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-white">Sign In</h2>
            <p className="mt-2 text-sm text-zinc-400">Access your publishing dashboard</p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="rounded-lg border border-red-900 bg-red-950/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                  placeholder="name@domain.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Update Index page to redirect authenticated sessions**
  Replace `src/app/page.tsx` with:
  ```typescript
  import { redirect } from "next/navigation";
  import { createClient } from "@/utils/supabase/server";

  export default async function IndexPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      redirect("/dashboard");
    } else {
      redirect("/login");
    }
  }
  ```

- [ ] **Step 3: Verify navigation redirects run**
  Run the dev server: `npm run dev` and navigate to `http://localhost:3000`. Confirm that it redirects to `http://localhost:3000/login`.

- [ ] **Step 4: Commit routing and login page**
  Run:
  ```bash
  git add src/app/login/page.tsx src/app/page.tsx
  git commit -m "feat: implement LoginPage UI and home index redirect router"
  ```
