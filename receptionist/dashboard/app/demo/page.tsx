'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { PhoneCall, MessageSquare, Calendar, Mail, Mic, PhoneOff } from 'lucide-react'
import { toast } from 'sonner'

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition
    webkitSpeechRecognition?: typeof SpeechRecognition
  }
}

type ConversationTurn = { role: 'user' | 'assistant'; content: string }

export default function DemoPage() {
  const [demoDisplay, setDemoDisplay] = useState<string>('(XXX) XXX-XXXX')
  const [callActive, setCallActive] = useState(false)
  const [listening, setListening] = useState(false)
  const [receptionistSpeaking, setReceptionistSpeaking] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const historyRef = useRef<ConversationTurn[]>([])
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const callActiveRef = useRef(false)
  callActiveRef.current = callActive

  useEffect(() => {
    fetch('/api/demo-number')
      .then((res) => res.json())
      .then((data) => {
        if (data.display) setDemoDisplay(data.display)
      })
      .catch(() => {})
  }, [])

  async function playResponse(audioBase64: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`)
      audioRef.current = audio
      audio.onended = () => {
        setReceptionistSpeaking(false)
        setStatus('Listening...')
        resolve()
      }
      audio.onerror = () => {
        setReceptionistSpeaking(false)
        reject(new Error('Playback failed'))
      }
      setReceptionistSpeaking(true)
      setStatus('Receptionist speaking...')
      audio.play().catch(reject)
    })
  }

  async function sendToBot(userMessage: string, history: ConversationTurn[]) {
    setStatus('Thinking...')
    try {
      const res = await fetch('/api/demo-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      if (data.audioBase64) {
        const nextHistory = userMessage
          ? [...history, { role: 'user', content: userMessage }, { role: 'assistant', content: data.text }]
          : [{ role: 'assistant', content: data.text }]
        historyRef.current = nextHistory
        setConversation(historyRef.current)
        recognitionRef.current?.stop()
        await playResponse(data.audioBase64)
        if (callActiveRef.current) recognitionRef.current?.start()
      }
    } catch (err) {
      setStatus('Error')
      setReceptionistSpeaking(false)
      if (callActiveRef.current) recognitionRef.current?.start()
      toast.error((err as Error).message || 'Something went wrong')
    }
  }

  function startDemoCall() {
    const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SpeechRecognition) {
      toast.error('Your browser doesn’t support voice input. Try Chrome or Edge.')
      return
    }

    setCallActive(true)
    setConversation([])
    historyRef.current = []

    // Get greeting and play it
    sendToBot('', []).then(() => {
      // After greeting, start listening
      startRecognition()
    }).catch(() => setCallActive(false))

    function startRecognition() {
      const recognition = new SpeechRecognition!()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = 'en-US'
      recognitionRef.current = recognition

      recognition.onstart = () => setListening(true)
      recognition.onend = () => setListening(false)
      recognition.onerror = (e: { error: string }) => {
        if (e.error === 'not-allowed') {
          toast.error('Microphone access denied')
          endDemoCall()
        }
      }
      recognition.onresult = (e: SpeechRecognitionEvent) => {
        const last = e.results.length - 1
        const transcript = e.results[last][0].transcript?.trim()
        if (e.results[last].isFinal && transcript) {
          sendToBot(transcript, historyRef.current)
        }
      }
      recognition.start()
    }
  }

  function endDemoCall() {
    setCallActive(false)
    setListening(false)
    setReceptionistSpeaking(false)
    setStatus('')
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
  }

  const steps = [
    { icon: PhoneCall, title: 'You call', text: 'Call the number below or talk in your browser.' },
    { icon: MessageSquare, title: 'AI gathers info', text: 'Your receptionist asks for name, service needed, and preferred time.' },
    { icon: Calendar, title: 'AI books appointment', text: 'In demo mode we simulate a booking—no real calendar.' },
    { icon: Mail, title: 'You get a sample email', text: 'A "New Lead" email goes to our team so you see what customers get.' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold text-foreground text-center sm:text-4xl">
          See Reception in action.
        </h1>
        <p className="mt-3 text-muted-foreground text-center">
          Talk to your AI receptionist in the browser (no phone needed) or call the number below.
        </p>

        {/* In-browser demo: mic → LLM + ElevenLabs */}
        <div className="mt-8 glass rounded-2xl p-6">
          <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Try it now — no phone required</p>
          {!callActive ? (
            <button
              type="button"
              onClick={startDemoCall}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition"
            >
              <Mic className="h-5 w-5" />
              Start demo call — free, instant
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                {listening && <span className="text-secondary font-medium">Listening...</span>}
                {receptionistSpeaking && <span className="text-primary font-medium">Receptionist speaking...</span>}
                {status && !listening && !receptionistSpeaking && <span className="text-muted-foreground">{status}</span>}
              </div>
              <button
                type="button"
                onClick={endDemoCall}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/5 transition"
              >
                <PhoneOff className="h-4 w-4" />
                End call
              </button>
              {conversation.length > 0 && (
                <div className="mt-4 max-h-40 overflow-y-auto rounded-lg bg-black/20 p-3 text-xs space-y-2">
                  {conversation.map((turn, i) => (
                    <div key={i} className={turn.role === 'user' ? 'text-right text-muted-foreground' : 'text-left text-foreground'}>
                      <span className="font-medium">{turn.role === 'user' ? 'You' : 'Receptionist'}:</span> {turn.content}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Allow microphone access. Same AI and ElevenLabs voice as the real phone line—no Twilio.
          </p>
        </div>

        <div className="mt-8 glass rounded-2xl p-8 text-center">
          <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Or call to try the live line</p>
          <a
            href={`tel:${demoDisplay.replace(/\D/g, '')}`}
            className="mt-2 block text-4xl font-bold text-primary tracking-tight sm:text-5xl hover:text-primary/80"
          >
            {demoDisplay}
          </a>
        </div>

        <section className="mt-16">
          <h2 className="text-xl font-bold text-foreground mb-6">How it works</h2>
          <ul className="space-y-6">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-4 glass rounded-xl p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {i + 1}. {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{step.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="underline hover:text-foreground">Back to home</Link>
          </p>
          <p className="text-sm text-foreground font-medium">
            Ready to never miss a lead? <Link href="/signup" className="text-primary underline hover:no-underline">Get your dedicated line</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
