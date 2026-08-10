import { FormEvent, useState } from 'react';
import { LockKeyhole, X } from 'lucide-react';

interface PasswordPromptModalProps {
  onClose: () => void;
  onSubmit: (password: string) => Promise<string | null>;
}

export default function PasswordPromptModal({ onClose, onSubmit }: PasswordPromptModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password.trim()) return;
    setError('');
    setSubmitting(true);
    const errorMessage = await onSubmit(password.trim());
    setSubmitting(false);
    if (errorMessage) setError(errorMessage);
  };

  return (
    <div className="quick-view-backdrop" role="dialog" aria-modal="true" aria-label="Enter password">
      <section className="login-card password-prompt-card">
        <button className="icon-button password-prompt-close" type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        <div className="login-brand"><span><LockKeyhole size={25} /></span><div><h1>Enter password</h1></div></div>
        <form onSubmit={handleSubmit}>
          <label><span>Password</span><div className="login-input"><LockKeyhole size={17} /><input type="password" autoComplete="current-password" autoFocus required value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="dark-button" type="submit" disabled={submitting || !password.trim()}>{submitting ? 'Checking...' : 'Continue'}</button>
        </form>
      </section>
    </div>
  );
}
