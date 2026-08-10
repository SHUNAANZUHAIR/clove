import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import PasswordPromptModal from './PasswordPromptModal';

const submitAttendancePassword = '123';

export default function SubmitAttendanceButton() {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (password: string) => {
    if (password !== submitAttendancePassword) return 'Incorrect password. Please try again.';
    window.location.assign('/submit-ot');
    return null;
  };

  return <>
    <button className="soft-button submit-attendance-button" type="button" onClick={() => setOpen(true)}>
      <CalendarClock size={16} /> Submit Attendance
    </button>
    {open && <PasswordPromptModal onClose={() => setOpen(false)} onSubmit={handleSubmit} />}
  </>;
}
