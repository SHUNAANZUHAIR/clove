import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import PasswordPromptModal from './PasswordPromptModal';
import type { Business } from '../lib/businesses';

const submitAttendancePassword = '123';

interface SubmitAttendanceButtonProps {
  business?: Business;
}

export default function SubmitAttendanceButton({ business = 'construction' }: SubmitAttendanceButtonProps) {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (password: string) => {
    if (password !== submitAttendancePassword) return 'Incorrect password. Please try again.';
    window.location.assign(`/submit-ot?business=${business}`);
    return null;
  };

  return <>
    <button className="soft-button submit-attendance-button" type="button" onClick={() => setOpen(true)}>
      <CalendarClock size={16} /> Submit Attendance
    </button>
    {open && <PasswordPromptModal onClose={() => setOpen(false)} onSubmit={handleSubmit} />}
  </>;
}
