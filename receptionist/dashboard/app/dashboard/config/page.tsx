'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Eye, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { buildSystemPrompt, type BotConfig } from '@/lib/prompt-builder'

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'direct', label: 'Direct' }
] as const

const LEAD_INFO_OPTIONS = [
  'Name',
  'Email',
  'Phone',
  'Service Type',
  'Urgency',
  'Address',
  'Preferred Callback',
  'Budget',
  'Timeline'
]

export default function ConfigPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<BotConfig>({
    businessName: '',
    tone: 'professional',
    customKnowledge: '',
    requiredLeadInfo: []
  })

  // Load existing config on mount
  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      setLoading(true)

      const res = await fetch('/api/config')
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to load')

      if (data.config) {
        setConfig(data.config)
      }
    } catch (error: any) {
      console.error('Error loading config:', error)
      toast.error(error.message || 'Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig() {
    try {
      setSaving(true)

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: config.businessName,
          tone: config.tone,
          customKnowledge: config.customKnowledge,
          requiredLeadInfo: config.requiredLeadInfo
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to save')

      toast.success('Configuration saved successfully!')
    } catch (error: any) {
      console.error('Error saving config:', error)
      toast.error(error.message || 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  function handleLeadInfoToggle(option: string) {
    setConfig(prev => ({
      ...prev,
      requiredLeadInfo: prev.requiredLeadInfo.includes(option)
        ? prev.requiredLeadInfo.filter(item => item !== option)
        : [...prev.requiredLeadInfo, option]
    }))
  }

  const promptPreview = buildSystemPrompt({ config, includeExamples: true })

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-8 h-8 text-slate-700" />
            <h1 className="text-3xl font-bold text-slate-900">Bot Configuration</h1>
          </div>
          <p className="text-slate-600">Customize your AI receptionist's personality and behavior</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Configuration Form */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Bot Settings</h2>

              {/* Business Name */}
              <div className="mb-6">
                <label htmlFor="businessName" className="block text-sm font-medium text-slate-700 mb-2">
                  Business Name
                </label>
                <input
                  id="businessName"
                  type="text"
                  value={config.businessName}
                  onChange={(e) => setConfig(prev => ({ ...prev, businessName: e.target.value }))}
                  placeholder="e.g., Acme Plumbing"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>

              {/* Bot Tone */}
              <div className="mb-6">
                <label htmlFor="tone" className="block text-sm font-medium text-slate-700 mb-2">
                  Bot Tone
                </label>
                <select
                  id="tone"
                  value={config.tone}
                  onChange={(e) => setConfig(prev => ({ ...prev, tone: e.target.value as BotConfig['tone'] }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                >
                  {TONE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Knowledge */}
              <div className="mb-6">
                <label htmlFor="customKnowledge" className="block text-sm font-medium text-slate-700 mb-2">
                  Custom Knowledge & Rules
                </label>
                <textarea
                  id="customKnowledge"
                  value={config.customKnowledge}
                  onChange={(e) => setConfig(prev => ({ ...prev, customKnowledge: e.target.value }))}
                  placeholder="Add specific FAQs, business rules, or knowledge the bot should know..."
                  rows={6}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none"
                />
                <p className="mt-2 text-xs text-slate-500">
                  This will be injected into the system prompt. Use this for business-specific information.
                </p>
              </div>

              {/* Required Lead Info */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Required Lead Information
                </label>
                <div className="space-y-2">
                  {LEAD_INFO_OPTIONS.map(option => (
                    <label key={option} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={config.requiredLeadInfo.includes(option)}
                        onChange={() => handleLeadInfoToggle(option)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={saveConfig}
                disabled={saving || !config.businessName.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="lg:sticky lg:top-8 h-fit">
            <div className="bg-slate-900 rounded-lg border border-slate-700 shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-100">System Prompt Preview</h2>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap overflow-auto max-h-[600px]">
                  {promptPreview || 'Start configuring your bot to see the preview...'}
                </pre>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                This is the exact prompt that will be sent to the AI model during phone calls.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
