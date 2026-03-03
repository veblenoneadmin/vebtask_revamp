import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/auth-client';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { EverSenseLogo } from '../components/EverSenseLogo';

// ─── module-level constants (no re-creation on re-render) ─────────────────────

const inputStyle = {
  backgroundColor: '#3c3c3c',
  border: '1px solid #3c3c3c',
  borderRadius: '4px',
  color: '#cccccc',
  fontFamily: 'monospace',
};

const STEPS = [
  { id: 'welcome', file: 'welcome.ts' },
  { id: 'profile', file: 'profile.ts' },
];

// ─── Shell (defined outside Onboarding to keep identity stable) ───────────────

function Shell({ children, stepIdx }: { children: React.ReactNode; stepIdx: number }) {
  const filename = STEPS[stepIdx]?.file ?? 'onboarding.ts';
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: '#1e1e1e' }}
    >
      {/* Background orbs */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(0,122,204,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(0,122,204,0.04) 0%, transparent 50%)' }} />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute rounded-full blur-3xl animate-pulse" style={{ top: '20%', left: '15%', width: '380px', height: '380px', background: 'rgba(0,122,204,0.08)' }} />
        <div className="absolute rounded-full blur-3xl animate-pulse" style={{ bottom: '20%', right: '15%', width: '340px', height: '340px', background: 'rgba(0,122,204,0.06)', animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-sm relative z-10" style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.6))' }}>

        {/* Title bar */}
        <div className="flex items-center justify-between px-4" style={{ backgroundColor: '#323233', borderRadius: '8px 8px 0 0', height: '32px', borderBottom: '1px solid #3c3c3c' }}>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#febc2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#28c840' }} />
          </div>
          <span className="text-xs" style={{ color: '#858585', fontFamily: 'monospace' }}>
            EverSense Ai — {filename}
          </span>
          <div className="w-12" />
        </div>

        {/* Editor panel */}
        <div style={{ backgroundColor: '#252526', border: '1px solid #3c3c3c', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>

          {/* Tab bar with step dots */}
          <div style={{ backgroundColor: '#2d2d2d', borderBottom: '1px solid #3c3c3c', display: 'flex', alignItems: 'stretch', justifyContent: 'space-between' }}>
            <div className="flex items-center gap-2 px-4 py-2 text-xs" style={{ color: '#cccccc', borderBottom: '1px solid #007acc', backgroundColor: '#1e1e1e', fontFamily: 'monospace' }}>
              <EverSenseLogo height={16} width={94} />
              {filename}
            </div>
            <div className="flex items-center gap-1.5 pr-4">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full transition-colors"
                  style={{ backgroundColor: i <= stepIdx ? '#007acc' : '#3c3c3c' }}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            <div className="flex flex-col items-center gap-2 mb-2">
              <EverSenseLogo width={280} height={66} />
            </div>
            {children}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 text-xs" style={{ backgroundColor: '#007acc', color: '#ffffff', height: '22px', fontFamily: 'monospace' }}>
          <span>⎇ main</span>
          <span>Step {stepIdx + 1} of {STEPS.length}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page component ────────────────────────────────────────────────────────────

export function Onboarding() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [stepIdx, setStepIdx] = useState(0);
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      checkStatus();
    }
  }, [session]);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/wizard/status', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        if (!data.data.needsOnboarding) {
          navigate('/dashboard', { replace: true });
          return;
        }
        const idx = STEPS.findIndex(s => s.id === data.data.nextStep);
        if (idx >= 0) setStepIdx(idx);
      }
    } catch { /* keep default step */ }
  };

  const completeStep = async (stepId: string) => {
    try {
      const res = await fetch('/api/wizard/complete-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ step: stepId }),
      });
      return (await res.json()).success ?? false;
    } catch { return false; }
  };

  const btnStyle = (disabled: boolean) => ({
    backgroundColor: disabled ? '#0a4d7a' : '#0e639c',
    color: '#ffffff',
    border: '1px solid #1177bb',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'monospace',
  });

  // ── Welcome step ─────────────────────────────────────────────────────────────
  if (STEPS[stepIdx].id === 'welcome') {
    const handleContinue = async () => {
      setLoading(true);
      await completeStep('welcome');
      setLoading(false);
      setStepIdx(1);
    };

    return (
      <Shell stepIdx={0}>
        <div className="text-center space-y-5">
          <div className="text-xs" style={{ color: '#858585', fontFamily: 'monospace' }}>
            // account ready
          </div>

          <CheckCircle className="mx-auto" style={{ color: '#4ec9b0', width: 40, height: 40 }} />

          <div>
            <p className="text-sm font-medium" style={{ color: '#cccccc', fontFamily: 'monospace' }}>
              Welcome, {session?.user?.name || 'there'}!
            </p>
            <p className="text-xs mt-2" style={{ color: '#858585', fontFamily: 'monospace' }}>
              // your account is set up. one quick step before you start.
            </p>
          </div>

          <button
            onClick={handleContinue}
            disabled={loading}
            className="w-full py-2 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
            style={btnStyle(loading)}
            onMouseEnter={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#1177bb'); }}
            onMouseLeave={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#0e639c'); }}
          >
            {loading ? '▶ Loading...' : <>▶ Continue <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </Shell>
    );
  }

  // ── Profile step ─────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    setLoading(true);
    await completeStep('profile');
    // Full reload so App.tsx re-checks onboarding status with the updated DB values
    window.location.href = '/dashboard';
  };

  return (
    <Shell stepIdx={1}>
      <div className="space-y-5">
        <div className="text-xs" style={{ color: '#858585', fontFamily: 'monospace' }}>
          // tell us your role (optional)
        </div>

        <div className="space-y-1">
          <label htmlFor="jobTitle" className="text-xs font-medium" style={{ color: '#9cdcfe', fontFamily: 'monospace' }}>
            // job title
          </label>
          <input
            type="text"
            id="jobTitle"
            placeholder="e.g. Project Manager"
            value={jobTitle}
            onChange={e => setJobTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#007acc')}
            onBlur={e => (e.target.style.borderColor = '#3c3c3c')}
          />
        </div>

        <button
          onClick={handleFinish}
          disabled={loading}
          className="w-full py-2 text-sm font-medium transition-all duration-200"
          style={btnStyle(loading)}
          onMouseEnter={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#1177bb'); }}
          onMouseLeave={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#0e639c'); }}
        >
          {loading ? '▶ Saving...' : '▶ Go to Dashboard'}
        </button>

        <button
          onClick={handleFinish}
          disabled={loading}
          className="w-full text-xs text-center py-1"
          style={{ color: '#858585', fontFamily: 'monospace', background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
          onMouseEnter={e => { if (!loading) (e.currentTarget.style.color = '#cccccc'); }}
          onMouseLeave={e => { if (!loading) (e.currentTarget.style.color = '#858585'); }}
        >
          // skip for now
        </button>
      </div>
    </Shell>
  );
}
