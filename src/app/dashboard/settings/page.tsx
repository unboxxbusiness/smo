"use client";

import React, { useState, useEffect } from "react";
import { Save, RotateCw, Eye, EyeOff, CheckCircle2, Settings } from "lucide-react";

const credentialFields = [
  { key: "gemini_api_key", label: "Gemini API Key", placeholder: "AIza..." },
  { key: "cloudinary_cloud_name", label: "Cloudinary Cloud Name", placeholder: "my-cloud" },
  { key: "cloudinary_api_key", label: "Cloudinary API Key", placeholder: "123456789..." },
  { key: "cloudinary_api_secret", label: "Cloudinary API Secret", placeholder: "abc123..." },
  { key: "buffer_access_token", label: "Buffer Access Token", placeholder: "1/..." },
  { key: "news_api_key", label: "NewsAPI Key", placeholder: "abc123..." },
  { key: "serp_api_key", label: "SerpApi Key", placeholder: "abc123..." },
  { key: "youtube_api_key", label: "YouTube Data API Key", placeholder: "AIza..." },
];

const platforms = ["linkedin", "facebook", "twitter", "threads", "newsletter", "blog", "website", "marketing"];
const tones = ["Professional", "Casual", "Inspirational", "Persuasive", "Witty", "Informative"];

export default function SettingsPage() {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [revealMap, setRevealMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data && !data.error) {
          setFormData(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleReveal = (key: string) => {
    setRevealMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data && !data.error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <RotateCw className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 text-zinc-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-outfit">Settings</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage your API credentials and platform preferences</p>
        </div>
        <Settings className="h-8 w-8 text-zinc-600" />
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* API CREDENTIALS */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm space-y-5">
          <div className="border-b border-zinc-800 pb-4">
            <h2 className="text-base font-bold text-white font-outfit">API Credentials</h2>
            <p className="text-xs text-zinc-500 mt-1">Values stored here override environment variables for your account</p>
          </div>
          <div className="space-y-4">
            {credentialFields.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block font-outfit">{label}</label>
                <div className="relative flex items-center">
                  <input
                    type={revealMap[key] ? "text" : "password"}
                    value={formData[key] || ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors font-outfit"
                  />
                  <button
                    type="button"
                    onClick={() => toggleReveal(key)}
                    className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {revealMap[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PREFERENCES */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm space-y-5">
          <div className="border-b border-zinc-800 pb-4">
            <h2 className="text-base font-bold text-white font-outfit">Content Preferences</h2>
            <p className="text-xs text-zinc-500 mt-1">These defaults pre-fill the Content Studio generation form</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block font-outfit">Default Platform</label>
              <select
                value={formData.default_platform || "linkedin"}
                onChange={(e) => handleChange("default_platform", e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-outfit"
              >
                {platforms.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block font-outfit">Preferred Tone</label>
              <select
                value={formData.preferred_tone || "Professional"}
                onChange={(e) => handleChange("preferred_tone", e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-outfit"
              >
                {tones.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block font-outfit">Timezone</label>
              <input
                type="text"
                value={formData.timezone || "UTC"}
                onChange={(e) => handleChange("timezone", e.target.value)}
                placeholder="e.g. America/New_York"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 font-outfit"
              />
            </div>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="flex justify-end items-center gap-4">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400 font-outfit">
              <CheckCircle2 className="h-4 w-4" />
              Settings saved successfully
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2 transition-colors font-outfit"
          >
            {saving ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
